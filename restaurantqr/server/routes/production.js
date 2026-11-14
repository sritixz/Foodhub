import express from 'express';
import ProductionBatch from '../models/ProductionBatch.js';
import Recipe from '../models/Recipe.js';
import MenuItem from '../models/MenuItem.js';
import Inventory from '../models/Inventory.js';
import KitchenIndent from '../models/KitchenIndent.js';
import Warehouse from '../models/Warehouse.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';
import { scaleRecipeYield } from '../services/foodCostEngine.js';

const router = express.Router();

/**
 * @route   GET /api/production/batches
 * @desc    Fetch production batches with filters
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.get(
  '/batches',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const { status, date, kitchenId } = req.query;
      const filter = {};
      if (status && status !== 'All') filter.status = status;
      if (kitchenId) filter.centralKitchen = kitchenId;
      if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        filter.prepDate = { $gte: start, $lte: end };
      }

      const batches = await ProductionBatch.find(filter)
        .populate('menuItem', 'name category image foodType basePrice costPrice')
        .populate('recipe', 'recipeCode title standardYield perPlateCost')
        .populate('centralKitchen', 'name zone')
        .populate('preparedBy', 'name email')
        .sort({ createdAt: -1 });

      res.json(batches);
    } catch (err) {
      console.error('Error fetching production batches:', err);
      res.status(500).json({ message: 'Failed to fetch production batches', error: err.message });
    }
  }
);

/**
 * @route   GET /api/production/consolidated-demand
 * @desc    Consolidate active outlet indents for production planning
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.get(
  '/consolidated-demand',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      // Find raised / acknowledged indents
      const indents = await KitchenIndent.find({
        status: { $in: ['Raised', 'Acknowledged'] },
      }).populate('outlet', 'name address');

      // Aggregate by item name
      const itemMap = new Map();
      indents.forEach((ind) => {
        const key = ind.itemName.trim();
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            itemName: key,
            totalRequestedQty: 0,
            indentsCount: 0,
            outlets: [],
            urgencyLevels: new Set(),
          });
        }
        const entry = itemMap.get(key);
        entry.totalRequestedQty += ind.requestedQty;
        entry.indentsCount += 1;
        entry.outlets.push({
          outletName: ind.outlet?.name || 'Unknown',
          qty: ind.requestedQty,
          urgency: ind.urgency,
          indentNumber: ind.indentNumber,
        });
        entry.urgencyLevels.add(ind.urgency);
      });

      // Match each demand with its central recipe if available
      const results = [];
      for (const [name, data] of itemMap.entries()) {
        const recipe = await Recipe.findOne({
          title: { $regex: new RegExp(`^${name}$`, 'i') },
          isActive: true,
        }).select('_id recipeCode title standardYield perPlateCost');

        results.push({
          itemName: name,
          totalRequestedQty: data.totalRequestedQty,
          indentsCount: data.indentsCount,
          urgency: data.urgencyLevels.has('Critical')
            ? 'Critical'
            : data.urgencyLevels.has('High')
            ? 'High'
            : 'Normal',
          outletsBreakdown: data.outlets,
          linkedRecipe: recipe || null,
        });
      }

      res.json(results);
    } catch (err) {
      console.error('Error fetching consolidated demand:', err);
      res.status(500).json({ message: 'Failed to fetch consolidated demand', error: err.message });
    }
  }
);

/**
 * @route   POST /api/production/check-stock
 * @desc    Pre-flight inventory check against Central Warehouse before cooking
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.post(
  '/check-stock',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const { recipeId, plannedYield, kitchenWarehouseId } = req.body;
      if (!recipeId || !plannedYield) {
        return res.status(400).json({ message: 'recipeId and plannedYield are required' });
      }

      const recipe = await Recipe.findById(recipeId);
      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      const scaled = scaleRecipeYield(recipe, Number(plannedYield));
      const ingredientsCheck = [];
      let allSufficient = true;

      for (const ing of scaled.scaledIngredients) {
        // Query warehouse stock by name or id
        const query = {
          name: { $regex: new RegExp(`^${ing.name.trim()}$`, 'i') },
        };
        if (kitchenWarehouseId) {
          query.branch = kitchenWarehouseId;
        }

        const invItem = await Inventory.findOne(query);
        const availableStock = invItem ? invItem.quantity : 0;
        const required = ing.scaledQuantity;
        const isSufficient = availableStock >= required;
        if (!isSufficient) allSufficient = false;

        ingredientsCheck.push({
          name: ing.name,
          unit: ing.unit,
          requiredQty: required,
          availableStock,
          deficit: isSufficient ? 0 : parseFloat((required - availableStock).toFixed(3)),
          isSufficient,
          unitCost: ing.unitCost,
          estimatedCost: ing.scaledCost,
        });
      }

      res.json({
        recipeTitle: recipe.title,
        plannedYield: Number(plannedYield),
        allSufficient,
        ingredientsCheck,
        estimatedBatchCost: scaled.totalBatchCost,
        estimatedCostPerPlate: scaled.perPlateCost,
      });
    } catch (err) {
      console.error('Error checking production stock:', err);
      res.status(500).json({ message: 'Failed to check production stock', error: err.message });
    }
  }
);

/**
 * @route   POST /api/production/create-batch
 * @desc    Produce batch, scale recipe, auto-deduct raw material stock, and stage finished goods
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.post(
  '/create-batch',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const {
        recipeId,
        plannedYield,
        actualYield,
        centralKitchenId,
        autoDeductStock = true,
        expiryHours = 24,
        qualityNotes = '',
      } = req.body;

      if (!recipeId || !plannedYield) {
        return res.status(400).json({ message: 'recipeId and plannedYield are required' });
      }

      const recipe = await Recipe.findById(recipeId).populate('menuItem');
      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      // Identify central kitchen warehouse
      let kitchen = null;
      if (centralKitchenId) {
        kitchen = await Warehouse.findById(centralKitchenId);
      }
      if (!kitchen) {
        kitchen = await Warehouse.findOne({ isCentralKitchen: true }) || await Warehouse.findOne({});
      }
      if (!kitchen) {
        return res.status(400).json({ message: 'No Central Kitchen warehouse found. Please register one first.' });
      }

      const yieldCount = Number(plannedYield);
      const scaled = scaleRecipeYield(recipe, yieldCount);

      // Auto-deduct raw materials from Central Warehouse if requested
      const consumedIngredients = [];
      for (const ing of scaled.scaledIngredients) {
        let invItem = null;
        if (autoDeductStock) {
          invItem = await Inventory.findOne({
            name: { $regex: new RegExp(`^${ing.name.trim()}$`, 'i') },
            branch: kitchen.linkedOutlets?.[0] || kitchen._id,
          });

          if (!invItem) {
            // Global fallback
            invItem = await Inventory.findOne({
              name: { $regex: new RegExp(`^${ing.name.trim()}$`, 'i') },
            });
          }

          if (invItem) {
            invItem.quantity = Math.max(0, parseFloat((invItem.quantity - ing.scaledQuantity).toFixed(3)));
            invItem.lastUpdated = new Date();
            await invItem.save();
          }
        }

        consumedIngredients.push({
          rawMaterial: invItem?._id || ing.rawMaterial || null,
          name: ing.name,
          requiredQty: ing.scaledQuantity,
          actualUsedQty: ing.scaledQuantity,
          unit: ing.unit,
          unitCost: ing.unitCost,
          costDeducted: ing.scaledCost,
        });
      }

      // Generate unique Batch Number
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await ProductionBatch.countDocuments({
        batchNumber: { $regex: `^B-${datePart}` },
      });
      const batchNumber = `B-${datePart}-${String(countToday + 1).padStart(3, '0')}`;

      // Expiry Date
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + (Number(expiryHours) || 24));

      const newBatch = new ProductionBatch({
        batchNumber,
        recipe: recipe._id,
        menuItem: recipe.menuItem?._id || recipe.menuItem,
        centralKitchen: kitchen._id,
        scalingFactor: scaled.scalingFactor,
        plannedYield: yieldCount,
        actualYield: Number(actualYield) || yieldCount,
        yieldUnit: recipe.yieldUnit || 'Plates',
        consumedIngredients,
        totalRawMaterialCost: scaled.totalRawMaterialCost,
        allocatedPrepExpenses: {
          packagingCost: scaled.scaledExpenses.packagingCost,
          laborCost: scaled.scaledExpenses.directLaborCost,
          utilitiesCost: scaled.scaledExpenses.utilitiesCost,
          overheadCost: scaled.scaledExpenses.overheadCost,
          totalPrepExpenses: scaled.scaledExpenses.totalPrepExpenses,
        },
        actualBatchCost: scaled.totalBatchCost,
        actualCostPerPlate: scaled.perPlateCost,
        dispatchedQty: 0,
        remainingStagedQty: Number(actualYield) || yieldCount,
        status: 'Completed', // Immediately ready for dispatch
        prepDate: new Date(),
        expiryDate,
        preparedBy: req.user?.id || null,
        qualityNotes,
      });

      await newBatch.save();

      // Acknowledge corresponding indents if any
      await KitchenIndent.updateMany(
        { itemName: recipe.title, status: 'Raised' },
        { status: 'Acknowledged' }
      );

      res.status(201).json({
        message: `Production Batch ${batchNumber} successfully produced and staged for dispatch!`,
        batch: newBatch,
        rawMaterialDeducted: autoDeductStock,
      });
    } catch (err) {
      console.error('Error creating production batch:', err);
      res.status(500).json({ message: 'Failed to create production batch', error: err.message });
    }
  }
);

/**
 * @route   PUT /api/production/batches/:id/status
 * @desc    Update batch status
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.put(
  '/batches/:id/status',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const { status, qualityNotes } = req.body;
      const batch = await ProductionBatch.findById(req.params.id);
      if (!batch) {
        return res.status(404).json({ message: 'Batch not found' });
      }

      if (status) batch.status = status;
      if (qualityNotes) batch.qualityNotes = qualityNotes;
      await batch.save();

      res.json({ message: 'Batch status updated successfully', batch });
    } catch (err) {
      console.error('Error updating batch status:', err);
      res.status(500).json({ message: 'Failed to update batch status', error: err.message });
    }
  }
);

export default router;
