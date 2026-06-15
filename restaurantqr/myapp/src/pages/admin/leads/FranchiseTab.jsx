import { useState, useEffect, useCallback } from 'react';
import { getFranchiseRequests, updateFranchiseRequest } from '../../../services/leadsService';
import api from '../../../utils/api';

const statusColors = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  negotiating: 'bg-orange-100 text-orange-700',
  converted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const FranchiseTab = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editState, setEditState] = useState({});
  const [users, setUsers] = useState([]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      const res = await getFranchiseRequests(filters);
      setRequests(res.data);
    } catch (error) {
      console.error('Error fetching franchise requests:', error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      const admins = res.data.filter(u => ['Admin', 'Company Admin'].includes(u.role));
      setUsers(admins);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, [fetchRequests]);

  const handleSave = async (id) => {
    try {
      const payload = editState[id] || {};
      await updateFranchiseRequest(id, payload);
      setEditState(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
      fetchRequests();
    } catch (error) {
      console.error('Error updating franchise request:', error);
    }
  };

  const setField = (id, field, value) => {
    setEditState(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'City', 'Message', 'Date', 'Status', 'Assigned To', 'Notes'];
    const rows = requests.map(r => [
      r.name, r.phone, r.city, r.message || '', new Date(r.createdAt).toLocaleDateString(),
      r.status, r.assignedTo?.name || '', r.notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'franchise_requests.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search name, city, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:border-primary outline-none"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="negotiating">Negotiating</option>
            <option value="converted">Converted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button
          onClick={exportCSV}
          className="h-9 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
        >
          <span className="material-icons-outlined text-sm">download</span> Export CSV
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No franchise requests found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">City</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Message</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Assigned To</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Notes</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {requests.map(req => (
                <tr key={req._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{req.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{req.phone}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{req.city}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[160px] truncate" title={req.message}>
                    {req.message ? (req.message.length > 60 ? req.message.slice(0, 60) + '...' : req.message) : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={editState[req._id]?.status ?? req.status}
                      onChange={e => setField(req._id, 'status', e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-lg border-0 outline-none ${statusColors[editState[req._id]?.status ?? req.status]}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="negotiating">Negotiating</option>
                      <option value="converted">Converted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={editState[req._id]?.assignedTo ?? req.assignedTo?._id ?? ''}
                      onChange={e => setField(req._id, 'assignedTo', e.target.value || null)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={editState[req._id]?.notes ?? req.notes ?? ''}
                      onChange={e => setField(req._id, 'notes', e.target.value)}
                      placeholder="Add notes..."
                      className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSave(req._id)}
                      className="text-xs font-medium px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FranchiseTab;
