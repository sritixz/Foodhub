import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import api from '../utils/api';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [typeFilter, setTypeFilter] = useState('all'); // all, order, delivery, system, offer, payment

  useEffect(() => {
    fetchNotifications();
  }, [filter, typeFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === 'unread') params.append('read', 'false');
      if (filter === 'read') params.append('read', 'true');
      if (typeFilter !== 'all') params.append('type', typeFilter);
      params.append('limit', '50');

      const response = await api.get(`/notifications?${params.toString()}`);
      setNotifications(response.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark notifications');
    }
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n =>
        n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark notification');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete notification');
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markRead(notification._id);
    }
    if (notification.relatedId && (notification.type === 'order' || notification.type === 'delivery')) {
      navigate(`/orders/track/${notification.relatedId}`);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order': return 'shopping_cart';
      case 'payment': return 'payment';
      case 'delivery': return 'local_shipping';
      case 'offer': return 'local_offer';
      default: return 'notifications';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'order': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'delivery': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'payment': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'offer': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const getTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'read', label: 'Read' },
  ];

  const typeTabs = [
    { key: 'all', label: 'All Types' },
    { key: 'order', label: 'Orders' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'system', label: 'System' },
    { key: 'offer', label: 'Offers' },
    { key: 'payment', label: 'Payment' },
  ];

  if (loading) {
    return (
      <Layout headerProps={{ title: "Notifications" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading notifications...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Notifications",
        actionButton: unreadCount > 0 ? (
          <Button onClick={markAllRead}>
            <span className="material-icons-outlined text-sm mr-1">done_all</span>
            Mark all read
          </Button>
        ) : null,
      }}
    >
      <div className="p-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === tab.key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {typeTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  typeFilter === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <span className="material-icons-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">notifications_none</span>
              <p className="text-slate-600 dark:text-slate-400">No notifications found</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {filter !== 'all' || typeFilter !== 'all' ? 'Try changing your filters' : 'You\'re all caught up'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-4 transition-all hover:shadow-md cursor-pointer ${
                  notification.read
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-primary/30 bg-primary/5 dark:bg-primary/5'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notification.read ? 'bg-slate-100 dark:bg-slate-800' : 'bg-primary/10'
                  }`}>
                    <span className={`material-icons-outlined text-lg ${
                      notification.read ? 'text-slate-400' : 'text-primary'
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`font-medium ${
                          notification.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                        }`}>
                          {notification.title}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${getTypeColor(notification.type)}`}>
                        {notification.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-400">
                        {getTimeAgo(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!notification.read && (
                          <button
                            onClick={() => markRead(notification._id)}
                            className="text-xs text-primary hover:underline"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification._id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {!notification.read && (
                    <div className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0 mt-2"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Notifications;
