import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

/* ── constants ── */
const CATEGORIES = ['Food', 'Travel', 'Office', 'Utilities', 'Salary', 'Bonus', 'Other'];
const PAYMENT_TYPES = ['employee_expense', 'vendor_payout', 'commission', 'refund', 'advance'];
const DISPUTE_TYPES = ['payout', 'commission', 'overcharge', 'underpayment', 'other'];
const PRIORITIES = ['Low', 'Medium', 'High'];

/* ── tiny helpers ── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDate(d);
};

const statusColors = {
  Pending:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Approved:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Paid:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Rejected:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Disputed:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Open:            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Under Review':  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Resolved:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Failed:          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const priorityColors = {
  Low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  High:   'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const Badge = ({ label, colorMap = statusColors }) => (
  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide ${colorMap[label] || 'bg-slate-100 text-slate-500'}`}>
    {label}
  </span>
);

const KpiCard = ({ label, value, sub, color = 'text-slate-900 dark:text-white', icon }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
    <div className="flex items-start justify-between mb-3">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      {icon && <span className={`material-icons-outlined text-sm ${color}`}>{icon}</span>}
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

/* ══════════════════════════════════════════
   EMPLOYEE TAB  — personal payments & history
══════════════════════════════════════════ */
const EmployeeTab = ({ user }) => {
  const [payments, setPayments] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reqModal, setReqModal] = useState(false);
  const [dispModal, setDispModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [reqForm, setReqForm] = useState({ amount: '', description: '', category: 'Food', receiptUrl: '' });
  const [dispForm, setDispForm] = useState({ title: '', description: '', type: 'other', priority: 'Medium', amount: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([
        api.get('/payments?limit=30'),
        api.get('/payments/disputes'),
      ]);
      setPayments(pRes.data.payments || []);
      setDisputes(dRes.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitRequest = async () => {
    if (!reqForm.amount || !reqForm.description) { setError('Amount and description required'); return; }
    setSaving(true);
    try {
      await api.post('/payments', { ...reqForm, amount: Number(reqForm.amount), type: 'employee_expense' });
      setReqModal(false);
      setReqForm({ amount: '', description: '', category: 'Food', receiptUrl: '' });
      await load();
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const submitDispute = async () => {
    if (!dispForm.title || !dispForm.description) { setError('Title and description required'); return; }
    setSaving(true);
    try {
      await api.post('/payments/disputes', { ...dispForm, amount: dispForm.amount ? Number(dispForm.amount) : null });
      setDispModal(false);
      setDispForm({ title: '', description: '', type: 'other', priority: 'Medium', amount: '' });
      await load();
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const totalPaid = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          <span className="material-icons-outlined text-sm">error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><span className="material-icons-outlined text-sm">close</span></button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Requests" value={payments.length} icon="receipt_long" />
        <KpiCard label="Paid Out" value={fmt(totalPaid)} color="text-green-600" icon="check_circle" />
        <KpiCard label="Pending" value={fmt(totalPending)} color="text-yellow-600" icon="hourglass_empty" />
        <KpiCard label="Open Disputes" value={disputes.filter(d => d.status === 'Open').length} color="text-red-500" icon="gavel" />
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => setReqModal(true)}>
          <span className="material-icons-outlined text-sm">add</span>New Payment Request
        </Button>
        <Button variant="outline" onClick={() => setDispModal(true)}>
          <span className="material-icons-outlined text-sm">gavel</span>Raise Dispute
        </Button>
      </div>

      {/* Payment history */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white">My Payment Requests</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No payment requests yet</div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {payments.map(p => (
              <div key={p._id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  p.category === 'Food' ? 'bg-orange-100 dark:bg-orange-900/30' :
                  p.category === 'Travel' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  'bg-slate-100 dark:bg-slate-800'
                }`}>
                  <span className={`material-icons-outlined text-sm ${
                    p.category === 'Food' ? 'text-orange-600' :
                    p.category === 'Travel' ? 'text-blue-600' : 'text-slate-500'
                  }`}>
                    {p.category === 'Food' ? 'restaurant' : p.category === 'Travel' ? 'directions_car' : 'receipt'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{p.description || '—'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.category} · {timeAgo(p.createdAt)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-slate-900 dark:text-white">{fmt(p.amount)}</p>
                  <div className="mt-1"><Badge label={p.status} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disputes */}
      {disputes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">My Disputes</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {disputes.map(d => (
              <div key={d._id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{d.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{d.type} · {timeAgo(d.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge label={d.priority} colorMap={priorityColors} />
                  <Badge label={d.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Modal */}
      <Modal isOpen={reqModal} onClose={() => setReqModal(false)} title="New Payment Request" size="sm">
        <div className="space-y-4">
          <Input label="Amount (₹) *" type="number" value={reqForm.amount} onChange={e => setReqForm({ ...reqForm, amount: e.target.value })} placeholder="0" min="1" />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
            <select className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent px-4 py-2 text-slate-900 dark:text-slate-100" value={reqForm.category} onChange={e => setReqForm({ ...reqForm, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Input label="Description *" value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} placeholder="What is this payment for?" />
          <Input label="Receipt URL (optional)" value={reqForm.receiptUrl} onChange={e => setReqForm({ ...reqForm, receiptUrl: e.target.value })} placeholder="https://..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setReqModal(false)} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={submitRequest} disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</Button>
          </div>
        </div>
      </Modal>

      {/* Dispute Modal */}
      <Modal isOpen={dispModal} onClose={() => setDispModal(false)} title="Raise a Dispute" size="sm">
        <div className="space-y-4">
          <Input label="Title *" value={dispForm.title} onChange={e => setDispForm({ ...dispForm, title: e.target.value })} placeholder="Brief summary" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
              <select className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent px-4 py-2 text-slate-900 dark:text-slate-100 text-sm" value={dispForm.type} onChange={e => setDispForm({ ...dispForm, type: e.target.value })}>
                {DISPUTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Priority</label>
              <select className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent px-4 py-2 text-slate-900 dark:text-slate-100 text-sm" value={dispForm.priority} onChange={e => setDispForm({ ...dispForm, priority: e.target.value })}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <Input label="Amount in dispute (optional)" type="number" value={dispForm.amount} onChange={e => setDispForm({ ...dispForm, amount: e.target.value })} placeholder="0" />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description *</label>
            <textarea className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" rows={3} placeholder="Explain the issue..." value={dispForm.description} onChange={e => setDispForm({ ...dispForm, description: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDispModal(false)} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={submitDispute} disabled={saving}>{saving ? 'Submitting...' : 'Submit Dispute'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ══════════════════════════════════════════
   COMPANY ADMIN TAB  — policies, approvals, reports
══════════════════════════════════════════ */
const CompanyAdminTab = () => {
  const [payments, setPayments] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [policyModal, setPolicyModal] = useState({ open: false, data: null });
  const [activeSection, setActiveSection] = useState('approvals'); // 'approvals' | 'policies' | 'reports'

  const [pForm, setPForm] = useState({
    name: '', monthlyLimit: '', singleTxLimit: '', requiresApproval: true,
    approvalThreshold: 0, allowedCategories: [...CATEGORIES], autoPayoutEnabled: false, autoPayoutDay: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, polRes] = await Promise.all([
        api.get('/payments?limit=50'),
        api.get('/payments/policies'),
      ]);
      setPayments(pRes.data.payments || []);
      setPolicies(polRes.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status, notes) => {
    try {
      await api.patch(`/payments/${id}/status`, { status, notes });
      setPayments(prev => prev.map(p => p._id === id ? { ...p, status } : p));
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
  };

  const openPolicyModal = (data = null) => {
    setPForm(data ? {
      name: data.name, monthlyLimit: data.monthlyLimit || '', singleTxLimit: data.singleTxLimit || '',
      requiresApproval: data.requiresApproval, approvalThreshold: data.approvalThreshold || 0,
      allowedCategories: data.allowedCategories || [...CATEGORIES],
      autoPayoutEnabled: data.autoPayoutEnabled || false, autoPayoutDay: data.autoPayoutDay || 1,
    } : { name: '', monthlyLimit: '', singleTxLimit: '', requiresApproval: true, approvalThreshold: 0, allowedCategories: [...CATEGORIES], autoPayoutEnabled: false, autoPayoutDay: 1 });
    setPolicyModal({ open: true, data });
  };

  const savePolicy = async () => {
    if (!pForm.name) { setError('Policy name required'); return; }
    setSaving(true);
    try {
      const payload = { ...pForm, monthlyLimit: pForm.monthlyLimit ? Number(pForm.monthlyLimit) : null, singleTxLimit: pForm.singleTxLimit ? Number(pForm.singleTxLimit) : null };
      if (policyModal.data) await api.put(`/payments/policies/${policyModal.data._id}`, payload);
      else await api.post('/payments/policies', payload);
      setPolicyModal({ open: false, data: null });
      await load();
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deletePolicy = async (id) => {
    if (!window.confirm('Delete this policy?')) return;
    try { await api.delete(`/payments/policies/${id}`); await load(); }
    catch (e) { setError(e.response?.data?.message || 'Failed'); }
  };

  const pending = payments.filter(p => p.status === 'Pending');
  const totalApproved = payments.filter(p => ['Approved', 'Paid'].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const totalRejected = payments.filter(p => p.status === 'Rejected').length;

  const toggleCategory = (cat) => {
    setPForm(prev => ({
      ...prev,
      allowedCategories: prev.allowedCategories.includes(cat)
        ? prev.allowedCategories.filter(c => c !== cat)
        : [...prev.allowedCategories, cat],
    }));
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          <span className="material-icons-outlined text-sm">error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><span className="material-icons-outlined text-sm">close</span></button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Pending Approvals" value={pending.length} color={pending.length > 0 ? 'text-yellow-600' : 'text-slate-900 dark:text-white'} icon="pending_actions" />
        <KpiCard label="Total Approved" value={fmt(totalApproved)} color="text-green-600" icon="verified" />
        <KpiCard label="Rejected" value={totalRejected} color="text-red-500" icon="cancel" />
        <KpiCard label="Active Policies" value={policies.filter(p => p.isActive).length} icon="policy" />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[['approvals', 'Approvals', pending.length], ['policies', 'Policies', null], ['reports', 'Reports', null]].map(([key, label, badge]) => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeSection === key ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            {label}
            {badge > 0 && <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>}
          </button>
        ))}
      </div>

      {/* Approvals */}
      {activeSection === 'approvals' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Payment Requests</h3>
            <span className="text-xs text-slate-400">{payments.length} total</span>
          </div>
          {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          : payments.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">No payment requests</div>
          : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {payments.map(p => (
                <div key={p._id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{p.description || '—'}</p>
                      <Badge label={p.category} colorMap={{}} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.requestedBy?.name || '—'} · {timeAgo(p.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-slate-900 dark:text-white">{fmt(p.amount)}</span>
                    <Badge label={p.status} />
                    {p.status === 'Pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(p._id, 'Approved')} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 hover:bg-green-100 transition-colors">Approve</button>
                        <button onClick={() => updateStatus(p._id, 'Rejected')} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 hover:bg-red-100 transition-colors">Reject</button>
                      </div>
                    )}
                    {p.status === 'Approved' && (
                      <button onClick={() => updateStatus(p._id, 'Paid')} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">Mark Paid</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Policies */}
      {activeSection === 'policies' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openPolicyModal()}>
              <span className="material-icons-outlined text-sm">add</span>New Policy
            </Button>
          </div>
          {policies.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="material-icons-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-2">policy</span>
              <p className="text-sm text-slate-400">No policies yet. Create one to set spending limits for employees.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map(pol => (
                <div key={pol._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{pol.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{pol.organization || 'Global'}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${pol.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{pol.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {pol.monthlyLimit && <p className="flex items-center gap-1.5"><span className="material-icons-outlined text-[13px]">calendar_month</span>Monthly limit: <span className="font-semibold text-slate-900 dark:text-white">{fmt(pol.monthlyLimit)}</span></p>}
                    {pol.singleTxLimit && <p className="flex items-center gap-1.5"><span className="material-icons-outlined text-[13px]">payment</span>Per transaction: <span className="font-semibold text-slate-900 dark:text-white">{fmt(pol.singleTxLimit)}</span></p>}
                    <p className="flex items-center gap-1.5"><span className="material-icons-outlined text-[13px]">approval</span>Approval {pol.requiresApproval ? `required above ${fmt(pol.approvalThreshold)}` : 'not required'}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => openPolicyModal(pol)} className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400">Edit</button>
                    <button onClick={() => deletePolicy(pol._id)} className="text-xs py-1.5 px-3 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports */}
      {activeSection === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[['Food', payments.filter(p => p.category === 'Food')], ['Travel', payments.filter(p => p.category === 'Travel')], ['Office', payments.filter(p => p.category === 'Office')], ['Other', payments.filter(p => !['Food', 'Travel', 'Office'].includes(p.category))]].map(([cat, items]) => (
            <div key={cat} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-900 dark:text-white">{cat}</h4>
                <span className="text-xs text-slate-400">{items.length} requests</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(items.reduce((s, p) => s + p.amount, 0))}</p>
              <div className="flex gap-3 mt-2 text-xs text-slate-500">
                <span className="text-green-600">{fmt(items.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0))} paid</span>
                <span className="text-yellow-600">{fmt(items.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0))} pending</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Policy Modal */}
      <Modal isOpen={policyModal.open} onClose={() => setPolicyModal({ open: false, data: null })} title={policyModal.data ? 'Edit Policy' : 'New Payment Policy'} size="md">
        <div className="space-y-4">
          <Input label="Policy Name *" value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} placeholder="e.g. Standard Employee Policy" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Monthly Limit (₹)" type="number" value={pForm.monthlyLimit} onChange={e => setPForm({ ...pForm, monthlyLimit: e.target.value })} placeholder="Leave blank for unlimited" />
            <Input label="Per-Transaction Limit (₹)" type="number" value={pForm.singleTxLimit} onChange={e => setPForm({ ...pForm, singleTxLimit: e.target.value })} placeholder="Leave blank for unlimited" />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Require Approval</p>
              <p className="text-xs text-slate-400 mt-0.5">Requests need admin sign-off</p>
            </div>
            <button onClick={() => setPForm({ ...pForm, requiresApproval: !pForm.requiresApproval })} className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors ${pForm.requiresApproval ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${pForm.requiresApproval ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {pForm.requiresApproval && (
            <Input label="Auto-approve threshold (₹ — 0 means all require approval)" type="number" value={pForm.approvalThreshold} onChange={e => setPForm({ ...pForm, approvalThreshold: Number(e.target.value) })} />
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Allowed Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => toggleCategory(cat)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${pForm.allowedCategories.includes(cat) ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>{cat}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPolicyModal({ open: false, data: null })} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={savePolicy} disabled={saving}>{saving ? 'Saving...' : policyModal.data ? 'Save Changes' : 'Create Policy'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ══════════════════════════════════════════
   ADMIN / OWNER TAB  — payouts, commissions, disputes
══════════════════════════════════════════ */
const AdminTab = () => {
  const [payouts, setPayouts] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState('payouts'); // 'payouts' | 'disputes'
  const [payoutModal, setPayoutModal] = useState(false);
  const [disputeDetailModal, setDisputeDetailModal] = useState({ open: false, dispute: null });
  const [commentText, setCommentText] = useState('');
  const [commModal, setCommModal] = useState({ open: false, outlet: null });
  const [commRate, setCommRate] = useState('');

  const [poForm, setPoForm] = useState({ vendorId: '', periodStart: '', periodEnd: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, dispRes, outRes, sumRes] = await Promise.all([
        api.get('/payments/payouts?limit=50'),
        api.get('/payments/disputes'),
        api.get('/outlets'),
        api.get('/payments/summary?period=month').catch(() => ({ data: null })),
      ]);
      setPayouts(poRes.data || []);
      setDisputes(dispRes.data || []);
      setOutlets(outRes.data || []);
      setSummary(sumRes.data);
    } catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* payout actions */
  const createPayout = async () => {
    if (!poForm.vendorId || !poForm.periodStart || !poForm.periodEnd) {
      setError('Vendor and date range required'); return;
    }
    setSaving(true);
    try {
      await api.post('/payments/payouts', { ...poForm });
      setPayoutModal(false);
      setPoForm({ vendorId: '', periodStart: '', periodEnd: '', notes: '' });
      await load();
    } catch (e) { setError(e.response?.data?.message || 'Failed to create payout'); }
    finally { setSaving(false); }
  };

  const updatePayoutStatus = async (id, status) => {
    try {
      const updated = await api.patch(`/payments/payouts/${id}/status`, { status });
      setPayouts(prev => prev.map(p => p._id === id ? updated.data : p));
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
  };

  /* dispute actions */
  const openDisputeDetail = async (dispute) => {
    setDisputeDetailModal({ open: true, dispute });
    setCommentText('');
  };

  const updateDispute = async (id, updates) => {
    try {
      const res = await api.patch(`/payments/disputes/${id}`, updates);
      setDisputes(prev => prev.map(d => d._id === id ? res.data : d));
      if (disputeDetailModal.dispute?._id === id) {
        setDisputeDetailModal({ open: true, dispute: res.data });
      }
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
  };

  const addComment = async (id) => {
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/payments/disputes/${id}/comment`, { text: commentText });
      setCommentText('');
      setDisputeDetailModal({ open: true, dispute: res.data });
      setDisputes(prev => prev.map(d => d._id === id ? res.data : d));
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
  };

  /* commission */
  const openCommModal = (outlet) => {
    setCommRate(String(outlet.commissionRate || 0));
    setCommModal({ open: true, outlet });
  };

  const saveCommission = async () => {
    if (commRate === '' || Number(commRate) < 0 || Number(commRate) > 100) {
      setError('Commission must be 0–100'); return;
    }
    setSaving(true);
    try {
      await api.patch(`/vendors/${commModal.outlet._id}/commission`, { commissionRate: Number(commRate) });
      setOutlets(prev => prev.map(o => o._id === commModal.outlet._id ? { ...o, commissionRate: Number(commRate) } : o));
      setCommModal({ open: false, outlet: null });
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  /* summary numbers */
  const totalPaid   = payouts.filter(p => p.status === 'Paid').reduce((s, p) => s + p.netPayout, 0);
  const totalPending = payouts.filter(p => p.status === 'Pending').reduce((s, p) => s + p.netPayout, 0);
  const openDisputes = disputes.filter(d => d.status === 'Open').length;

  const payoutStatusBtns = {
    Pending:    { next: 'Processing', label: 'Process', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
    Processing: { next: 'Paid',       label: 'Mark Paid', cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          <span className="material-icons-outlined text-sm">error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><span className="material-icons-outlined text-sm">close</span></button>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Paid Out (month)" value={fmt(totalPaid)} color="text-green-600" icon="paid" sub={`${payouts.filter(p => p.status === 'Paid').length} payouts`} />
        <KpiCard label="Pending Payouts" value={fmt(totalPending)} color="text-yellow-600" icon="hourglass_empty" sub={`${payouts.filter(p => p.status === 'Pending').length} vendors`} />
        <KpiCard label="Open Disputes" value={openDisputes} color={openDisputes > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'} icon="gavel" />
        <KpiCard label="Active Vendors" value={outlets.length} icon="storefront" />
      </div>

      {/* Sub-nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {[['payouts', 'Vendor Payouts'], ['commissions', 'Commissions'], ['disputes', 'Disputes']].map(([key, label]) => (
            <button key={key} onClick={() => setSection(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${section === key ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              {label}
              {key === 'disputes' && openDisputes > 0 && (
                <span className="ml-1.5 w-4 h-4 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{openDisputes}</span>
              )}
            </button>
          ))}
        </div>
        {section === 'payouts' && (
          <Button onClick={() => setPayoutModal(true)}>
            <span className="material-icons-outlined text-sm">add</span>Create Payout
          </Button>
        )}
      </div>

      {/* ── Payouts section ── */}
      {section === 'payouts' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Vendor Payouts</h3>
            <span className="text-xs text-slate-400">{payouts.length} records</span>
          </div>
          {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          : payouts.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">No payouts yet</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left">
                    {['Vendor', 'Period', 'Gross', 'Commission', 'Net Payout', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {payouts.map(po => (
                    <tr key={po._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{po.vendor?.name || '—'}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">
                        {fmtDate(po.periodStart)} – {fmtDate(po.periodEnd)}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{fmt(po.grossRevenue)}</td>
                      <td className="px-5 py-4 text-red-500">-{fmt(po.commissionAmount)} <span className="text-xs text-slate-400">({po.commissionRate}%)</span></td>
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">{fmt(po.netPayout)}</td>
                      <td className="px-5 py-4"><Badge label={po.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 items-center">
                          {payoutStatusBtns[po.status] && (
                            <button onClick={() => updatePayoutStatus(po._id, payoutStatusBtns[po.status].next)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${payoutStatusBtns[po.status].cls}`}>
                              {payoutStatusBtns[po.status].label}
                            </button>
                          )}
                          {po.status === 'Processing' && (
                            <button onClick={() => updatePayoutStatus(po._id, 'Failed')}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 hover:opacity-90 transition-colors">
                              Fail
                            </button>
                          )}
                          {po.paidAt && <span className="text-xs text-slate-400">{fmtDate(po.paidAt)}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Commissions section ── */}
      {section === 'commissions' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">Commission Rates</h3>
            <p className="text-xs text-slate-400 mt-0.5">Set the platform commission % per vendor outlet</p>
          </div>
          {outlets.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">No outlets found</div>
          : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {outlets.map(outlet => (
                <div key={outlet._id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">{outlet.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{outlet.location?.city || ''} · {outlet.businessType || ''}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{outlet.commissionRate || 0}%</p>
                      <p className="text-xs text-slate-400">commission</p>
                    </div>
                    <button onClick={() => openCommModal(outlet)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <span className="material-icons-outlined text-sm text-slate-500">edit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Disputes section ── */}
      {section === 'disputes' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">Dispute Management</h3>
          </div>
          {disputes.length === 0 ? <div className="text-center py-12 text-slate-400 text-sm">No disputes raised</div>
          : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {disputes.map(d => (
                <div key={d._id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${d.priority === 'High' ? 'bg-red-100 dark:bg-red-900/30' : d.priority === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <span className={`material-icons-outlined text-sm ${d.priority === 'High' ? 'text-red-600' : d.priority === 'Medium' ? 'text-yellow-600' : 'text-slate-500'}`}>gavel</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{d.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {d.raisedBy?.name || '—'} · {d.raisedBy?.role || ''} · {timeAgo(d.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {d.amount && <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(d.amount)}</span>}
                    <Badge label={d.priority} colorMap={priorityColors} />
                    <Badge label={d.status} />
                    <button onClick={() => openDisputeDetail(d)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <span className="material-icons-outlined text-sm text-slate-500">open_in_full</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Payout Modal ── */}
      <Modal isOpen={payoutModal} onClose={() => setPayoutModal(false)} title="Create Vendor Payout" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Vendor *</label>
            <select className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent px-4 py-2 text-slate-900 dark:text-slate-100"
              value={poForm.vendorId} onChange={e => setPoForm({ ...poForm, vendorId: e.target.value })}>
              <option value="">Select vendor</option>
              {outlets.map(o => <option key={o._id} value={o._id}>{o.name} ({o.commissionRate || 0}% commission)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Period Start *" type="date" value={poForm.periodStart} onChange={e => setPoForm({ ...poForm, periodStart: e.target.value })} />
            <Input label="Period End *" type="date" value={poForm.periodEnd} onChange={e => setPoForm({ ...poForm, periodEnd: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Notes (optional)</label>
            <textarea className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-transparent focus:ring-2 focus:ring-primary/20 outline-none resize-none" rows={2}
              value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })} placeholder="Payment reference, bank details..." />
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
            <span className="material-icons-outlined text-sm flex-shrink-0">info</span>
            Revenue is calculated from delivered orders in the selected period, minus the vendor's commission rate.
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPayoutModal(false)} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={createPayout} disabled={saving}>{saving ? 'Calculating...' : 'Create Payout'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Dispute Detail Modal ── */}
      <Modal isOpen={disputeDetailModal.open} onClose={() => setDisputeDetailModal({ open: false, dispute: null })} title={`Dispute: ${disputeDetailModal.dispute?.title || ''}`} size="lg">
        {disputeDetailModal.dispute && (() => {
          const d = disputeDetailModal.dispute;
          return (
            <div className="space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['Type', d.type], ['Priority', d.priority], ['Status', d.status], ['Raised by', d.raisedBy?.name]].map(([label, val]) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize mt-0.5">{val || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Description</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{d.description}</p>
                {d.amount && <p className="text-sm font-semibold text-slate-900 dark:text-white mt-2">Amount in dispute: {fmt(d.amount)}</p>}
              </div>

              {/* Admin actions */}
              {d.status !== 'Resolved' && d.status !== 'Rejected' && (
                <div className="flex flex-wrap gap-2">
                  {d.status === 'Open' && (
                    <button onClick={() => updateDispute(d._id, { status: 'Under Review' })}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 hover:opacity-90">
                      Start Review
                    </button>
                  )}
                  <button onClick={() => updateDispute(d._id, { status: 'Resolved', resolution: 'Resolved by admin' })}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 hover:opacity-90">
                    Mark Resolved
                  </button>
                  <button onClick={() => updateDispute(d._id, { status: 'Rejected' })}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 hover:opacity-90">
                    Reject
                  </button>
                </div>
              )}
              {d.resolution && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
                  <span className="font-semibold">Resolution:</span> {d.resolution}
                </div>
              )}

              {/* Comments */}
              <div>
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">Comments ({d.comments?.length || 0})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                  {d.comments?.length === 0 && <p className="text-xs text-slate-400">No comments yet</p>}
                  {d.comments?.map((c, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{(c.author?.name || 'U')[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{c.author?.name || '—'}</span>
                          <span className="text-xs text-slate-400">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-transparent focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addComment(d._id)} />
                  <Button onClick={() => addComment(d._id)} disabled={!commentText.trim()}>
                    <span className="material-icons-outlined text-sm">send</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Commission Edit Modal ── */}
      <Modal isOpen={commModal.open} onClose={() => setCommModal({ open: false, outlet: null })} title={`Commission — ${commModal.outlet?.name}`} size="sm">
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
            <p className="text-xs text-slate-400 mb-1">Current rate</p>
            <p className="text-3xl font-black text-primary">{commModal.outlet?.commissionRate || 0}%</p>
          </div>
          <Input label="New Commission Rate (%)" type="number" value={commRate} onChange={e => setCommRate(e.target.value)} min="0" max="100" placeholder="0–100" />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCommModal({ open: false, outlet: null })} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={saveCommission} disabled={saving}>{saving ? 'Saving...' : 'Update Rate'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ══════════════════════════════════════════
   ROOT COMPONENT
══════════════════════════════════════════ */
const PaymentModule = () => {
  const { user } = useAuth();
  const role = user?.role;

  // Determine which tabs this role can see
  const isAdmin        = ['Admin', 'Owner'].includes(role);
  const isCompanyAdmin = ['Company Admin', 'Management'].includes(role);
  const isEmployee     = ['Employee', 'Customer'].includes(role);

  // Default active tab per role
  const defaultTab = isAdmin ? 'admin' : isCompanyAdmin ? 'company' : 'employee';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = [
    ...(isEmployee || isAdmin || isCompanyAdmin ? [{ id: 'employee', label: 'My Payments', icon: 'person' }] : []),
    ...(isCompanyAdmin || isAdmin ? [{ id: 'company', label: 'Policy & Approvals', icon: 'corporate_fare' }] : []),
    ...(isAdmin ? [{ id: 'admin', label: 'Payouts & Disputes', icon: 'account_balance' }] : []),
  ];

  return (
    <Layout headerProps={{ title: 'Payment Module' }}>
      <div className="p-6 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Payments</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isAdmin && 'Manage vendor payouts, commissions, employee expenses and disputes'}
              {isCompanyAdmin && 'Review employee payment requests and manage spending policies'}
              {isEmployee && 'Submit expense requests and track your payment history'}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        {tabs.length > 1 && (
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <span className="material-icons-outlined text-[16px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'employee' && <EmployeeTab user={user} />}
        {activeTab === 'company' && <CompanyAdminTab />}
        {activeTab === 'admin'   && <AdminTab />}
      </div>
    </Layout>
  );
};

export default PaymentModule;
