import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';

// Standalone public API — no auth interceptors
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

const OrderTracking = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrder();
    const cleanupSSE = setupSSE();
    return cleanupSSE;
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await publicApi.get(`/orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const setupSSE = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    let eventSource;
    try {
      eventSource = new EventSource(`${API_URL}/orders/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'order_update' && data.order._id === id) {
            setOrder(data.order);
          }
        } catch (err) {
          console.error('Error parsing SSE:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };
    } catch (err) {
      console.error('SSE setup failed:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Preparing':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Ready':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Picked':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'In Transit':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'Delivered':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { label: 'Order Placed', status: 'New' },
      { label: 'Preparing', status: 'Preparing' },
      { label: 'Ready', status: 'Ready' },
      { label: 'Picked', status: 'Picked' },
      { label: 'In Transit', status: 'In Transit' },
      { label: 'Delivered', status: 'Delivered' },
    ];

    const currentIndex = steps.findIndex(s => s.status === order?.status);
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      current: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "Loading..." }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading order...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout headerProps={{ title: "Order Not Found" }}>
        <div className="flex items-center justify-center h-full">
          <Card>
            <div className="text-center">
              <span className="material-icons-outlined text-6xl text-red-500 mb-4">error</span>
              <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
              <p className="text-slate-600 dark:text-slate-400">{error || 'The order you are looking for does not exist.'}</p>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  const total = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
  const statusSteps = getStatusSteps();

  return (
    <Layout
      headerProps={{
        title: `Order ${order.orderId || order._id}`,
        breadcrumbs: [
          { label: 'Orders', path: '/orders' },
          { label: 'Track Order' }
        ]
      }}
    >
      <div className="space-y-6">
        {/* Order Status */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Order Status</h2>
            <span className={`px-4 py-2 rounded-lg font-medium ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
          </div>

          {/* Status Timeline */}
          <div className="relative">
            {statusSteps.map((step, index) => (
              <div key={step.status} className="flex items-start gap-4 mb-6 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${step.completed
                      ? 'bg-primary border-primary text-white'
                      : step.current
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}>
                    {step.completed ? (
                      <span className="material-icons-outlined text-sm">check</span>
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={`w-0.5 h-12 ${step.completed ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                      }`} />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <h3 className={`font-medium ${step.completed || step.current
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-400'
                    }`}>
                    {step.label}
                  </h3>
                  {step.current && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Order is currently at this stage
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Order Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-bold mb-4">Order Items</h3>
            <div className="space-y-3">
              {order.items?.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.menuItem?.image && (
                      <img
                        src={item.menuItem.image}
                        alt={item.menuItem.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div>
                      <h4 className="font-medium text-sm">{item.menuItem?.name || 'Item'}</h4>
                      {item.variant && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.variant}</p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold">Total</span>
              <span className="text-lg font-bold text-primary">₹{total.toFixed(2)}</span>
            </div>
          </Card>

          <Card>
            <h3 className="font-bold mb-4">Delivery Information</h3>
            <div className="space-y-3">
              {order.assignedTo && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Delivery Person</p>
                  <p className="font-medium">{order.assignedTo.name}</p>
                  {order.assignedTo.phone && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{order.assignedTo.phone}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Delivery Address</p>
                <p className="font-medium">{order.deliveryAddress || 'Not specified'}</p>
              </div>
              {order.notes && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Delivery Notes</p>
                  <p className="font-medium">{order.notes}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Order Type</p>
                <p className="font-medium">{order.orderType || 'Regular'}</p>
              </div>
              {order.scheduledTime && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Scheduled Time</p>
                  <p className="font-medium">{new Date(order.scheduledTime).toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Order Date</p>
                <p className="font-medium">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default OrderTracking;
