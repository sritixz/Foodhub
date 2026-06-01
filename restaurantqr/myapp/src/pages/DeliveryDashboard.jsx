import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

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
        params.vendor = user.outlet;
      }
      const response = await api.get('/orders', { params });
      let deliveryOrders = response.data.filter(
        (order) => order.deliveryMode === 'Delivery'
      );

      // Delivery Staff only sees orders assigned to them
      if (user?.role === 'Delivery Staff') {
        deliveryOrders = deliveryOrders.filter(order => {
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

  if (loading) {
    return (
      <Layout headerProps={{ title: "Delivery Dashboard" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading delivery orders...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerProps={{ title: "Delivery Dashboard" }}>
      <div>
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <Card title="Assigned Deliveries">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                      <span className="material-icons-outlined text-4xl mb-2 opacity-20 block">local_shipping</span>
                      {user?.role === 'Delivery Staff'
                        ? 'No orders assigned to you yet'
                        : 'No delivery orders available'}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order._id}>
                      <td className="px-6 py-4 text-sm font-medium">{order.orderId || order._id}</td>
                      <td className="px-6 py-4 text-sm">{order.customer?.name || 'Customer'}</td>
                      <td className="px-6 py-4 text-sm">{order.deliveryAddress || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm">{order.status}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(user?.role === 'Delivery Staff' || ['Admin', 'Company Admin'].includes(user?.role)) && (
                            <>
                              {order.status === 'Ready' && (
                                <Button onClick={() => handleStatusUpdate(order._id, 'Picked')}>
                                  Picked
                                </Button>
                              )}
                              {order.status === 'Picked' && (
                                <Button onClick={() => handleStatusUpdate(order._id, 'In Transit')}>
                                  In Transit
                                </Button>
                              )}
                              {order.status === 'In Transit' && (
                                <Button onClick={() => handleStatusUpdate(order._id, 'Delivered')}>
                                  Delivered
                                </Button>
                              )}
                            </>
                          )}
                        </div>
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

export default DeliveryDashboard;
