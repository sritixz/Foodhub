import { useState, useEffect, useCallback } from 'react';
import { getMenuLeads, updateMenuLead } from '../../../services/leadsService';

const statusColors = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  converted: 'bg-green-100 text-green-700',
  dropped: 'bg-gray-100 text-gray-500',
};

const MenuLeadsTab = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editState, setEditState] = useState({});

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      const res = await getMenuLeads(filters);
      setLeads(res.data);
    } catch (error) {
      console.error('Error fetching menu leads:', error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSave = async (id) => {
    try {
      const payload = editState[id] || {};
      await updateMenuLead(id, payload);
      setEditState(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  const setField = (id, field, value) => {
    setEditState(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Date Submitted', 'Status', 'Notes'];
    const rows = leads.map(l => [
      l.name, l.phone, new Date(l.createdAt).toLocaleDateString(), l.status, l.notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu_leads.csv';
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
            placeholder="Search name or phone..."
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
            <option value="converted">Converted</option>
            <option value="dropped">Dropped</option>
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
      ) : leads.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No menu leads found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date Submitted</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Notes</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {leads.map(lead => (
                <tr key={lead._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{lead.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.phone}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={editState[lead._id]?.status ?? lead.status}
                      onChange={e => setField(lead._id, 'status', e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-lg border-0 outline-none ${statusColors[editState[lead._id]?.status ?? lead.status]}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                      <option value="dropped">Dropped</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={editState[lead._id]?.notes ?? lead.notes ?? ''}
                      onChange={e => setField(lead._id, 'notes', e.target.value)}
                      placeholder="Add notes..."
                      className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSave(lead._id)}
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

export default MenuLeadsTab;
