import { useState, useEffect, useCallback } from 'react';
import { getNewsletterSubscribers, updateNewsletterSubscriber } from '../../../services/leadsService';

const statusColors = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  unsubscribed: 'bg-gray-100 text-gray-500',
};

const NewsletterTab = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editState, setEditState] = useState({});

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      const res = await getNewsletterSubscribers(filters);
      setSubscribers(res.data);
    } catch (error) {
      console.error('Error fetching newsletter subscribers:', error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleSave = async (id) => {
    try {
      const payload = editState[id] || {};
      await updateNewsletterSubscriber(id, payload);
      setEditState(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
      fetchSubscribers();
    } catch (error) {
      console.error('Error updating subscriber:', error);
    }
  };

  const exportCSV = () => {
    const headers = ['Email', 'Date Subscribed', 'Status'];
    const rows = subscribers.map(s => [
      s.email, new Date(s.createdAt).toLocaleDateString(), s.status
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newsletter_subscribers.csv';
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
            placeholder="Search by email..."
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
            <option value="unsubscribed">Unsubscribed</option>
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
      ) : subscribers.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No newsletter subscribers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Date Subscribed</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {subscribers.map(sub => (
                <tr key={sub._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{sub.email}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(sub.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={editState[sub._id]?.status ?? sub.status}
                      onChange={e => setEditState(prev => ({ ...prev, [sub._id]: { status: e.target.value } }))}
                      className={`text-xs font-medium px-2 py-1 rounded-lg border-0 outline-none ${statusColors[editState[sub._id]?.status ?? sub.status] || 'bg-gray-100 text-gray-500'}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="unsubscribed">Unsubscribed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSave(sub._id)}
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

export default NewsletterTab;
