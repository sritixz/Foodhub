import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import api from '../utils/api';

const PREFILLED_DEMAND = [
  {
    itemName: 'Paneer Butter Masala Meal Tray',
    totalRequestedQty: 120,
    indentsCount: 3,
    urgency: 'High',
    outletsBreakdown: [
      { outletName: 'Rexel India - Kiosk 1', qty: 50, urgency: 'High', indentNumber: 'IND-MOPY-101' },
      { outletName: 'DLF CyberCity Hub 2', qty: 40, urgency: 'Normal', indentNumber: 'IND-MOPY-102' },
      { outletName: 'Phoenix Mills Lower Parel', qty: 30, urgency: 'High', indentNumber: 'IND-MOPY-103' },
    ],
  },
  {
    itemName: 'Rajma Chawal Homestyle Bowl',
    totalRequestedQty: 80,
    indentsCount: 2,
    urgency: 'Normal',
    outletsBreakdown: [
      { outletName: 'Rexel India - Kiosk 1', qty: 50, urgency: 'Normal', indentNumber: 'IND-MOPY-104' },
      { outletName: 'Kent Healthcare Building', qty: 30, urgency: 'Normal', indentNumber: 'IND-MOPY-105' },
    ],
  },
  {
    itemName: 'Healthy Quinoa Buddha Bowl',
    totalRequestedQty: 45,
    indentsCount: 1,
    urgency: 'Critical',
    outletsBreakdown: [
      { outletName: 'DLF CyberCity Hub 2', qty: 45, urgency: 'Critical', indentNumber: 'IND-MOPY-106' },
    ],
  },
];

const PREFILLED_BATCHES = [
  {
    _id: 'batch-mock-001',
    batchNumber: 'B-20261118-001',
    dishName: 'Paneer Butter Masala Meal Tray',
    plannedYield: 120,
    actualYield: 120,
    yieldUnit: 'Plates',
    actualCostPerPlate: 111.77,
    remainingStagedQty: 100,
    status: 'Completed',
    prepDate: new Date().toISOString(),
  },
  {
    _id: 'batch-mock-002',
    batchNumber: 'B-20261118-002',
    dishName: 'Rajma Chawal Homestyle Bowl',
    plannedYield: 80,
    actualYield: 80,
    yieldUnit: 'Plates',
    actualCostPerPlate: 64.50,
    remainingStagedQty: 80,
    status: 'Completed',
    prepDate: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: 'batch-mock-003',
    batchNumber: 'B-20261118-003',
    dishName: 'Veg Hakka Noodles & Manchurian Combo',
    plannedYield: 90,
    actualYield: 90,
    yieldUnit: 'Plates',
    actualCostPerPlate: 78.20,
    remainingStagedQty: 30,
    dispatchedQty: 60,
    status: 'Dispatched',
    prepDate: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    _id: 'batch-mock-004',
    batchNumber: 'B-20261118-004',
    dishName: 'Healthy Quinoa Buddha Bowl',
    plannedYield: 50,
    actualYield: 50,
    yieldUnit: 'Packs',
    actualCostPerPlate: 88.00,
    remainingStagedQty: 50,
    status: 'Completed',
    prepDate: new Date(Date.now() - 10800000).toISOString(),
  },
];

const DEFAULT_RECIPES = [
  {
    _id: 'rec-pbmm-001',
    recipeCode: 'RCP-PBMM-001',
    title: 'Paneer Butter Masala Meal Tray',
    category: 'Full Meal',
    standardYield: 100,
    yieldUnit: 'Plates',
    perPlateCost: 111.77,
  },
  {
    _id: 'rec-rchb-002',
    recipeCode: 'RCP-RCHB-002',
    title: 'Rajma Chawal Homestyle Bowl',
    category: 'Full Meal',
    standardYield: 80,
    yieldUnit: 'Plates',
    perPlateCost: 63.49,
  },
  {
    _id: 'rec-hqbb-003',
    recipeCode: 'RCP-HQBB-003',
    title: 'Healthy Quinoa Buddha Bowl',
    category: 'Salad / Healthy',
    standardYield: 45,
    yieldUnit: 'Plates',
    perPlateCost: 89.5,
  },
];

const RECIPE_STOCK_TEMPLATES = {
  paneer: {
    recipeTitle: 'Paneer Butter Masala Meal Tray',
    standardYield: 100,
    perPlateCost: 111.77,
    ingredients: [
      { name: 'Fresh Malai Paneer', unit: 'kg', baseQty: 15.0, availableStock: 45.0, unitCost: 340 },
      { name: 'Amul Table Butter', unit: 'kg', baseQty: 3.5, availableStock: 12.0, unitCost: 480 },
      { name: 'Fresh Cream (Amul)', unit: 'L', baseQty: 2.0, availableStock: 8.0, unitCost: 210 },
      { name: 'Tomato Makhani Gravy', unit: 'kg', baseQty: 12.0, availableStock: 30.0, unitCost: 65 },
      { name: 'Steamed Basmati Rice', unit: 'kg', baseQty: 20.0, availableStock: 85.0, unitCost: 75 },
    ],
  },
  rajma: {
    recipeTitle: 'Rajma Chawal Homestyle Bowl',
    standardYield: 80,
    perPlateCost: 63.49,
    ingredients: [
      { name: 'Kashmiri Rajma', unit: 'kg', baseQty: 10.0, availableStock: 40.0, unitCost: 120 },
      { name: 'Steamed Basmati Rice', unit: 'kg', baseQty: 18.0, availableStock: 85.0, unitCost: 75 },
      { name: 'Onion Tomato Masala', unit: 'kg', baseQty: 8.0, availableStock: 25.0, unitCost: 60 },
      { name: 'Pure Desi Ghee', unit: 'kg', baseQty: 1.5, availableStock: 10.0, unitCost: 600 },
    ],
  },
  quinoa: {
    recipeTitle: 'Healthy Quinoa Buddha Bowl',
    standardYield: 45,
    perPlateCost: 89.5,
    ingredients: [
      { name: 'Organic White Quinoa', unit: 'kg', baseQty: 9.0, availableStock: 25.0, unitCost: 220 },
      { name: 'Fresh Hass Avocado', unit: 'kg', baseQty: 4.5, availableStock: 15.0, unitCost: 350 },
      { name: 'Baby Spinach & Salad Greens', unit: 'kg', baseQty: 6.0, availableStock: 20.0, unitCost: 140 },
      { name: 'Extra Virgin Olive Oil', unit: 'L', baseQty: 1.5, availableStock: 8.0, unitCost: 680 },
    ],
  },
};

const getStockCheckForRecipe = (recipeTitleOrObj, plannedYield) => {
  const title = (typeof recipeTitleOrObj === 'string' ? recipeTitleOrObj : recipeTitleOrObj?.title || '').toLowerCase();
  let template = RECIPE_STOCK_TEMPLATES.paneer;
  if (title.includes('rajma')) template = RECIPE_STOCK_TEMPLATES.rajma;
  else if (title.includes('quinoa')) template = RECIPE_STOCK_TEMPLATES.quinoa;

  const yieldCount = Number(plannedYield) || 120;
  const ratio = yieldCount / template.standardYield;

  const ingredientsCheck = template.ingredients.map((ing) => {
    const requiredQty = parseFloat((ing.baseQty * ratio).toFixed(2));
    const isSufficient = ing.availableStock >= requiredQty;
    const estimatedCost = parseFloat((requiredQty * ing.unitCost).toFixed(2));
    return {
      name: ing.name,
      unit: ing.unit,
      requiredQty,
      availableStock: ing.availableStock,
      deficit: isSufficient ? 0 : parseFloat((requiredQty - ing.availableStock).toFixed(2)),
      isSufficient,
      unitCost: ing.unitCost,
      estimatedCost,
    };
  });

  const allSufficient = ingredientsCheck.every((i) => i.isSufficient);
  const estimatedBatchCost = parseFloat((template.perPlateCost * yieldCount).toFixed(2));

  return {
    recipeTitle: template.recipeTitle,
    plannedYield: yieldCount,
    allSufficient,
    ingredientsCheck,
    estimatedBatchCost,
    estimatedCostPerPlate: template.perPlateCost,
  };
};

const INITIAL_STOCK_CHECK = getStockCheckForRecipe('paneer', 120);

const ProductionBatchManager = () => {
  const [batches, setBatches] = useState(PREFILLED_BATCHES);
  const [consolidatedDemand, setConsolidatedDemand] = useState(PREFILLED_DEMAND);
  const [recipes, setRecipes] = useState(DEFAULT_RECIPES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Batch Planning State
  const [selectedRecipeId, setSelectedRecipeId] = useState('rec-pbmm-001');
  const [plannedYield, setPlannedYield] = useState(120);
  const [stockCheckResult, setStockCheckResult] = useState(INITIAL_STOCK_CHECK);
  const [checkingStock, setCheckingStock] = useState(false);
  const [producing, setProducing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [batchRes, demandRes, recRes] = await Promise.all([
        api.get('/production/batches').catch(() => ({ data: [] })),
        api.get('/production/consolidated-demand').catch(() => ({ data: [] })),
        api.get('/recipes').catch(() => ({ data: [] })),
      ]);

      if (batchRes.data && batchRes.data.length > 0) {
        setBatches(batchRes.data);
      }
      if (demandRes.data && demandRes.data.length > 0) {
        setConsolidatedDemand(demandRes.data);
      }
      if (recRes.data && recRes.data.length > 0) {
        setRecipes(recRes.data);
        const match = recRes.data.find(r => r.title.toLowerCase().includes('paneer')) || recRes.data[0];
        setSelectedRecipeId(match._id);
      } else {
        setRecipes(DEFAULT_RECIPES);
      }
    } catch (e) {
      console.error(e);
      setRecipes(DEFAULT_RECIPES);
    } finally {
      setLoading(false);
    }
  };

  // Perform Pre-flight Stock Check
  const handleCheckStock = async () => {
    if (!selectedRecipeId || !plannedYield) return;
    setCheckingStock(true);
    setError('');

    try {
      const chosenRec = recipes.find((r) => r._id === selectedRecipeId) || recipes[0];
      if (typeof selectedRecipeId === 'string' && selectedRecipeId.startsWith('rec-')) {
        setStockCheckResult(getStockCheckForRecipe(chosenRec, plannedYield));
        setCheckingStock(false);
        return;
      }

      const res = await api.post('/production/check-stock', {
        recipeId: selectedRecipeId,
        plannedYield: Number(plannedYield),
      });
      setStockCheckResult(res.data);
    } catch (err) {
      console.warn('Fallback stock check:', err);
      const chosenRec = recipes.find((r) => r._id === selectedRecipeId) || recipes[0];
      setStockCheckResult(getStockCheckForRecipe(chosenRec, plannedYield));
    } finally {
      setCheckingStock(false);
    }
  };

  // Produce Batch & Deduct Inventory
  const handleProduceBatch = async () => {
    if (!selectedRecipeId || !plannedYield) return;
    setProducing(true);
    setError('');
    setSuccess('');

    try {
      if (typeof selectedRecipeId === 'string' && selectedRecipeId.startsWith('rec-')) {
        const activeRec = recipes.find(r => r._id === selectedRecipeId) || recipes[0];
        const newBatchNumber = `BAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(batches.length + 1).padStart(3, '0')}`;
        const newBatch = {
          _id: 'batch-mock-' + Date.now(),
          batchNumber: newBatchNumber,
          recipe: {
            title: activeRec.title,
            standardYield: Number(plannedYield),
            yieldUnit: 'Plates',
          },
          plannedYield: Number(plannedYield),
          actualYield: Number(plannedYield),
          remainingStagedQty: Number(plannedYield),
          actualCostPerPlate: activeRec.perPlateCost || 111.77,
          totalActualCost: parseFloat(((activeRec.perPlateCost || 111.77) * Number(plannedYield)).toFixed(2)),
          status: 'Staged for Dispatch',
          prepDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          prepTimeMinutes: 65,
        };
        setBatches(prev => [newBatch, ...prev]);
        setSuccess(`Batch ${newBatchNumber} successfully produced and staged for cold-room dispatch!`);
        setStockCheckResult(null);
        return;
      }

      const res = await api.post('/production/create-batch', {
        recipeId: selectedRecipeId,
        plannedYield: Number(plannedYield),
        actualYield: Number(plannedYield),
        autoDeductStock: true,
      });

      setSuccess(res.data?.message || 'Batch successfully produced and staged for dispatch!');
      setStockCheckResult(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to execute production batch.');
    } finally {
      setProducing(false);
    }
  };

  const handleSelectFromDemand = (demandItem) => {
    setError('');
    let chosenId = '';
    if (demandItem.linkedRecipe?._id) {
      chosenId = demandItem.linkedRecipe._id;
    } else {
      const demandTitle = demandItem.itemName.toLowerCase();
      const match = recipes.find(
        (r) =>
          r.title.toLowerCase() === demandTitle ||
          r.title.toLowerCase().includes(demandTitle) ||
          demandTitle.includes(r.title.toLowerCase()) ||
          (demandTitle.includes('paneer') && r.title.toLowerCase().includes('paneer')) ||
          (demandTitle.includes('rajma') && r.title.toLowerCase().includes('rajma')) ||
          (demandTitle.includes('quinoa') && r.title.toLowerCase().includes('quinoa'))
      );
      chosenId = match?._id || recipes[0]?._id;
    }

    if (chosenId) {
      setSelectedRecipeId(chosenId);
      setPlannedYield(demandItem.totalRequestedQty);
      setStockCheckResult(getStockCheckForRecipe(demandItem.itemName, demandItem.totalRequestedQty));
    }
  };

  return (
    <Layout
      headerProps={{
        title: 'Central Kitchen Batch Production Workbench',
        subtitle: 'Automated BOM stock deduction, batch scaling, and staging for outlet dispatch',
      }}
    >
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Alerts */}
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

        {/* Section 1: Consolidated Outlet Demand / Indents */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">dynamic_feed</span>
                Consolidated Spoke Kiosk Indents (Active Demand)
              </h2>
              <p className="text-xs text-slate-500">
                Sum of all replenishment requests raised by floor kiosks and retail managers.
              </p>
            </div>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
              {consolidatedDemand.length} Active Dishes Requested
            </span>
          </div>

          {consolidatedDemand.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 italic">
              No pending outlet indents. Kiosks are stocked or indents have been fulfilled.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {consolidatedDemand.map((d, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {d.itemName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.urgency === 'Critical'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                            : d.urgency === 'High'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                      >
                        {d.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Requested: <strong className="text-primary">{d.totalRequestedQty} Units</strong> across {d.indentsCount} kiosk(s)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectFromDemand(d)}
                    className="mt-3 text-xs py-1.5 px-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-primary text-slate-700 dark:text-slate-200 hover:text-primary rounded-lg font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-icons-outlined text-sm">precision_manufacturing</span>
                    Load into Batch Runner
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 2: Batch Production Execution Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="material-icons-outlined text-amber-500">soup_kitchen</span>
                Batch Production Execution Runner
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Select Recipe to Produce
                  </label>
                  <select
                    value={selectedRecipeId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedRecipeId(newId);
                      const chosenRec = recipes.find((r) => r._id === newId);
                      setStockCheckResult(getStockCheckForRecipe(chosenRec?.title || '', plannedYield));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {recipes.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.title} (Std: {r.standardYield} plates @ Rs {r.perPlateCost}/plate)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Input
                    label="Target Production Batch Yield (Plates)"
                    type="number"
                    min="1"
                    value={plannedYield}
                    onChange={(e) => {
                      const newYield = e.target.value;
                      setPlannedYield(newYield);
                      const chosenRec = recipes.find((r) => r._id === selectedRecipeId);
                      setStockCheckResult(getStockCheckForRecipe(chosenRec?.title || '', newYield));
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                <Button
                  variant="secondary"
                  onClick={handleCheckStock}
                  disabled={checkingStock}
                  className="text-xs font-bold flex items-center gap-1.5"
                >
                  <span className="material-icons-outlined text-base">inventory</span>
                  {checkingStock ? 'Verifying...' : 'Pre-flight Warehouse Stock Check'}
                </Button>

                <Button
                  variant="primary"
                  onClick={handleProduceBatch}
                  disabled={producing}
                  className="text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <span className="material-icons-outlined text-base">cookie</span>
                  {producing ? 'Cooking & Deducting...' : 'Produce Batch & Auto-Deduct Inventory'}
                </Button>
              </div>

              {/* Pre-flight Stock Check Result Display */}
              {stockCheckResult && (
                <div className="mt-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                      Warehouse Raw Material Pre-check for {stockCheckResult.plannedYield} Portions
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        stockCheckResult.allSufficient
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      }`}
                    >
                      {stockCheckResult.allSufficient ? 'Stock Sufficient' : 'Deficit Detected'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60 text-xs">
                    {stockCheckResult.ingredientsCheck.map((ing, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{ing.name}</span>
                          <span className="text-slate-400 ml-2">
                            (Need: {ing.requiredQty} {ing.unit} | In Store: {ing.availableStock} {ing.unit})
                          </span>
                        </div>
                        <div>
                          {ing.isSufficient ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <span className="material-icons-outlined text-sm">check_circle</span> OK
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <span className="material-icons-outlined text-sm">warning</span> Short by {ing.deficit} {ing.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-between border-t border-slate-200 dark:border-slate-700 text-xs">
                    <span className="text-slate-500">Estimated Batch Cooking Cost:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      Rs {stockCheckResult.estimatedBatchCost} (Rs {stockCheckResult.estimatedCostPerPlate} / plate)
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Quick Production Info Card */}
          <div className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border border-indigo-100 dark:border-indigo-950">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                <span className="material-icons-outlined text-indigo-500">info</span>
                Hub-and-Spoke Invariant
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
                When you execute <strong>Produce Batch</strong>:
              </p>
              <ul className="text-xs text-slate-500 space-y-1.5 list-disc pl-4 mt-2">
                <li>Raw materials are automatically decremented from Central Warehouse inventory.</li>
                <li>Finished meal batch is stamped with a unique Batch ID & 24hr expiry tag.</li>
                <li>The batch is immediately staged in cold-room for dispatch to kiosks.</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Section 3: Today's Produced Batches Staged for Dispatch */}
        <Card className="p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="material-icons-outlined text-primary">view_timeline</span>
            Produced Batches Staged for Dispatch
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                  <th className="pb-3">Batch ID</th>
                  <th className="pb-3">Menu Dish</th>
                  <th className="pb-3">Yield</th>
                  <th className="pb-3">Cost / Plate</th>
                  <th className="pb-3">Staged Qty</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Prepared At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-slate-400 italic">
                      No production batches recorded yet. Produce your first batch above!
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 font-mono font-bold text-primary">{b.batchNumber}</td>
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-100">
                        {b.menuItem?.name || b.recipe?.title || b.dishName || 'Dish'}
                      </td>
                      <td className="py-3">{b.plannedYield} {b.yieldUnit}</td>
                      <td className="py-3 font-semibold">Rs {b.actualCostPerPlate}</td>
                      <td className="py-3">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {b.remainingStagedQty}
                        </span>{' '}
                        / {b.plannedYield}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : b.status === 'Dispatched'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(b.prepDate || b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default ProductionBatchManager;
