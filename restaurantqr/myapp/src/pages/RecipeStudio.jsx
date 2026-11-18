import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import api from '../utils/api';

const UNITS = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'L', label: 'Liters (L)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
];

const PRESETS = [
  {
    name: 'Standard Meal Tray (100 Plates)',
    packagingCost: 450,
    directLaborHours: 2.5,
    laborHourlyRate: 180,
    utilitiesCost: 220,
    overheadPercent: 4,
  },
  {
    name: 'Snack / Roll Pouch (100 Packs)',
    packagingCost: 200,
    directLaborHours: 1.5,
    laborHourlyRate: 180,
    utilitiesCost: 120,
    overheadPercent: 3,
  },
  {
    name: 'Hot Beverage / Soup (100 Cups)',
    packagingCost: 250,
    directLaborHours: 1.0,
    laborHourlyRate: 180,
    utilitiesCost: 150,
    overheadPercent: 2,
  },
];

const ALLERGEN_OPTIONS = ['Dairy', 'Nuts', 'Gluten', 'Soy', 'Eggs', 'Peanuts', 'Sesame'];

const RecipeStudio = () => {
  const [activeTab, setActiveTab] = useState('bom'); // 'bom' | 'prep' | 'outlets' | 'sop'
  const [recipesList, setRecipesList] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('new');
  const [menuItems, setMenuItems] = useState([]);
  const [outlets, setOutlets] = useState([]);

  // Form State
  const [recipeCode, setRecipeCode] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Full Meal');
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [standardYield, setStandardYield] = useState(100);
  const [yieldUnit, setYieldUnit] = useState('Plates');
  const [defaultValuationMode, setDefaultValuationMode] = useState('WAC');

  // Ingredients (BOM)
  const [ingredients, setIngredients] = useState([
    { name: 'Fresh Malai Paneer', quantity: 15, unit: 'kg', wastagePercent: 2, valuationMode: 'WAC', unitCostSnapshot: 340, calculatedCost: 5202 },
    { name: 'Amul Table Butter', quantity: 3.5, unit: 'kg', wastagePercent: 0, valuationMode: 'WAC', unitCostSnapshot: 480, calculatedCost: 1680 },
    { name: 'Fresh Cream', quantity: 2, unit: 'L', wastagePercent: 1, valuationMode: 'WAC', unitCostSnapshot: 210, calculatedCost: 424.2 },
    { name: 'Tomato Makhani Gravy', quantity: 12, unit: 'kg', wastagePercent: 5, valuationMode: 'WAC', unitCostSnapshot: 65, calculatedCost: 819 },
    { name: 'Steamed Basmati Rice', quantity: 20, unit: 'kg', wastagePercent: 3, valuationMode: 'WAC', unitCostSnapshot: 75, calculatedCost: 1545 },
  ]);

  // Prep Expenses
  const [prepExpenses, setPrepExpenses] = useState({
    presetName: 'Standard Meal Tray (100 Plates)',
    packagingCost: 450,
    directLaborHours: 2.5,
    laborHourlyRate: 180,
    directLaborCost: 450,
    utilitiesCost: 220,
    overheadPercent: 4,
    overheadCost: 386.81,
  });

  // Outlet Matrix
  const [outletRules, setOutletRules] = useState([]);

  // SOP & Specs
  const [instructions, setInstructions] = useState([
    { stepNumber: 1, title: 'Base Gravy Simmer', description: 'Simmer Makhani gravy in jacketed kettle at 90°C for 25 mins.', timeMinutes: 25, criticalControlPoint: 'Temp >= 85°C' },
    { stepNumber: 2, title: 'Dairy Addition', description: 'Gently fold in diced paneer, butter, and fresh cream. Cook for 8 mins.', timeMinutes: 8, criticalControlPoint: 'Do not boil vigorously' },
    { stepNumber: 3, title: 'Portioning & Heat-Sealing', description: 'Portion 250g curry + 200g rice into 3-CP trays and heat-seal.', timeMinutes: 30, criticalControlPoint: 'Inspect hermetic seal' },
  ]);
  const [allergens, setAllergens] = useState(['Dairy']);
  const [storageSpecs, setStorageSpecs] = useState({
    shelfLifeHours: 24,
    storageTempMin: 2,
    storageTempMax: 5,
    reheatingInstructions: 'Microwave 800W for 2 mins or heat in pan until piping hot.',
  });

  // UI status
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initial Data Fetching
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [recRes, menuRes, outletRes] = await Promise.all([
        api.get('/recipes').catch(() => ({ data: [] })),
        api.get('/menu-items').catch(() => ({ data: [] })),
        api.get('/outlets').catch(() => ({ data: [] })),
      ]);

      setRecipesList(recRes.data || []);
      setMenuItems(menuRes.data || []);
      setOutlets(outletRes.data || []);

      // Initialize outlet rules if new recipe
      if (outletRes.data && outletRes.data.length > 0) {
        initOutletRules(outletRes.data);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load initial studio data.');
    } finally {
      setLoading(false);
    }
  };

  // Derived Calculation helper (Live Food Cost)
  const totals = useMemo(() => {
    const totalRaw = ingredients.reduce((sum, ing) => {
      const raw = (Number(ing.quantity) || 0) * (Number(ing.unitCostSnapshot) || 0);
      const wastage = 1 + (Number(ing.wastagePercent) || 0) / 100;
      return sum + raw * wastage;
    }, 0);

    const labor = (Number(prepExpenses.directLaborHours) || 0) * (Number(prepExpenses.laborHourlyRate) || 180);
    const overhead = prepExpenses.overheadPercent
      ? (totalRaw * Number(prepExpenses.overheadPercent)) / 100
      : Number(prepExpenses.overheadCost) || 0;

    const totalPrep =
      (Number(prepExpenses.packagingCost) || 0) +
      labor +
      (Number(prepExpenses.utilitiesCost) || 0) +
      overhead;

    const totalBatch = totalRaw + totalPrep;
    const yieldNum = Number(standardYield) > 0 ? Number(standardYield) : 1;
    const perPlate = totalBatch / yieldNum;

    return {
      totalRawMaterialCost: parseFloat(totalRaw.toFixed(2)),
      totalPrepExpenses: parseFloat(totalPrep.toFixed(2)),
      totalBatchCost: parseFloat(totalBatch.toFixed(2)),
      perPlateCost: parseFloat(perPlate.toFixed(2)),
    };
  }, [ingredients, prepExpenses, standardYield]);

  // Synchronize dynamic per-plate cost to outlet transfer matrix if not manually overridden
  useEffect(() => {
    if (outletRules.length > 0 && totals.perPlateCost > 0) {
      setOutletRules((prev) =>
        prev.map((rule) => {
          if (!rule.manualOverride) {
            const finalCost = parseFloat(
              (totals.perPlateCost + (Number(rule.freightCost) || 0) + (Number(rule.handlingFee) || 0)).toFixed(2)
            );
            const targetSelling = Number(rule.targetSellingPrice) || 0;
            const margin =
              targetSelling > 0
                ? parseFloat((((targetSelling - finalCost) / targetSelling) * 100).toFixed(1))
                : 0;
            return {
              ...rule,
              finalCostPrice: finalCost,
              marginPercent: margin,
            };
          }
          return rule;
        })
      );
    }
  }, [totals.perPlateCost]);

  const initOutletRules = (outletList, baseCost = null) => {
    const currentBase = baseCost !== null ? baseCost : (totals.perPlateCost || 111.77);
    const rules = outletList.map((out, idx) => {
      const freight = idx === 0 ? 4.5 : idx === 1 ? 8.5 : 12.0;
      const handling = idx === 0 ? 2.0 : 3.0;
      const finalCost = parseFloat((currentBase + freight + handling).toFixed(2));
      const targetSelling = 220 + idx * 20;
      const margin = targetSelling > 0 ? parseFloat((((targetSelling - finalCost) / targetSelling) * 100).toFixed(1)) : 0;
      return {
        outlet: out._id,
        outletName: out.name,
        freightCost: freight,
        handlingFee: handling,
        finalCostPrice: finalCost,
        targetSellingPrice: targetSelling,
        marginPercent: margin,
        manualOverride: false,
      };
    });
    setOutletRules(rules);
  };

  // Switch recipe selection
  const handleSelectRecipe = (id) => {
    setSelectedRecipeId(id);
    if (id === 'new') {
      setTitle('');
      setRecipeCode('');
      setSelectedMenuItem('');
      initOutletRules(outlets, totals.perPlateCost);
      return;
    }
    const found = recipesList.find((r) => r._id === id);
    if (found) {
      setTitle(found.title);
      setRecipeCode(found.recipeCode);
      setCategory(found.category || 'Full Meal');
      setSelectedMenuItem(found.menuItem?._id || found.menuItem || '');
      setStandardYield(found.standardYield || 100);
      setYieldUnit(found.yieldUnit || 'Plates');
      setDefaultValuationMode(found.defaultValuationMode || 'WAC');
      setIngredients(found.ingredients || []);
      setPrepExpenses(found.prepExpenses || {});
      setAllergens(found.allergens || []);
      setInstructions(found.instructions || []);
      if (found.storageSpecs) setStorageSpecs(found.storageSpecs);

      if (found.outletTransferRules && found.outletTransferRules.length > 0) {
        setOutletRules(
          found.outletTransferRules.map((rule) => ({
            ...rule,
            outletName: rule.outlet?.name || outlets.find((o) => o._id === rule.outlet)?.name || 'Outlet',
          }))
        );
      } else {
        initOutletRules(outlets, found.perPlateCost || totals.perPlateCost);
      }
    }
  };

  // Ingredient Handlers
  const handleAddIngredient = () => {
    setIngredients([
      ...ingredients,
      { name: '', quantity: 1, unit: 'kg', wastagePercent: 0, valuationMode: defaultValuationMode, unitCostSnapshot: 100, calculatedCost: 100 },
    ]);
  };

  const handleUpdateIngredient = (index, field, value) => {
    const updated = [...ingredients];
    updated[index][field] = field === 'quantity' || field === 'wastagePercent' || field === 'unitCostSnapshot' ? Number(value) : value;
    const raw = (Number(updated[index].quantity) || 0) * (Number(updated[index].unitCostSnapshot) || 0);
    const wastage = 1 + (Number(updated[index].wastagePercent) || 0) / 100;
    updated[index].calculatedCost = parseFloat((raw * wastage).toFixed(2));
    setIngredients(updated);
  };

  const handleRemoveIngredient = (index) => {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Prep Preset Handler
  const applyPreset = (preset) => {
    setPrepExpenses({
      ...prepExpenses,
      presetName: preset.name,
      packagingCost: preset.packagingCost,
      directLaborHours: preset.directLaborHours,
      laborHourlyRate: preset.laborHourlyRate,
      utilitiesCost: preset.utilitiesCost,
      overheadPercent: preset.overheadPercent,
    });
  };

  // Outlet Rule Handlers
  const handleOutletRuleChange = (index, field, value) => {
    const updated = [...outletRules];
    updated[index][field] = Number(value) || 0;

    if (field === 'freightCost' || field === 'handlingFee') {
      if (!updated[index].manualOverride) {
        updated[index].finalCostPrice = parseFloat((totals.perPlateCost + (updated[index].freightCost || 0) + (updated[index].handlingFee || 0)).toFixed(2));
      }
    } else if (field === 'finalCostPrice') {
      updated[index].manualOverride = true;
    }

    if (updated[index].targetSellingPrice > 0) {
      updated[index].marginPercent = parseFloat((((updated[index].targetSellingPrice - updated[index].finalCostPrice) / updated[index].targetSellingPrice) * 100).toFixed(1));
    }
    setOutletRules(updated);
  };

  // Save Recipe Action
  const handleSaveRecipe = async () => {
    if (!title.trim()) {
      setError('Please provide a recipe title.');
      return;
    }
    if (!selectedMenuItem) {
      setError('Please select a linked Menu Item.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        recipeCode: recipeCode || undefined,
        menuItem: selectedMenuItem,
        title,
        category,
        standardYield: Number(standardYield),
        yieldUnit,
        defaultValuationMode,
        ingredients,
        prepExpenses,
        outletTransferRules: outletRules,
        instructions,
        allergens,
        storageSpecs,
      };

      let res;
      if (selectedRecipeId && selectedRecipeId !== 'new') {
        res = await api.put(`/recipes/${selectedRecipeId}`, payload);
        setSuccess('Recipe successfully updated & outlet pricing synchronized!');
      } else {
        res = await api.post('/recipes', payload);
        setSuccess('New Central Recipe created & published to Central Kitchen!');
        if (res.data?.recipe?._id) {
          setSelectedRecipeId(res.data.recipe._id);
        }
      }

      fetchInitialData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to save recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      headerProps={{
        title: 'Central Recipe Studio & Food Cost Engine',
        subtitle: 'BOM explosion, prep expenses, and manual per-outlet transfer pricing',
      }}
    >
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Banner Alert Messages */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <span className="material-icons-outlined text-red-500">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <span className="material-icons-outlined text-emerald-500">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        {/* Top Control Bar: Recipe Picker & Valuation Source Mode */}
        <Card className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-800 dark:to-indigo-950/20 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Select Recipe to Edit or Create New
              </label>
              <select
                value={selectedRecipeId}
                onChange={(e) => handleSelectRecipe(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="new">+ Create New Recipe Master</option>
                {recipesList.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.recipeCode} - {r.title} (Rs {r.perPlateCost || 0}/plate)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Raw Material Valuation Engine
              </label>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">
                {['WAC', 'PO', 'LiveMarket'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDefaultValuationMode(mode)}
                    className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                      defaultValuationMode === mode
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'WAC' ? 'Weighted Avg' : mode === 'PO' ? 'Latest PO' : 'Live Mandi'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end justify-end gap-2">
              <Button
                variant="primary"
                onClick={handleSaveRecipe}
                disabled={saving}
                className="w-full md:w-auto font-bold flex items-center justify-center gap-2 shadow-md"
              >
                <span className="material-icons-outlined text-base">cloud_upload</span>
                {saving ? 'Publishing...' : 'Save & Publish Recipe'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Master Recipe Header Inputs */}
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Recipe Title / Dish Name"
                placeholder="e.g. Paneer Butter Masala Meal Tray"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Linked Menu Item
              </label>
              <select
                value={selectedMenuItem}
                onChange={(e) => setSelectedMenuItem(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Choose Menu Dish --</option>
                {menuItems.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} (Base: Rs {m.basePrice})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Input
                label="Standard Yield (Portions)"
                type="number"
                min="1"
                value={standardYield}
                onChange={(e) => setStandardYield(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Studio Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
          {[
            { id: 'bom', label: '1. Ingredients & BOM', icon: 'restaurant' },
            { id: 'prep', label: '2. Preparation Expenses', icon: 'local_fire_department' },
            { id: 'outlets', label: '3. Outlet Transfer Matrix', icon: 'storefront' },
            { id: 'sop', label: '4. Cooking SOP & QC', icon: 'menu_book' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="material-icons-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: INGREDIENTS & BOM */}
        {activeTab === 'bom' && (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-icons-outlined text-primary">receipt_long</span>
                    Bill of Materials (Raw Materials Inventory)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ingredient usage per {standardYield} {yieldUnit}. Rates derived via {defaultValuationMode}.
                  </p>
                </div>
                <Button variant="secondary" onClick={handleAddIngredient} className="text-xs flex items-center gap-1">
                  <span className="material-icons-outlined text-sm">add</span> Add Raw Material
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                      <th className="pb-3">Ingredient Name</th>
                      <th className="pb-3 w-28">Quantity</th>
                      <th className="pb-3 w-28">Unit</th>
                      <th className="pb-3 w-24">Wastage %</th>
                      <th className="pb-3 w-32">Rate (Rs)</th>
                      <th className="pb-3 w-32">Subtotal</th>
                      <th className="pb-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ingredients.map((ing, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            value={ing.name}
                            onChange={(e) => handleUpdateIngredient(idx, 'name', e.target.value)}
                            placeholder="e.g. Paneer or Butter"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            value={ing.quantity}
                            onChange={(e) => handleUpdateIngredient(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={ing.unit}
                            onChange={(e) => handleUpdateIngredient(idx, 'unit', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs font-medium focus:outline-none"
                          >
                            {UNITS.map((u) => (
                              <option key={u.value} value={u.value}>{u.value}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={ing.wastagePercent}
                            onChange={(e) => handleUpdateIngredient(idx, 'wastagePercent', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            step="0.1"
                            value={ing.unitCostSnapshot}
                            onChange={(e) => handleUpdateIngredient(idx, 'unitCostSnapshot', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                          Rs {ing.calculatedCost || (ing.quantity * ing.unitCostSnapshot).toFixed(2)}
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(idx)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <span className="material-icons-outlined text-base">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Raw Material Subtotal: </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white ml-2">
                    Rs {totals.totalRawMaterialCost}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: PREPARATION & OPERATIONAL EXPENSES */}
        {activeTab === 'prep' && (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6 gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-icons-outlined text-amber-500">local_fire_department</span>
                    Direct Preparation & Operational Expenses
                  </h3>
                  <p className="text-xs text-slate-500">
                    Allocated packaging, labor, gas/energy, and commissary overhead per {standardYield} {yieldUnit} batch.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Quick Presets:</span>
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white transition-colors font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      {p.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Packaging & Containers
                  </h4>
                  <Input
                    label="Meal Containers, Lids & Seal Foil (Total Batch Cost)"
                    type="number"
                    value={prepExpenses.packagingCost}
                    onChange={(e) => setPrepExpenses({ ...prepExpenses, packagingCost: Number(e.target.value) })}
                  />
                  <p className="text-[11px] text-slate-500">
                    Per plate packaging cost: Rs {(prepExpenses.packagingCost / standardYield).toFixed(2)} / plate
                  </p>
                </div>

                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Direct Kitchen Cook Labor
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Prep Hours"
                      type="number"
                      step="0.5"
                      value={prepExpenses.directLaborHours}
                      onChange={(e) => setPrepExpenses({ ...prepExpenses, directLaborHours: Number(e.target.value) })}
                    />
                    <Input
                      label="Hourly Rate (Rs/hr)"
                      type="number"
                      value={prepExpenses.laborHourlyRate}
                      onChange={(e) => setPrepExpenses({ ...prepExpenses, laborHourlyRate: Number(e.target.value) })}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Total Labor: Rs {(prepExpenses.directLaborHours * prepExpenses.laborHourlyRate).toFixed(2)}
                  </p>
                </div>

                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Cooking Gas & Utilities
                  </h4>
                  <Input
                    label="Commercial LPG / Electricity per Batch (Rs)"
                    type="number"
                    value={prepExpenses.utilitiesCost}
                    onChange={(e) => setPrepExpenses({ ...prepExpenses, utilitiesCost: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Central Commissary Overhead
                  </h4>
                  <Input
                    label="Overhead Surcharge (% of Raw Materials)"
                    type="number"
                    value={prepExpenses.overheadPercent}
                    onChange={(e) => setPrepExpenses({ ...prepExpenses, overheadPercent: Number(e.target.value) })}
                  />
                  <p className="text-[11px] text-slate-500">
                    Calculated Overhead: Rs {((totals.totalRawMaterialCost * (prepExpenses.overheadPercent || 0)) / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-6 flex justify-end">
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-semibold">Prep Expenses Subtotal: </span>
                  <span className="text-lg font-black text-amber-600 ml-2">Rs {totals.totalPrepExpenses}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: OUTLET TRANSFER MATRIX (MANUAL CONFIGURATION) */}
        {activeTab === 'outlets' && (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary">storefront</span>
                  Manual Outlet Transfer Pricing Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Base Per-Plate Cost is <strong>Rs {totals.perPlateCost}</strong>. Customize freight and handling per outlet below:
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                      <th className="pb-3">Spoke Outlet</th>
                      <th className="pb-3 w-32">Base Plate Cost</th>
                      <th className="pb-3 w-32">Logistics / Freight</th>
                      <th className="pb-3 w-32">Handling Markup</th>
                      <th className="pb-3 w-36">Final Cost Price</th>
                      <th className="pb-3 w-36">Retail Menu Price</th>
                      <th className="pb-3 w-28 text-center">Gross Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {outletRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-semibold text-slate-800 dark:text-slate-100">
                          {rule.outletName}
                        </td>
                        <td className="py-3 text-slate-500 font-medium">
                          Rs {totals.perPlateCost}
                        </td>
                        <td className="py-3 pr-2">
                          <input
                            type="number"
                            step="0.5"
                            value={rule.freightCost}
                            onChange={(e) => handleOutletRuleChange(idx, 'freightCost', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-semibold focus:outline-none"
                          />
                        </td>
                        <td className="py-3 pr-2">
                          <input
                            type="number"
                            step="0.5"
                            value={rule.handlingFee}
                            onChange={(e) => handleOutletRuleChange(idx, 'handlingFee', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-semibold focus:outline-none"
                          />
                        </td>
                        <td className="py-3 pr-2 font-bold text-primary">
                          <input
                            type="number"
                            step="0.5"
                            value={rule.finalCostPrice}
                            onChange={(e) => handleOutletRuleChange(idx, 'finalCostPrice', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-primary/40 rounded px-2.5 py-1 text-xs font-bold text-primary focus:outline-none"
                          />
                        </td>
                        <td className="py-3 pr-2">
                          <input
                            type="number"
                            step="1"
                            value={rule.targetSellingPrice}
                            onChange={(e) => handleOutletRuleChange(idx, 'targetSellingPrice', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-xs font-semibold focus:outline-none"
                          />
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              rule.marginPercent >= 45
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : rule.marginPercent >= 30
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}
                          >
                            {rule.marginPercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: COOKING SOP & QC */}
        {activeTab === 'sop' && (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary">menu_book</span>
                  Centralized Recipe Reuse: Chef SOP, Quality Checks & Allergens
                </h3>
                <p className="text-xs text-slate-500">
                  Centrally published instructions displayed to kitchen staff during batch cooking runs.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Declared Allergens</label>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGEN_OPTIONS.map((alg) => {
                      const selected = allergens.includes(alg);
                      return (
                        <button
                          key={alg}
                          type="button"
                          onClick={() => {
                            setAllergens(selected ? allergens.filter((a) => a !== alg) : [...allergens, alg]);
                          }}
                          className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors border ${
                            selected
                              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {alg}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Preparation Steps & Critical Control Points (CCP)</label>
                  {instructions.map((step, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-primary">Step {step.stepNumber}: {step.title}</span>
                        <span className="text-xs text-slate-400">{step.timeMinutes} mins</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{step.description}</p>
                      {step.criticalControlPoint && (
                        <span className="inline-block text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                          HACCP CCP: {step.criticalControlPoint}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* BOTTOM STICKY COST SUMMARY BAR */}
        <div className="sticky bottom-4 z-20 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Raw Materials</span>
              <span className="text-base font-bold text-slate-100">Rs {totals.totalRawMaterialCost}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Prep Expenses</span>
              <span className="text-base font-bold text-amber-400">+ Rs {totals.totalPrepExpenses}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total Batch Cost</span>
              <span className="text-base font-bold text-emerald-400">= Rs {totals.totalBatchCost}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Derived Per-Plate Cost</span>
              <span className="text-xl font-black text-white">Rs {totals.perPlateCost}</span>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleSaveRecipe}
            disabled={saving}
            className="w-full md:w-auto font-bold px-6 py-2.5 text-sm shadow-lg flex items-center justify-center gap-2"
          >
            <span className="material-icons-outlined text-base">save</span>
            {saving ? 'Publishing...' : 'Save & Publish Recipe'}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default RecipeStudio;
