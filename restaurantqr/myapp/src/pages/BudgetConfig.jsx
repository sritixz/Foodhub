import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Modal from '../components/UI/Modal';
import api from '../utils/api';

const periodOptions = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
];

const EMPTY_BUDGET = {
  procurementLimit: '',
  perOrderLimit: '',
  salesTarget: '',
  alertThreshold: 80,
  blockOnExceed: false,
  period: 'monthly',
};

const formatCurrency = (val) =>
  val != null && val !== '' ? `₹${Number(val).toLocaleString('en-IN')}` : '—';

const usagePercent = (used, limit) => {
  if (!limit || !used) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
};

const ProgressBar = ({ percent, threshold }) => {
  const color =
    percent >= 100
      ? 'bg-red-500'
      : percent >= threshold
      ? 'bg-yellow-400'
      : 'bg-green-500';
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

const BudgetConfig = () => {
  const [outlets, setOutlets] = useState([]);
  const [budgets, setBudgets] = useState({}); // keyed by outletId
  const [spendData, setSpendData] = useState({}); // keyed by outletId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState(null);
  const [form, setForm] = useState(EMPTY_BUDGET);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [outletsRes, budgetsRes] = await Promise.all([
        api.get('/outlets'),
        api.get('/budgets'),
      ]);

      setOutlets(outletsRes.data);

      // Index budgets by outletId
      const budgetMap = {};
      (budgetsRes.data || []).forEach((b) => {
        budgetMap[b.outletId] = b;
      });
      setBudgets(budgetMap);

      // Fetch spend summary per outlet
      const spendMap = {};
      await Promise.allSettled(
        outletsRes.data.map(async (outlet) => {
          try {
            const res = await api.get(`/budgets/spend/${outlet._id}`);
            spendMap[outlet._id] = res.data;
          } catch {
            spendMap[outlet._id] = { procurement: 0, orders: 0 };
          }
        })
      );
      setSpendData(spendMap);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (outlet) => {
    setEditingOutlet(outlet);
    const existing = budgets[outlet._id];
    setForm(
      existing
        ? {
            procurementLimit: existing.procurementLimit ?? '',
            perOrderLimit: existing.perOrderLimit ?? '',
            salesTarget: existing.salesTarget ?? '',
            alertThreshold: existing.alertThreshold ?? 80,
            blockOnExceed: existing.blockOnExceed ?? false,
            period: existing.period ?? 'monthly',
          }
        : { ...EMPTY_BUDGET }
    );
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingOutlet(null);
  };

  const handleField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.procurementLimit || Number(form.procurementLimit) <= 0)
      return 'Procurement limit must be greater than 0';
    if (!form.perOrderLimit || Number(form.perOrderLimit) <= 0)
      return 'Per-order limit must be greater than 0';
    if (Number(form.perOrderLimit) > Number(form.procurementLimit))
      return 'Per-order limit cannot exceed procurement limit';
    if (!form.salesTarget || Number(form.salesTarget) <= 0)
      return 'Sales target must be greater than 0';
    if (form.alertThreshold < 1 || form.alertThreshold > 100)
      return 'Alert threshold must be between 1 and 100';
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);
      setFormError('');
      const existing = budgets[editingOutlet._id];
      const payload = {
        outletId: editingOutlet._id,
        procurementLimit: Number(form.procurementLimit),
        perOrderLimit: Number(form.perOrderLimit),
        salesTarget: Number(form.salesTarget),
        alertThreshold: Number(form.alertThreshold),
        blockOnExceed: form.blockOnExceed,
        period: form.period,
      };

      let saved;
      if (existing?._id) {
        const res = await api.put(`/budgets/${existing._id}`, payload);
        saved = res.data;
      } else {
        const res = await api.post('/budgets', payload);
        saved = res.data;
      }

      setBudgets((prev) => ({ ...prev, [editingOutlet._id]: saved }));
      setSuccessMsg(`Budget saved for ${editingOutlet.name}`);
      setTimeout(() => setSuccessMsg(''), 3000);
      closeModal();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (outlet) => {
    const existing = budgets[outlet._id];
    if (!existing?._id) return;
    if (!window.confirm(`Remove budget config for ${outlet.name}?`)) return;
    try {
      await api.delete(`/budgets/${existing._id}`);
      setBudgets((prev) => {
        const next = { ...prev };
        delete next[outlet._id];
        return next;
      });
      setSuccessMsg(`Budget removed for ${outlet.name}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete budget');
    }
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: 'Budget Configuration' }}>
        <div className="flex items-center justify-center h-full py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading budgets...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerProps={{ title: 'Budget Configuration' }}>
      <div className="p-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Outlet Budget Config</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Set procurement limits, order caps and sales targets per outlet
            </p>
          </div>
          <Button variant="secondary" onClick={fetchAll}>
            <span className="material-icons-outlined text-sm">refresh</span>
            Refresh
          </Button>
        </div>

        {/* Banners */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            <span className="material-icons-outlined text-sm">error</span>
            {error}
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
            <span className="material-icons-outlined text-sm">check_circle</span>
            {successMsg}
          </div>
        )}

        {/* Outlet cards */}
        {outlets.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <span className="material-icons-outlined text-5xl mb-3">storefront</span>
              <p>No outlets found.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {outlets.map((outlet) => {
              const budget = budgets[outlet._id];
              const spend = spendData[outlet._id] || { procurement: 0, orders: 0 };
              const procurPct = usagePercent(spend.procurement, budget?.procurementLimit);
              const threshold = budget?.alertThreshold ?? 80;

              return (
                <Card key={outlet._id}>
                  <div className="space-y-4">
                    {/* Outlet header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{outlet.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {outlet.location?.city} · {outlet.businessType}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="text-sm py-1 px-3" onClick={() => openModal(outlet)}>
                          <span className="material-icons-outlined text-sm">
                            {budget ? 'edit' : 'add'}
                          </span>
                          {budget ? 'Edit' : 'Set Budget'}
                        </Button>
                        {budget && (
                          <Button variant="danger" className="text-sm py-1 px-3" onClick={() => handleDelete(outlet)}>
                            <span className="material-icons-outlined text-sm">delete</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {budget ? (
                      <>
                        {/* Budget stats */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Procurement Limit</p>
                            <p className="font-semibold text-slate-900 dark:text-white mt-1">
                              {formatCurrency(budget.procurementLimit)}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 capitalize">{budget.period}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Per-Order Cap</p>
                            <p className="font-semibold text-slate-900 dark:text-white mt-1">
                              {formatCurrency(budget.perOrderLimit)}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Sales Target</p>
                            <p className="font-semibold text-slate-900 dark:text-white mt-1">
                              {formatCurrency(budget.salesTarget)}
                            </p>
                          </div>
                        </div>

                        {/* Spend progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Procurement spend</span>
                            <span>
                              {formatCurrency(spend.procurement)} / {formatCurrency(budget.procurementLimit)}
                              {' '}({procurPct}%)
                            </span>
                          </div>
                          <ProgressBar percent={procurPct} threshold={threshold} />
                        </div>

                        {/* Badges */}
                        <div className="flex gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            procurPct >= 100
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : procurPct >= threshold
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {procurPct >= 100 ? '⛔ Budget Exceeded' : procurPct >= threshold ? `⚠️ Alert at ${threshold}%` : '✅ Within Budget'}
                          </span>
                          {budget.blockOnExceed && (
                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              🔒 Hard Block On Exceed
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
                        No budget configured for this outlet
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={`${budgets[editingOutlet?._id] ? 'Edit' : 'Set'} Budget — ${editingOutlet?.name ?? ''}`}
        size="md"
      >
        <div className="space-y-5">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              <span className="material-icons-outlined text-sm">error</span>
              {formError}
            </div>
          )}

          <Select
            label="Budget Period"
            value={form.period}
            onChange={(e) => handleField('period', e.target.value)}
            options={periodOptions}
            placeholder=""
          />

          <Input
            label="Procurement Limit (₹)"
            type="number"
            placeholder="e.g. 50000"
            value={form.procurementLimit}
            onChange={(e) => handleField('procurementLimit', e.target.value)}
            min="1"
          />

          <Input
            label="Per-Order Cap (₹)"
            type="number"
            placeholder="e.g. 10000"
            value={form.perOrderLimit}
            onChange={(e) => handleField('perOrderLimit', e.target.value)}
            min="1"
          />

          <Input
            label="Sales Target (₹)"
            type="number"
            placeholder="e.g. 200000"
            value={form.salesTarget}
            onChange={(e) => handleField('salesTarget', e.target.value)}
            min="1"
          />

          <Input
            label={`Alert Threshold (%) — warn at ${form.alertThreshold}%`}
            type="number"
            placeholder="80"
            value={form.alertThreshold}
            onChange={(e) => handleField('alertThreshold', Number(e.target.value))}
            min="1"
            max="100"
          />

          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <input
              id="blockOnExceed"
              type="checkbox"
              checked={form.blockOnExceed}
              onChange={(e) => handleField('blockOnExceed', e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="blockOnExceed" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              Hard block procurement orders when budget is exceeded
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined text-sm">save</span>
                  Save Budget
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default BudgetConfig;
