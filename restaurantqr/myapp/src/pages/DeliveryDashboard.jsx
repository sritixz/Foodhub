import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Roles that are allowed to see customer contact details
const CONTACT_ALLOWED_ROLES = ['Admin', 'Company Admin', 'Vendor', 'Delivery Staff'];

const STATUS_BADGE = {
  New:         'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Preparing:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Ready:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Picked:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'In Transit':'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Delivered:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Cancelled:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// Small popover that appears below the "View Contact" button
const ContactPopover = ({ order, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const phone = order.customer?.phone;
  const address = order.deliveryAddress;
  const notes = order.notes;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-30 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3"
    >
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Customer Contact</p>

      {phone ? (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <span className="material-icons-outlined text-green-600 text-sm">phone</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Phone</p>
            <a
              href={`tel:${phone}`}
              className="text-sm font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors"
            >
              {phone}
            </a>
          </div>
          <a
            href={`tel:${phone}`}
            className="p-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 transition-colors"
            title="Call"
          >
            <span className="material-icons-outlined text-green-600 text-sm">call</span>
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <span className="material-icons-outlined text-sm">phone_disabled</span>
          No phone provided
        </div>
      )}

      {address ? (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="material-icons-outlined text-blue-600 text-sm">location_on</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Delivery Address</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{address}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <span className="material-icons-outlined text-sm">location_off</span>
          No address provided
        </div>
      )}

      {notes && (
        <div className="flex items-start gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="material-icons-outlined text-yellow-600 text-sm">notes</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Delivery Notes</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug">{notes}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const OrderRow = ({ order, userRole, onStatusUpdate }) => {
  const [showContact, setShowContact] = useState(false);
  const canViewContact = CONTACT_ALLOWED_ROLES.includes(userRole);
  const total = order.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;

  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      {/* Order */}
      <td className="px-6 py-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          #{(order.orderId || order._id).slice(-8).toUpperCase()}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">₹{total.toFixed(2)}</p>
      </td>

      {/* Customer name + contact button */}
      <td className="px-6 py-4">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {order.customer?.name || 'Guest'}
        </p>
        {canViewContact ? (
          <div className="relative mt-1">
            <button
              onClick={() => setShowContact(!showContact)}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                showContact
                  ? 'bg-primary text-white border-primary'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary'
              }`}
            >
              <span className="material-icons-outlined text-[13px]">
                {showContact ? 'expand_less' : 'contacts'}
              </span>
              {showContact ? 'Hide' : 'View Contact'}
            </button>
            {showContact && (
              <ContactPopover order={order} onClose={() => setShowContact(false)} />
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-0.5">—</p>
        )}
      </td>

      {/* Address preview (truncated) */}
      <td className="px-6 py-4 max-w-[180px]">
        {order.deliveryAddress ? (
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate" title={order.deliveryAddress}>
            {order.deliveryAddress}
          </p>
        ) : (
          <span className="text-xs text-slate-400">Not specified</span>
        )}
      </td>

      {/* Assigned staff */}
      <td className="px-6 py-4">
        {order.assignedTo ? (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-primary">
                {(order.assignedTo.name || 'D')[0].toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300">{order.assignedTo.name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${STATUS_BADGE[order.status] || 'bg-slate-100 text-slate-500'}`}>
          {order.status}
        </span>
      </td>

      {/* Payment - collect or already paid */}
      <td className="px-6 py-4">
        {order.paymentStatus === 'Paid' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="material-icons-outlined text-[12px]">check_circle</span>
            Paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <span className="material-icons-outlined text-[12px]">payments</span>
            Collect ₹{total.toFixed(0)}
          </span>
        )}
        {order.paymentMethod && (
          <p className="text-[10px] text-slate-400 mt-1 capitalize">
            {order.paymentMethod === 'upi' ? 'UPI' : order.paymentMethod === 'netbanking' ? 'Net Banking' : order.paymentMethod === 'cod' ? 'COD' : order.paymentMethod}
          </p>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {['Delivery Staff', 'Admin', 'Company Admin', 'Vendor'].includes(userRole) && (
            <>
              {order.status === 'Ready' && (
                <Button size="sm" onClick={() => onStatusUpdate(order._id, 'Picked')}>
                  Picked Up
                </Button>
              )}
              {order.status === 'Picked' && (
                <Button size="sm" onClick={() => onStatusUpdate(order._id, 'In Transit')}>
                  In Transit
                </Button>
              )}
              {order.status === 'In Transit' && (
                <Button size="sm" onClick={() => onStatusUpdate(order._id, 'Delivered')}>
                  Delivered
                </Button>
              )}
            </>
          )}
          <a
            href={`/orders/track/${order._id}`}
            className="p-1.5 text-slate-400 hover:text-primary transition-colors"
            title="Track order"
          >
            <span className="material-icons-outlined text-lg">open_in_new</span>
          </a>
        </div>
      </td>
    </tr>
  );
};

const DeliveryDashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (user?.role === 'Vendor' && user?.outlet) {
        params.vendor = user.outlet._id || user.outlet;
      }
      const response = await api.get('/orders', { params });
      let deliveryOrders = response.data.filter(
        (order) => order.deliveryMode === 'Delivery'
      );

      // Delivery Staff only sees orders assigned to them
      if (user?.role === 'Delivery Staff') {
        deliveryOrders = deliveryOrders.filter((order) => {
          const assignedId = order.assignedTo?._id || order.assignedTo;
          return assignedId === user._id;
        });
      }

      setOrders(deliveryOrders);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load delivery orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const activeOrders = orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'Delivered');

  if (loading) {
    return (
      <Layout headerProps={{ title: 'Delivery Dashboard' }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading delivery orders...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const tableHead = (
    <thead className="bg-slate-50 dark:bg-slate-800/50">
      <tr>
        <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order</th>
        <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
        <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Address</th>
        <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned To</th>
        <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
        <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment</th>
        <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
      </tr>
    </thead>
  );

  return (
    <Layout headerProps={{ title: 'Delivery Dashboard' }}>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active', value: activeOrders.length, icon: 'local_shipping', color: 'text-primary' },
            { label: 'Delivered Today', value: completedOrders.length, icon: 'check_circle', color: 'text-emerald-600' },
            { label: 'Total', value: orders.length, icon: 'receipt_long', color: 'text-slate-700 dark:text-slate-300' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
              <span className={`material-icons-outlined text-2xl ${color}`}>{icon}</span>
              <div>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Active deliveries */}
        <Card title="Active Deliveries">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {tableHead}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      <span className="material-icons-outlined text-4xl mb-2 opacity-20 block">local_shipping</span>
                      {user?.role === 'Delivery Staff' ? 'No active deliveries assigned to you' : 'No active delivery orders'}
                    </td>
                  </tr>
                ) : (
                  activeOrders.map((order) => (
                    <OrderRow
                      key={order._id}
                      order={order}
                      userRole={user?.role}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Completed deliveries */}
        {completedOrders.length > 0 && (
          <Card title="Completed Deliveries">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                {tableHead}
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {completedOrders.map((order) => (
                    <OrderRow
                      key={order._id}
                      order={order}
                      userRole={user?.role}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default DeliveryDashboard;
