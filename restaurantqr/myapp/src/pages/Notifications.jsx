import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import api from '../utils/api';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      setNotifications(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      await fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark notifications');
    }
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      await fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark notification');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      await fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete notification');
    }
  };

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
        actionButton: (
          <Button variant="outline" onClick={markAllRead}>
            Mark all read
          </Button>
        )
      }}
    >
      <div>
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <Card>
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No notifications available.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`border border-slate-200 dark:border-slate-800 rounded-lg p-4 ${notification.read ? 'bg-white dark:bg-slate-900' : 'bg-orange-50 dark:bg-orange-900/10'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <Button variant="outline" onClick={() => markRead(notification._id)}>
                          Mark read
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => deleteNotification(notification._id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Notifications;
