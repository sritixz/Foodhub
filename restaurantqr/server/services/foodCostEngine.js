import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import Outlet from '../models/Outlet.js';
import { fetchLiveIngredientPrice } from './priceScraperService.js';

/**
 * Standard unit conversion factors to base unit (kg -> g: 1000, L -> ml: 1000)
 */
export function convertToBaseUnit(qty, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'kg') return { qty: qty * 1000, baseUnit: 'g' };
  if (u === 'l' || u === 'liter' || u === 'litre') return { qty: qty * 1000, baseUnit: 'ml' };
  return { qty, baseUnit: unit };
}

/**
 * Resolve unit price for an ingredient based on selected valuation mode
 * @param {Object} params
 * @param {string} params.name
 * @param {string} [params.rawMaterialId]
 * @param {string} [params.unit] - 'kg', 'g', 'L', 'ml', 'pcs'
 * @param {string} [params.valuationMode] - 'WAC' | 'PO' | 'LiveMarket'
 * @param {number} [params.manualFallbackRate]
 * @returns {Promise<{ rate: number, unit: string, modeUsed: string, source: string }>}
 */
export async function resolveIngredientRate({
  name,
  rawMaterialId,
  unit = 'g',
  valuationMode = 'WAC',
  manualFallbackRate = 0,
}) {
  const normUnit = unit.toLowerCase();

  // 1. Try Live Market Rate if requested
  if (valuationMode === 'LiveMarket') {
    try {
      const liveData = await fetchLiveIngredientPrice(name);
      if (liveData && liveData.found && liveData.pricePerUnit) {
        let rate = liveData.pricePerUnit;
        // If live rate is per kg/L and unit requested is g/ml, convert
        if ((normUnit === 'g' || normUnit === 'ml') && liveData.unit && (liveData.unit.toLowerCase() === 'kg' || liveData.unit.toLowerCase() === 'l')) {
          rate = rate / 1000;
        } else if ((normUnit === 'kg' || normUnit === 'l') && liveData.unit && (liveData.unit.toLowerCase() === 'g' || liveData.unit.toLowerCase() === 'ml')) {
          rate = rate * 1000;
        }
        return {
          rate: parseFloat(rate.toFixed(4)),
          unit,
          modeUsed: 'LiveMarket',
          source: liveData.productName || 'Live Mandi Index',
        };
      }
    } catch (e) {
      console.warn(`[FoodCostEngine] Live rate lookup failed for "${name}", falling back to inventory/manual:`, e.message);
    }
  }

  // 2. Try Inventory lookup (WAC or PO) if database is connected
  let invRecord = null;
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    if (rawMaterialId) {
      try {
        invRecord = await Inventory.findById(rawMaterialId);
      } catch (_) {}
    }
    if (!invRecord && name) {
      try {
        invRecord = await Inventory.findOne({
          name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        });
      } catch (_) {}
    }
  }

  if (invRecord) {
    // Inventory records typically store unit and cost per unit
    // If unit cost exists, calculate based on mode
    let baseRate = invRecord.unitCost || invRecord.costPrice || manualFallbackRate || 100;
    const invUnit = (invRecord.unit || 'kg').toLowerCase();

    // Convert between invUnit and requested unit
    let rate = baseRate;
    if ((normUnit === 'g' || normUnit === 'ml') && (invUnit === 'kg' || invUnit === 'l')) {
      rate = baseRate / 1000;
    } else if ((normUnit === 'kg' || normUnit === 'l') && (invUnit === 'g' || invUnit === 'ml')) {
      rate = baseRate * 1000;
    }

    // PO rate could incorporate a recent procurement inflation markup if tracked
    if (valuationMode === 'PO' && invRecord.lastPurchaseRate) {
      rate = invRecord.lastPurchaseRate;
      if ((normUnit === 'g' || normUnit === 'ml') && (invUnit === 'kg' || invUnit === 'l')) rate /= 1000;
    }

    return {
      rate: parseFloat(rate.toFixed(4)),
      unit,
      modeUsed: valuationMode,
      source: `Central Inventory (${invRecord.sku || invRecord.name})`,
    };
  }

  // 3. Fallback to manual rate or benchmark defaults
  let rate = manualFallbackRate;
  if (!rate || rate <= 0) {
    // Standard heuristics for Indian commercial pantry staples
    const lower = (name || '').toLowerCase();
    if (lower.includes('paneer')) rate = normUnit === 'kg' ? 340 : 0.34;
    else if (lower.includes('butter')) rate = normUnit === 'kg' ? 480 : 0.48;
    else if (lower.includes('oil') || lower.includes('ghee')) rate = normUnit === 'l' ? 160 : 0.16;
    else if (lower.includes('rice') || lower.includes('atta') || lower.includes('flour')) rate = normUnit === 'kg' ? 65 : 0.065;
    else if (lower.includes('dal') || lower.includes('rajma') || lower.includes('chana')) rate = normUnit === 'kg' ? 120 : 0.12;
    else if (lower.includes('chicken')) rate = normUnit === 'kg' ? 220 : 0.22;
    else if (lower.includes('cream')) rate = normUnit === 'l' ? 210 : 0.21;
    else rate = normUnit === 'kg' || normUnit === 'l' ? 100 : 0.10;
  }

  return {
    rate: parseFloat(rate.toFixed(4)),
    unit,
    modeUsed: 'ManualFallback',
    source: 'Commercial Pantry Benchmark',
  };
}

/**
 * Perform complete mathematical cost derivation for a recipe
 * @param {Object} recipeData
 * @returns {Promise<Object>} Calculated recipe object with derived costs
 */
export async function calculateRecipeFullCost(recipeData) {
  const defaultMode = recipeData.defaultValuationMode || 'WAC';
  const yieldCount = recipeData.standardYield && recipeData.standardYield > 0 ? recipeData.standardYield : 100;

  // 1. Calculate Raw Materials Cost
  let totalRawMaterialCost = 0;
  const processedIngredients = [];

  for (const ing of recipeData.ingredients || []) {
    const mode = ing.valuationMode || defaultMode;
    const rateInfo = await resolveIngredientRate({
      name: ing.name,
      rawMaterialId: ing.rawMaterial,
      unit: ing.unit || 'g',
      valuationMode: mode,
      manualFallbackRate: ing.unitCostSnapshot || 0,
    });

    const qty = Number(ing.quantity) || 0;
    const unitCost = ing.unitCostSnapshot > 0 && !ing.autoUpdateRate ? ing.unitCostSnapshot : rateInfo.rate;
    const wastage = 1 + (Number(ing.wastagePercent) || 0) / 100;
    const calculatedCost = parseFloat((qty * unitCost * wastage).toFixed(2));

    totalRawMaterialCost += calculatedCost;

    processedIngredients.push({
      ...ing,
      valuationMode: mode,
      unitCostSnapshot: unitCost,
      calculatedCost,
      rateSource: rateInfo.source,
    });
  }

  totalRawMaterialCost = parseFloat(totalRawMaterialCost.toFixed(2));

  // 2. Calculate Prep Expenses
  const prep = recipeData.prepExpenses || {};
  const packagingCost = Number(prep.packagingCost) || 0;
  const laborHours = Number(prep.directLaborHours) || 0;
  const laborRate = Number(prep.laborHourlyRate) || 180;
  const directLaborCost = parseFloat((laborHours * laborRate).toFixed(2));
  const utilitiesCost = Number(prep.utilitiesCost) || 0;
  const overheadPercent = Number(prep.overheadPercent) || 0;
  const overheadCost = overheadPercent > 0
    ? parseFloat(((totalRawMaterialCost * overheadPercent) / 100).toFixed(2))
    : Number(prep.overheadCost) || 0;

  const totalPrepExpenses = parseFloat(
    (packagingCost + directLaborCost + utilitiesCost + overheadCost).toFixed(2)
  );

  // 3. Total Batch Cost & Derived Per-Plate Cost
  const totalBatchCost = parseFloat((totalRawMaterialCost + totalPrepExpenses).toFixed(2));
  const perPlateCost = parseFloat((totalBatchCost / yieldCount).toFixed(2));

  // 4. Outlet Transfer Pricing Matrix Evaluation
  let outletTransferRules = recipeData.outletTransferRules || [];
  
  // If no outlet rules passed, attempt to fetch all active outlets if db connected
  if (outletTransferRules.length === 0 && mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const outlets = await Outlet.find({}).select('_id name');
      outletTransferRules = outlets.map(out => ({
        outlet: out._id,
        freightCost: 5.0, // default ₹5
        handlingFee: 2.0, // default ₹2
        finalCostPrice: parseFloat((perPlateCost + 7.0).toFixed(2)),
        targetSellingPrice: perPlateCost * 2.2, // ~45% food cost benchmark
        marginPercent: 0,
        manualOverride: false,
      }));
    } catch (_) {}
  }

  const evaluatedRules = outletTransferRules.map((rule) => {
    let finalCost = rule.finalCostPrice;
    if (!rule.manualOverride) {
      const freight = Number(rule.freightCost) || 0;
      const handling = Number(rule.handlingFee) || 0;
      finalCost = parseFloat((perPlateCost + freight + handling).toFixed(2));
    }
    const targetPrice = Number(rule.targetSellingPrice) || 0;
    const margin = targetPrice > 0
      ? parseFloat((((targetPrice - finalCost) / targetPrice) * 100).toFixed(1))
      : 0;

    return {
      ...rule,
      finalCostPrice: finalCost,
      targetSellingPrice: targetPrice,
      marginPercent: margin,
    };
  });

  return {
    ...recipeData,
    standardYield: yieldCount,
    ingredients: processedIngredients,
    totalRawMaterialCost,
    prepExpenses: {
      ...prep,
      packagingCost,
      directLaborHours: laborHours,
      laborHourlyRate: laborRate,
      directLaborCost,
      utilitiesCost,
      overheadPercent,
      overheadCost,
    },
    totalPrepExpenses,
    totalBatchCost,
    perPlateCost,
    outletTransferRules: evaluatedRules,
    lastCostedAt: new Date(),
  };
}

/**
 * Scale recipe BOM and expenses to target portion yield
 * @param {Object} recipe
 * @param {number} targetPortions
 */
export function scaleRecipeYield(recipe, targetPortions) {
  const baseYield = recipe.standardYield || 100;
  const ratio = targetPortions / baseYield;

  const scaledIngredients = (recipe.ingredients || []).map((ing) => ({
    name: ing.name,
    rawMaterial: ing.rawMaterial,
    unit: ing.unit,
    baseQuantity: ing.quantity,
    scaledQuantity: parseFloat((ing.quantity * ratio).toFixed(3)),
    unitCost: ing.unitCostSnapshot,
    scaledCost: parseFloat((ing.calculatedCost * ratio).toFixed(2)),
  }));

  const prep = recipe.prepExpenses || {};
  const scaledPackaging = parseFloat(((prep.packagingCost || 0) * ratio).toFixed(2));
  const scaledLabor = parseFloat(((prep.directLaborCost || 0) * Math.sqrt(ratio)).toFixed(2)); // Labor scales non-linearly with batch volume
  const scaledUtilities = parseFloat(((prep.utilitiesCost || 0) * (0.5 + 0.5 * ratio)).toFixed(2));
  const scaledOverhead = parseFloat(((prep.overheadCost || 0) * ratio).toFixed(2));

  const totalRawCost = scaledIngredients.reduce((s, i) => s + i.scaledCost, 0);
  const totalPrepCost = scaledPackaging + scaledLabor + scaledUtilities + scaledOverhead;
  const totalBatchCost = totalRawCost + totalPrepCost;

  return {
    baseYield,
    targetPortions,
    scalingFactor: parseFloat(ratio.toFixed(2)),
    scaledIngredients,
    scaledExpenses: {
      packagingCost: scaledPackaging,
      directLaborCost: scaledLabor,
      utilitiesCost: scaledUtilities,
      overheadCost: scaledOverhead,
      totalPrepExpenses: parseFloat(totalPrepCost.toFixed(2)),
    },
    totalRawMaterialCost: parseFloat(totalRawCost.toFixed(2)),
    totalBatchCost: parseFloat(totalBatchCost.toFixed(2)),
    perPlateCost: parseFloat((totalBatchCost / targetPortions).toFixed(2)),
  };
}
