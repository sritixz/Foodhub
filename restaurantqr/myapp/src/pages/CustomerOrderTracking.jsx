import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Standalone public API — no auth required
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

const PAYMENT_ICONS = {
  upi: 'account_balance_wallet',
  card: 'credit_card',
  netbanking: 'account_balance',
  cash: 'payments',
};

const StatusStep = ({ step, index, total, timelineMap }) => {
  const entry = timelineMap[step.status];
  return (
    <div className="flex items-start gap-4 mb-4 last:mb-0">
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
          step.isCancelled
            ? 'bg-red-500 border-red-500 text-white'
            : step.completed
              ? 'bg-primary border-primary text-white'
              : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400'
        }`}>
          {step.isCancelled ? (
            <span className="material-icons-outlined text-sm">close</span>
          ) : step.completed ? (
            <span className="material-icons-outlined text-sm">check</span>
          ) : (
            <span className="text-sm font-bold">{index + 1}</span>
          )}
        </div>
        {index < total - 1 && (
          <div className={`w-0.5 h-10 mt-1 ${step.completed ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
        )}
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center justify-between">
          <span className={`font-semibold text-sm ${
            step.isCancelled ? 'text-red-600' : step.completed ? 'text-slate-900 dark:text-white' : 'text-slate-400'
          }`}>{step.label}</span>
          {entry && (
            <span className="text-xs text-slate-400">
              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {entry?.note && (
          <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
            <span className="material-icons-outlined text-[12px]">schedule</span>
            {entry.note}
          </p>
        )}
      </div>
    </div>
  );
};

const StarRating = ({ value, onChange, size = 'md' }) => {
  const [hovered, setHovered] = useState(0);
  const sz = size === 'sm' ? 'text-xl' : 'text-3xl';
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={`${sz} transition-colors ${
            star <= (hovered || value) ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

const RatingModal = ({ order, onClose, onSubmit }) => {
  const [orderRating, setOrderRating] = useState(0);
  const [orderComment, setOrderComment] = useState('');
  const [itemRatings, setItemRatings] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleItemRating = (itemId, rating) => {
    setItemRatings(prev => ({ ...prev, [itemId]: { ...prev[itemId], rating } }));
  };
  const handleItemComment = (itemId, comment) => {
    setItemRatings(prev => ({ ...prev, [itemId]: { ...prev[itemId], comment } }));
  };

  const handleSubmit = async () => {
    if (!orderRating) { setError('Please rate your overall experience'); return; }
    setSubmitting(true);
    try {
      await onSubmit({ orderRating, orderComment, itemRatings });
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="font-black text-lg text-slate-900 dark:text-white">Rate Your Order</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
            <span className="material-icons-outlined text-sm">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Overall order rating */}
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Overall Experience</p>
            <StarRating value={orderRating} onChange={setOrderRating} />
            <textarea
              className="mt-3 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-transparent focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              rows={2}
              placeholder="Tell us about your experience (optional)"
              value={orderComment}
              onChange={e => setOrderComment(e.target.value)}
            />
          </div>

          {/* Per-item ratings */}
          {order.items?.length > 0 && (
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Rate Individual Items</p>
              <div className="space-y-4">
                {order.items.map((item, idx) => {
                  const id = item.menuItem?._id || idx;
                  return (
                    <div key={id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        {item.menuItem?.image && (
                          <img src={item.menuItem.image} alt={item.menuItem.name} className="w-10 h-10 object-cover rounded-lg" />
                        )}
                        <div>
                          <p className="font-medium text-sm text-slate-900 dark:text-white">{item.menuItem?.name || 'Item'}</p>
                          {item.variant && <p className="text-xs text-slate-500">{item.variant}</p>}
                        </div>
                      </div>
                      <StarRating
                        value={itemRatings[id]?.rating || 0}
                        onChange={(r) => handleItemRating(id, r)}
                        size="sm"
                      />
                      <input
                        className="mt-2 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-transparent outline-none focus:ring-1 focus:ring-primary/20"
                        placeholder="Comment on this item (optional)"
                        value={itemRatings[id]?.comment || ''}
                        onChange={e => handleItemComment(id, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-primary text-white font-black text-base rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomerOrderTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchOrder();
    const cleanup = setupSSE();
    return cleanup;
  }, [id]);

  // Auto-show rating modal when delivered (once)
  useEffect(() => {
    if (order?.status === 'Delivered' && !ratingSubmitted && !order?.customerRating) {
      const timer = setTimeout(() => setShowRatingModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [order?.status, ratingSubmitted]);

  const fetchOrder = async () => {
    try {
      const res = await publicApi.get(`/orders/${id}`);
      setOrder(res.data);
    } catch {
      setError('Could not load your order. Please check the link.');
    } finally {
      setLoading(false);
    }
  };

  const setupSSE = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    let es;
    try {
      es = new EventSource(`${API_URL}/orders/stream`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'order_update' && data.order._id === id) {
            setOrder(data.order);
          }
        } catch {}
      };
      es.onerror = () => es.close();
    } catch {}
    return () => es?.close();
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      const res = await publicApi.patch(`/orders/${id}/cancel`);
      setOrder(res.data);
      setShowCancelConfirm(false);
    } catch {
      alert('Unable to cancel. The order may already be in progress.');
    } finally {
      setCancelling(false);
    }
  };

  const handleRatingSubmit = async ({ orderRating, orderComment, itemRatings }) => {
    await publicApi.post(`/orders/${id}/rating`, {
      orderRating,
      orderComment,
      itemRatings: Object.entries(itemRatings).map(([menuItemId, data]) => ({
        menuItemId,
        rating: data.rating,
        comment: data.comment || '',
      })),
    });
    setRatingSubmitted(true);
    setOrder(prev => prev ? { ...prev, customerRating: orderRating } : prev);
  };

  const getStatusSteps = () => {
    if (order?.status === 'Cancelled') {
      return [
        { label: 'Order Placed', status: 'New', completed: true, isCancelled: false },
        { label: 'Cancelled', status: 'Cancelled', completed: true, isCancelled: true },
      ];
    }
    const steps = [
      { label: 'Order Placed', status: 'New' },
      { label: 'Preparing', status: 'Preparing' },
      { label: 'Ready', status: 'Ready' },
      ...(order?.deliveryMode === 'Delivery' ? [
        { label: 'Picked Up', status: 'Picked' },
        { label: 'On the Way', status: 'In Transit' },
      ] : []),
      { label: 'Delivered', status: 'Delivered' },
    ];
    const currentIndex = steps.findIndex(s => s.status === order?.status);
    return steps.map((s, i) => ({
      ...s,
      completed: i <= currentIndex,
      isCancelled: false,
    }));
  };

  const getCountdown = () => {
    if (!order?.estimatedReadyTime) return null;
    const diff = new Date(order.estimatedReadyTime) - now;
    if (diff <= 0) return 'Any moment now';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  const paymentMethodLabel = {
    upi: 'UPI',
    card: 'Card',
    netbanking: 'Net Banking',
    cash: 'Cash',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500 text-sm">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <span className="material-icons-outlined text-6xl text-slate-300 mb-4 block">receipt_long</span>
          <h2 className="font-black text-xl text-slate-800 dark:text-white mb-2">Order Not Found</h2>
          <p className="text-slate-500 text-sm">{error || 'We could not find this order.'}</p>
          <button onClick={() => navigate('/qr/scan')} className="mt-6 px-6 py-2 bg-primary text-white rounded-xl font-semibold text-sm">
            Scan a QR Code
          </button>
        </div>
      </div>
    );
  }

  const total = order.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;
  const statusSteps = getStatusSteps();
  const timelineMap = {};
  (order.statusTimeline || []).forEach(e => { timelineMap[e.status] = e; });
  const countdown = getCountdown();
  const isCountdownActive = order.estimatedReadyTime && new Date(order.estimatedReadyTime) > now;
  const canCancel = !['Delivered', 'Cancelled', 'Preparing', 'Ready', 'Picked', 'In Transit'].includes(order.status);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-icons-outlined text-primary text-lg">restaurant</span>
            </div>
            <div>
              <p className="font-black text-sm text-slate-900 dark:text-white uppercase">
                {order.vendor?.name || 'Your Order'}
              </p>
              <p className="text-xs text-slate-400">#{(order.orderId || order._id).slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
            order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
            order.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
            'bg-primary/10 text-primary'
          }`}>
            {order.status}
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Countdown banner */}
        {order.estimatedReadyTime && !['Delivered', 'Cancelled'].includes(order.status) && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
            isCountdownActive
              ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          }`}>
            <span className={`material-icons-outlined text-2xl ${isCountdownActive ? 'text-orange-500' : 'text-green-500'}`}>
              {isCountdownActive ? 'timer' : 'check_circle'}
            </span>
            <div>
              <p className={`text-xs font-semibold ${isCountdownActive ? 'text-orange-600' : 'text-green-600'}`}>
                {isCountdownActive ? 'Estimated time remaining' : 'Ready soon'}
              </p>
              <p className={`text-2xl font-black tabular-nums ${isCountdownActive ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'}`}>
                {countdown}
              </p>
            </div>
          </div>
        )}

        {/* Rating prompt */}
        {order.status === 'Delivered' && !order.customerRating && !ratingSubmitted && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">How was your order?</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Share your experience</p>
            </div>
            <button
              onClick={() => setShowRatingModal(true)}
              className="px-4 py-2 bg-yellow-500 text-white rounded-xl text-xs font-black shadow-sm"
            >
              Rate Now
            </button>
          </div>
        )}

        {(order.status === 'Delivered' && ratingSubmitted) && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-4 flex items-center gap-3">
            <span className="material-icons-outlined text-green-600 text-2xl">check_circle</span>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Thanks for your rating!</p>
          </div>
        )}

        {/* Status Timeline */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-5">Order Status</h3>
          {statusSteps.map((step, i) => (
            <StatusStep key={step.status} step={step} index={i} total={statusSteps.length} timelineMap={timelineMap} />
          ))}
        </div>

        {/* Order Items */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-4">Items Ordered</h3>
          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {item.menuItem?.image && (
                    <img src={item.menuItem.image} alt={item.menuItem?.name} className="w-10 h-10 object-cover rounded-lg" />
                  )}
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{item.menuItem?.name || 'Item'}</p>
                    {item.variant && <p className="text-xs text-slate-400">{item.variant}</p>}
                    <p className="text-xs text-slate-400">× {item.quantity}</p>
                  </div>
                </div>
                <span className="font-bold text-sm">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            {order.isBulk && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="material-icons-outlined text-blue-500 text-sm">inventory</span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Bulk Order</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="font-black text-sm uppercase text-slate-500">Total</span>
            <span className="font-black text-xl text-primary">₹{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Info */}
        {order.paymentMethod && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-3">Payment</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <span className="material-icons-outlined text-green-600 text-lg">
                  {PAYMENT_ICONS[order.paymentMethod] || 'payment'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">
                  {paymentMethodLabel[order.paymentMethod] || order.paymentMethod}
                </p>
                <p className={`text-xs font-semibold ${order.paymentStatus === 'Paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {order.paymentStatus || 'Pending'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Info */}
        {(order.deliveryAddress || order.notes || order.assignedTo) && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-3">Delivery</h3>
            <div className="space-y-2 text-sm">
              {order.assignedTo && (
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined text-slate-400 text-base">delivery_dining</span>
                  <span className="text-slate-700 dark:text-slate-300">{order.assignedTo.name}</span>
                  {order.assignedTo.phone && <span className="text-slate-400">· {order.assignedTo.phone}</span>}
                </div>
              )}
              {order.deliveryAddress && (
                <div className="flex items-start gap-2">
                  <span className="material-icons-outlined text-slate-400 text-base">location_on</span>
                  <span className="text-slate-700 dark:text-slate-300">{order.deliveryAddress}</span>
                </div>
              )}
              {order.notes && (
                <div className="flex items-start gap-2">
                  <span className="material-icons-outlined text-slate-400 text-base">notes</span>
                  <span className="text-slate-500">{order.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cancel button */}
        {canCancel && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-600 font-black text-sm uppercase tracking-widest hover:bg-red-50 transition-colors"
          >
            Cancel Order
          </button>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          Order placed {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Cancel Confirm */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-lg mb-2 text-slate-900 dark:text-white">Cancel Order?</h3>
            <p className="text-sm text-slate-500 mb-6">This cannot be undone. Only possible before the restaurant starts preparing.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-sm">
                Keep It
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-sm disabled:opacity-60"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <RatingModal
          order={order}
          onClose={() => setShowRatingModal(false)}
          onSubmit={handleRatingSubmit}
        />
      )}
    </div>
  );
};

export default CustomerOrderTracking;
