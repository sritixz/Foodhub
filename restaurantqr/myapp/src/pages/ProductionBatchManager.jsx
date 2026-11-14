import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import api from '../utils/api';

const ProductionBatchManager = () => {
  const [batches, setBatches] = useState([]);
  const [consolidatedDemand, setConsolidatedDemand] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Batch Planning State
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [plannedYield, setPlannedYield] = useState(100);
  const [stockCheckResult, setStockCheckResult] = useState(null);
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

      setBatches(batchRes.data || []);
      setConsolidatedDemand(demandRes.data || []);
      setRecipes(recRes.data || []);
      if (recRes.data?.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(recRes.data[0]._id);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load production workbench data.');
    } finally {
      setLoading(false);
    }
  };

  // Perform Pre-flight Stock Check
  const handleCheckStock = async () => {
    if (!selectedRecipeId || !plannedYield) return;
    setCheckingStock(true);
    setStockCheckResult(null);
    setError('');

    try {
      const res = await api.post('/production/check-stock', {
        recipeId: selectedRecipeId,
        plannedYield: Number(plannedYield),
      });
      setStockCheckResult(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to check warehouse stock.');
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
      const res = await api.post('/production/create-batch', {
        recipeId: selectedRecipeId,
        plannedYield: Number(plannedYield),
        actualYield: Number(plannedYield),
        autoDeductStock: true,
      });

      setSuccess(res.data?.message || 'Batch successfully produced!');
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
    if (demandItem.linkedRecipe?._id) {
      setSelectedRecipeId(demandItem.linkedRecipe._id);
      setPlannedYield(demandItem.totalRequestedQty);
    } else {
      const match = recipes.find(
        (r) => r.title.toLowerCase() === demandItem.itemName.toLowerCase()
      );
      if (match) {
        setSelectedRecipeId(match._id);
        setPlannedYield(demandItem.totalRequestedQty);
      } else {
        setError(`No active recipe found matching "${demandItem.itemName}". Create one in Recipe Studio first.`);
      }
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
                      setSelectedRecipeId(e.target.value);
                      setStockCheckResult(null);
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
                      setPlannedYield(e.target.value);
                      setStockCheckResult(null);
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
                        {b.menuItem?.name || b.recipe?.title || 'Dish'}
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
