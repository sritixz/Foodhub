import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const OrderManagement = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderType, setOrderType] = useState('QR/Retail');
  const [timeFilter, setTimeFilter] = useState('Last 7 days');
  const [selectedOutlet, setSelectedOutlet] = useState('All Outlets');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Prep time modal
  const [prepModal, setPrepModal] = useState({ open: false, orderId: null, isAccept: false });
  const [prepMinutes, setPrepMinutes] = useState('20');

  useEffect(() => {
    fetchOrders();
    fetchOutlets();
    fetchDeliveryStaff();
    const cleanupSSE = setupSSE();
    return cleanupSSE;
  }, []);

  const fetchOutlets = async () => {
    try {
      const response = await api.get('/outlets');
      setOutlets(response.data);
    } catch (err) {
      console.error('Error fetching outlets:', err);
    }
  };

  const fetchDeliveryStaff = async () => {
    try {
      const response = await api.get('/orders/delivery-staff/list');
      setDeliveryStaff(response.data);
    } catch (err) {
      console.error('Error fetching delivery staff:', err);
    }
  };

  const getDeliveryStaffForOrder = (order) => {
    const orderOutlet = order.vendor?._id || order.vendor;
    if (!orderOutlet) return deliveryStaff;
    return deliveryStaff.filter(staff => {
      const staffOutlet = staff.outlet?._id || staff.outlet;
      return staffOutlet === orderOutlet || !staffOutlet;
    });
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};

      // Role-based filtering
      if (user?.role === 'Vendor' && user?.outlet) {
        params.vendor = user.outlet._id || user.outlet;
      } else if (user?.role === 'Delivery Staff' && user?.outlet) {
        params.vendor = user.outlet._id || user.outlet;
      } else if (selectedOutlet !== 'All Outlets') {
        params.vendor = selectedOutlet;
      }

      if (orderType === 'Bulk') {
        params.orderType = 'Bulk';
      }

      // Time filtering logic
      if (timeFilter !== 'All Time') {
        const now = new Date();
        let startDate;
        if (timeFilter === 'Today') {
          startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (timeFilter === 'Last 7 days') {
          startDate = new Date(now.setDate(now.getDate() - 7));
        } else if (timeFilter === 'This Month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        if (startDate) params.startDate = startDate.toISOString();
      }

      const response = await api.get('/orders', { params });
      setOrders(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupSSE = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const eventSource = new EventSource(`${API_URL}/orders/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'order_update') {
          setOrders(prevOrders => {
            const existingIndex = prevOrders.findIndex(o => o._id === data.order._id);
            if (existingIndex >= 0) {
              const updated = [...prevOrders];
              updated[existingIndex] = data.order;
              return updated;
            } else {
              return [data.order, ...prevOrders];
            }
          });
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  };

  useEffect(() => {
    fetchOrders();
  }, [orderType, timeFilter, selectedOutlet]);

  const handleStatusUpdate = async (orderId, status) => {
    // For Preparing, show prep time modal first
    if (status === 'Preparing') {
      setPrepModal({ open: true, orderId, isAccept: false });
      return;
    }
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleVendorAction = async (orderId, action) => {
    if (action === 'accept') {
      setPrepModal({ open: true, orderId, isAccept: true });
      return;
    }
    try {
      await api.patch(`/orders/${orderId}/${action}`);
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order');
    }
  };

  const handleConfirmPrep = async () => {
    const { orderId, isAccept } = prepModal;
    try {
      if (isAccept) {
        await api.patch(`/orders/${orderId}/accept`, { estimatedMinutes: Number(prepMinutes) });
      } else {
        await api.patch(`/orders/${orderId}/status`, { status: 'Preparing', estimatedMinutes: Number(prepMinutes) });
      }
      setPrepModal({ open: false, orderId: null, isAccept: false });
      setPrepMinutes('20');
      await fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order');
    }
  };

  const handleAssignDelivery = async (orderId, staffId) => {
    if (!staffId) return;
    try {
      await api.patch(`/orders/${orderId}/assign`, { assignedTo: staffId });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign delivery staff');
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    const customer = order.customer?.name || order.customer || '';
    const orderId = order.orderId || order._id || '';
    const vendor = order.vendor?.name || order.vendor || '';

    return (
      customer.toLowerCase().includes(searchLower) ||
      orderId.toLowerCase().includes(searchLower) ||
      vendor.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status) => {
    const badges = {
      New: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      Preparing: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      Ready: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      Picked: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      'In Transit': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      Delivered: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      Cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    };
    return badges[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hours ago`;
  };

  const deliveryOrders = orders.filter(order => order.deliveryAddress).slice(0, 3);
  const isVendor = user?.role === 'Vendor';
  const isDeliveryStaff = user?.role === 'Delivery Staff';
  const isAdmin = ['Admin', 'Company Admin'].includes(user?.role);

  if (loading) {
    return (
      <Layout headerProps={{ title: "Order Management" }}>
        <div className="flex items-center justify-center py-12 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading orders...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Order Management",
        searchPlaceholder: "Search orders, customers, or vendors..."
      }}
    >
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400">search</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search orders, customers, or vendors..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="appearance-none pl-10 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {['Today', 'Last 7 days', 'This Month', 'All Time'].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400 pointer-events-none text-[18px]">calendar_today</span>
              <span className="material-icons-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>

            {!isVendor && (
              <div className="relative">
                <select
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value)}
                  className="appearance-none pl-10 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="All Outlets">All Outlets</option>
                  {outlets.map((outlet) => (
                    <option key={outlet._id} value={outlet._id}>{outlet.name}</option>
                  ))}
                </select>
                <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400 pointer-events-none text-[18px]">store</span>
                <span className="material-icons-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
              </div>
            )}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setOrderType('QR/Retail')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${orderType === 'QR/Retail'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                QR/Retail
              </button>
              <button
                onClick={() => setOrderType('Bulk')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${orderType === 'Bulk'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                Bulk
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Orders */}
      <Card title="Live Orders">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Customer/Company
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Order Type
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Delivery Mode
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const totalAmount = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
                  return (
                    <tr key={order._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        {order.orderId || order._id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 dark:text-white uppercase truncate max-w-[150px]">
                            {order.customer?.name || order.customer?.companyName || 'Guest'}
                          </span>
                          {order.customer?.phone && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              {order.customer.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                          <span className="material-icons-outlined text-[16px] mr-1">
                            {order.orderType === 'Bulk' ? 'business' : 'person'}
                          </span>
                          {order.orderType || 'Regular'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {order.vendor?.name || order.vendor || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                          <span className="material-icons-outlined text-[16px] mr-1">
                            {order.deliveryMode === 'Delivery' ? 'delivery_dining' : 'restaurant'}
                          </span>
                          {order.deliveryMode || (order.deliveryAddress ? 'Delivery' : 'Dine-In')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                        ₹{totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${getStatusBadge(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {getTimeAgo(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {isVendor && order.status === 'New' && (
                            <>
                              <button
                                onClick={() => handleVendorAction(order._id, 'accept')}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleVendorAction(order._id, 'reject')}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 border border-red-200"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {isVendor && order.status === 'Preparing' && (
                            <button
                              onClick={() => handleStatusUpdate(order._id, 'Ready')}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              Mark Ready
                            </button>
                          )}
                          {isDeliveryStaff && order.status === 'Ready' && (
                            <button
                              onClick={() => handleStatusUpdate(order._id, 'Picked')}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              Picked
                            </button>
                          )}
                          {isDeliveryStaff && order.status === 'Picked' && (
                            <button
                              onClick={() => handleStatusUpdate(order._id, 'In Transit')}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              In Transit
                            </button>
                          )}
                          {isDeliveryStaff && order.status === 'In Transit' && (
                            <button
                              onClick={() => handleStatusUpdate(order._id, 'Delivered')}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200"
                            >
                              Delivered
                            </button>
                          )}
                          {isAdmin && (
                            <select
                              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-transparent"
                              value={order.status}
                              onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                            >
                              {['New', 'Preparing', 'Ready', 'Picked', 'In Transit', 'Delivered', 'Cancelled'].map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          )}
                          {(isVendor || isAdmin) && ['Preparing', 'Ready'].includes(order.status) && order.deliveryMode === 'Delivery' && (
                            <select
                              className="text-xs border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                              value={order.assignedTo?._id || ''}
                              onChange={(e) => handleAssignDelivery(order._id, e.target.value)}
                            >
                              <option value="">{order.assignedTo ? order.assignedTo.name : 'Assign Delivery'}</option>
                              {getDeliveryStaffForOrder(order).map(staff => (
                                <option key={staff._id} value={staff._id}>{staff.name}</option>
                              ))}
                            </select>
                          )}
                          {order.assignedTo && !['Preparing', 'Ready'].includes(order.status) && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <span className="material-icons-outlined text-[14px]">person</span>
                              {order.assignedTo.name}
                            </span>
                          )}
                          <button
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            onClick={() => window.location.href = `/orders/track/${order._id}`}
                          >
                            <span className="material-icons-outlined">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bulk Orders */}
      <Card title="Bulk Orders" className="mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Employee Count
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Schedule
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-12 text-center text-sm text-slate-400" colSpan="4">
                  <span className="material-icons-outlined text-4xl mb-2 opacity-20">inventory</span>
                  <p>No active bulk orders currently.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delivery Management */}
      <section>        <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Delivery Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deliveryOrders.length === 0 ? (
            <Card>
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <span className="material-icons-outlined text-4xl mb-2 opacity-20">local_shipping</span>
                <p>No delivery orders currently</p>
              </div>
            </Card>
          ) : (
            deliveryOrders.map((order, idx) => (
              <Card key={order._id}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{order.orderId || order._id}</h4>
                    <p className="text-sm text-slate-500">{order.customer?.name || order.customer || 'N/A'}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${getStatusBadge(order.status)}`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                    <span className="material-icons-outlined text-[18px] mr-2 text-slate-400">location_on</span>
                    {order.deliveryAddress || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                    <span className="material-icons-outlined text-[18px] mr-2 text-slate-400">schedule</span>
                    {getTimeAgo(order.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => window.location.href = `/orders/track/${order._id}`}>
                    <span className="material-icons-outlined text-[18px] mr-2">map</span>
                    View Order
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Prep Time Modal */}
      <Modal
        isOpen={prepModal.open}
        onClose={() => setPrepModal({ open: false, orderId: null, isAccept: false })}
        title={prepModal.isAccept ? 'Accept Order — Set Prep Time' : 'Set Prep Time'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            How many minutes will this order take to prepare? The customer will see a live countdown.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Estimated prep time (minutes)
            </label>
            <div className="flex gap-2 mb-3">
              {['10', '15', '20', '30', '45', '60'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPrepMinutes(m)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    prepMinutes === m
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(e.target.value)}
              placeholder="Custom minutes"
              min="1"
              max="180"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setPrepModal({ open: false, orderId: null, isAccept: false })}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirmPrep}>
              <span className="material-icons-outlined text-sm">check</span>
              {prepModal.isAccept ? 'Accept Order' : 'Set Time'}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default OrderManagement;
