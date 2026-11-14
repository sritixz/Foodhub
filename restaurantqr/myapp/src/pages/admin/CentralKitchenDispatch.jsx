import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout/Layout';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import api from '../../utils/api';
import { parseImportFile } from '../../utils/fileParser';

const CentralKitchenDispatch = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [items, setItems] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [recentDispatches, setRecentDispatches] = useState([]);

  // Transit logistics fields
  const [runnerName, setRunnerName] = useState('Ramesh K (Van Express)');
  const [vehicleNumber, setVehicleNumber] = useState('MH-02-CW-9912');
  const [temperatureAtDeparture, setTemperatureAtDeparture] = useState('4.2');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchOutlets();
    fetchRecentDispatches();
  }, []);

  const fetchOutlets = async () => {
    try {
      const res = await api.get('/outlets');
      setOutlets(res.data);
      if (res.data.length > 0) setSelectedOutlet(res.data[0]._id);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch outlets.');
    }
  };

  const fetchRecentDispatches = async () => {
    try {
      const res = await api.get('/dispatch/orders');
      setRecentDispatches(res.data || []);
    } catch (_) {}
  };

  useEffect(() => {
    if (date && selectedOutlet) {
      fetchData();
    }
  }, [date, selectedOutlet]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setWarning('');
    try {
      const [menuRes, batchRes] = await Promise.all([
        api.get('/menu-items').catch(() => ({ data: [] })),
        api.get('/production/batches?status=Completed').catch(() => ({ data: [] })),
      ]);

      setAvailableBatches(batchRes.data || []);

      // Filter catalog for this outlet
      const outletMenu = (menuRes.data || []).filter(
        (item) =>
          item.vendor?._id === selectedOutlet ||
          item.outlets?.some((o) => o._id === selectedOutlet) ||
          item.applyToAll
      );

      // Auto-extract outlet transfer cost price if set
      const initialItems = outletMenu.map((menuItem) => {
        const outletRule = (menuItem.outletPricing || []).find(
          (op) => op.outlet?.toString() === selectedOutlet.toString()
        );
        const unitCostPrice = outletRule?.costPrice || menuItem.costPrice || 0;

        // Auto-match an available staged batch
        const matchedBatch = (batchRes.data || []).find(
          (b) =>
            b.menuItem?._id?.toString() === menuItem._id?.toString() &&
            b.remainingStagedQty > 0
        );

        return {
          menuItem: menuItem._id,
          name: menuItem.name,
          category: menuItem.category?.name || 'General',
          costPrice: unitCostPrice,
          sellingPrice: menuItem.basePrice || 0,
          batchId: matchedBatch?._id || '',
          batchNumber: matchedBatch?.batchNumber || '',
          stagedAvailable: matchedBatch?.remainingStagedQty || 0,
          sentQty: '',
        };
      });

      // Check if dispatch order exists for today
      try {
        const existingOrder = await api.get(`/dispatch/orders?date=${date}&outletId=${selectedOutlet}`);
        if (existingOrder.data && existingOrder.data.length > 0) {
          const latest = existingOrder.data[0];
          const merged = initialItems.map((init) => {
            const saved = (latest.items || []).find(
              (s) => s.menuItem?._id?.toString() === init.menuItem?.toString()
            );
            if (saved) {
              return {
                ...init,
                sentQty: saved.dispatchedQty || '',
                batchNumber: saved.batchNumber || init.batchNumber,
                costPrice: saved.unitCostPrice || init.costPrice,
              };
            }
            return init;
          });
          setItems(merged);
        } else {
          setItems(initialItems);
        }
      } catch (_) {
        setItems(initialItems);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load catalog and batch data.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payloadItems = items
        .filter((item) => item.sentQty !== '' && Number(item.sentQty) > 0)
        .map((item) => ({
          menuItem: item.menuItem,
          productionBatch: item.batchId || undefined,
          batchNumber: item.batchNumber || undefined,
          dispatchedQty: Number(item.sentQty),
          unitCostPrice: Number(item.costPrice),
        }));

      if (payloadItems.length === 0) {
        setError('Please enter dispatched quantity for at least one item.');
        setSaving(false);
        return;
      }

      const res = await api.post('/dispatch/orders', {
        dispatchDate: date,
        targetOutlet: selectedOutlet,
        items: payloadItems,
        runnerName,
        vehicleNumber,
        temperatureAtDeparture: Number(temperatureAtDeparture) || null,
      });

      setSuccess(res.data?.message || 'Dispatch manifest successfully transmitted to outlet!');
      fetchRecentDispatches();
    } catch (err) {
      console.error(err);
      setError('Failed to transmit dispatch. ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const totalDispatchedUnits = items.reduce(
    (sum, i) => sum + (Number(i.sentQty) || 0),
    0
  );
  const totalTransferValue = items.reduce(
    (sum, i) => sum + (Number(i.sentQty) || 0) * (Number(i.costPrice) || 0),
    0
  );

  return (
    <Layout
      headerProps={{
        title: 'Central Kitchen Dispatch Hub & Logistics',
        subtitle: 'Issue digital Gate Passes and dispatch prepared batches to spoke kiosks',
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

        {/* Top Control Bar: Destination & Departure Details */}
        <Card className="p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="material-icons-outlined text-primary">local_shipping</span>
            Dispatch Gate Pass Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Dispatch Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Destination Spoke Outlet
              </label>
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none"
              >
                {outlets.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Assigned Runner / Van Driver"
                value={runnerName}
                onChange={(e) => setRunnerName(e.target.value)}
              />
            </div>

            <div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Vehicle #"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                />
                <Input
                  label="Departure Temp (°C)"
                  value={temperatureAtDeparture}
                  onChange={(e) => setTemperatureAtDeparture(e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Dispatch Quantities Manifest Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">fact_check</span>
                Dispatch Manifest & Batch Allocation
              </h2>
              <p className="text-xs text-slate-500">
                Allocate quantities from staged production runs. Outlet cost prices are pulled from Central Recipe Studio.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 uppercase font-semibold">Total Transfer Value: </span>
              <span className="text-lg font-black text-primary ml-1">Rs {totalTransferValue.toFixed(2)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                  <th className="pb-3">Menu Dish</th>
                  <th className="pb-3">Batch ID / Staged Stock</th>
                  <th className="pb-3 w-32">Outlet Cost (Rs)</th>
                  <th className="pb-3 w-32">Dispatched Qty</th>
                  <th className="pb-3 w-36">Total Transferred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-400 italic">
                      No menu items found for this outlet.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-100">
                        {item.name}
                        <span className="block text-[11px] text-slate-400 font-normal">{item.category}</span>
                      </td>
                      <td className="py-3">
                        {item.batchNumber ? (
                          <span className="font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-semibold">
                            {item.batchNumber} (Avail: {item.stagedAvailable})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Ad-hoc batch</span>
                        )}
                      </td>
                      <td className="py-3 font-bold text-slate-700 dark:text-slate-300">
                        Rs {item.costPrice}
                      </td>
                      <td className="py-3 pr-2">
                        <input
                          type="number"
                          min="0"
                          value={item.sentQty}
                          onChange={(e) => handleItemChange(idx, 'sentQty', e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                      <td className="py-3 font-black text-slate-900 dark:text-white">
                        Rs {((Number(item.sentQty) || 0) * (Number(item.costPrice) || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-700 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Total Units to Dispatch: <strong className="text-slate-900 dark:text-white">{totalDispatchedUnits} Units</strong>
            </div>

            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={saving || totalDispatchedUnits === 0}
              className="w-full sm:w-auto font-bold px-6 py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              <span className="material-icons-outlined text-base">send</span>
              {saving ? 'Transmitting...' : 'Confirm Dispatch & Transmit to Outlet'}
            </Button>
          </div>
        </Card>

        {/* Section: Recent Central Dispatches History */}
        <Card className="p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="material-icons-outlined text-primary">history</span>
            Recent Central Dispatch Manifests
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                  <th className="pb-3">Manifest #</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Destination Kiosk</th>
                  <th className="pb-3">Runner / Vehicle</th>
                  <th className="pb-3">Units</th>
                  <th className="pb-3">Value</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {recentDispatches.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-slate-400 italic">
                      No dispatch orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentDispatches.map((ord) => (
                    <tr key={ord._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 font-mono font-bold text-primary">{ord.dispatchNumber}</td>
                      <td className="py-3">{ord.dispatchDate}</td>
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-100">
                        {ord.targetOutlet?.name || 'Kiosk'}
                      </td>
                      <td className="py-3 text-slate-500">
                        {ord.runnerName} ({ord.vehicleNumber || 'Van'})
                      </td>
                      <td className="py-3 font-bold">{ord.totalDispatchedUnits} Units</td>
                      <td className="py-3 font-semibold">Rs {ord.totalTransferValue}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.transitStatus === 'Reconciled'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : ord.transitStatus === 'Delivered'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}
                        >
                          {ord.transitStatus}
                        </span>
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

export default CentralKitchenDispatch;
