import { useEffect, useState } from 'react';
import Layout from '../../components/Layout/Layout';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import api from '../../utils/api';

const MakerCheckerApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comments, setComments] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('All');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/maker-checker/pending');
      setRequests(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending requests');
      console.error('Error fetching pending requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setActionSubmitting(true);
      setError('');
      setSuccess('');
      await api.post(`/maker-checker/${id}/approve`, { comments: comments || 'Approved via dashboard' });
      setSuccess('Request approved successfully!');
      setComments('');
      setSelectedRequest(null);
      await fetchPendingRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleReject = async (id) => {
    if (!comments.trim()) {
      setError('Please add a comment explaining the rejection');
      return;
    }
    try {
      setActionSubmitting(true);
      setError('');
      setSuccess('');
      await api.post(`/maker-checker/${id}/reject`, { comments });
      setSuccess('Request rejected successfully.');
      setComments('');
      setSelectedRequest(null);
      await fetchPendingRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setActionSubmitting(false);
    }
  };

  const getActionBadgeColor = (type) => {
    if (type.startsWith('CREATE')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    if (type.startsWith('UPDATE') || type.startsWith('TOGGLE')) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    if (type.startsWith('DELETE')) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
  };

  const filteredRequests = actionTypeFilter === 'All'
    ? requests
    : requests.filter(r => r.targetModel === actionTypeFilter);

  const renderDataDiff = (request) => {
    if (!request || !request.proposedData || !request.proposedData.body) return null;
    const body = request.proposedData.body;
    return (
      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 font-mono text-xs text-slate-700 dark:text-slate-300 space-y-1 overflow-x-auto max-h-60 custom-scrollbar">
        {Object.entries(body).map(([key, val]) => {
          if (typeof val === 'object' && val !== null) {
            return (
              <div key={key} className="pl-2">
                <span className="text-purple-600 dark:text-purple-400 font-semibold">{key}:</span>
                <pre className="pl-4 text-[10px] text-slate-500">{JSON.stringify(val, null, 2)}</pre>
              </div>
            );
          }
          return (
            <div key={key} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">{key}:</span>
              <span className="text-slate-800 dark:text-slate-200">{String(val)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Layout headerProps={{ title: 'Maker-Checker Approvals' }}>
      <div className="pb-8 space-y-6">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-500 font-bold">&times;</button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-emerald-500 font-bold">&times;</button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {['All', 'User', 'MenuItem', 'Inventory', 'DailyLedger'].map(category => (
              <button
                key={category}
                onClick={() => setActionTypeFilter(category)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border ${
                  actionTypeFilter === category
                    ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                    : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {category === 'All' ? 'All Requests' : category}
              </button>
            ))}
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {filteredRequests.length} pending requests found
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <div className="text-center py-12 text-slate-500">
                  <span className="material-icons-outlined text-4xl mb-2 text-slate-300">fact_check</span>
                  <p>No pending approvals matches the criteria.</p>
                </div>
              </Card>
            ) : (
              filteredRequests.map(request => (
                <div
                  key={request._id}
                  onClick={() => { setSelectedRequest(request); setComments(''); }}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedRequest?._id === request._id
                      ? 'ring-2 ring-primary scale-[1.01]'
                      : 'hover:scale-[1.005]'
                  }`}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getActionBadgeColor(request.actionType)}`}>
                            {request.actionType}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            ID: {request._id.substring(18)}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mt-2">
                          Modify {request.targetModel} {request.targetId ? `(ID: ${request.targetId.substring(18)})` : ''}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <span className="material-icons-outlined text-sm">person</span>
                          Maker: <span className="font-semibold text-slate-700 dark:text-slate-300">{request.maker?.name}</span> ({request.maker?.role})
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Requested</span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {new Date(request.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-1">
            {selectedRequest ? (
              <Card className="sticky top-6 border-slate-300 shadow-lg dark:border-slate-800">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Request Details</h3>
                    <p className="text-xs text-slate-400">Review the proposed data changes below.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block">Target Model</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedRequest.targetModel}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block">Action Type</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedRequest.actionType}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block">Requested By</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {selectedRequest.maker?.name} ({selectedRequest.maker?.role})
                      </span>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800" />

                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Proposed Changes</span>
                    {renderDataDiff(selectedRequest)}
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800" />

                  <div className="space-y-3">
                    <span className="text-xs text-slate-400 uppercase tracking-wider block">Review Comments</span>
                    <textarea
                      rows="3"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary text-slate-700 dark:text-slate-300"
                      placeholder="Add comments / reason for approval or rejection"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    ></textarea>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => handleReject(selectedRequest._id)}
                      disabled={actionSubmitting}
                    >
                      {actionSubmitting ? 'Rejecting...' : 'Reject'}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleApprove(selectedRequest._id)}
                      disabled={actionSubmitting}
                    >
                      {actionSubmitting ? 'Approving...' : 'Approve'}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 sticky top-6">
                <span className="material-icons-outlined text-4xl mb-2 text-slate-300">visibility</span>
                <p className="text-sm font-medium">Select a request on the left to view detail changes and take action.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MakerCheckerApprovals;
