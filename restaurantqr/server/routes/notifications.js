import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Notification from '../models/Notification.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

// Store for SSE notification connections (userId -> Map of clientId -> res)
const notificationClients = new Map();

// SSE endpoint for real-time notification updates
router.get('/stream', async (req, res) => {
  // SSE doesn't support custom headers, so accept token via query param
  const token = req.query.token || req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  let user;
  try {
    const jwt = (await import('jsonwebtoken')).default;
    const User = (await import('../models/User.js')).default;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    user = await User.findById(decoded.userId);
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const clientId = uuidv4();
  const userId = user._id.toString();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!notificationClients.has(userId)) {
    notificationClients.set(userId, new Map());
  }
  notificationClients.get(userId).set(clientId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  req.on('close', () => {
    const userClients = notificationClients.get(userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        notificationClients.delete(userId);
      }
    }
  });
});

// Broadcast a notification to a specific user's connected clients
export const broadcastNotification = (userId, notification) => {
  const userIdStr = userId.toString();
  const userClients = notificationClients.get(userIdStr);
  if (!userClients) return;

  const message = `data: ${JSON.stringify({ type: 'new_notification', notification })}\n\n`;
  userClients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending notification SSE:', error);
    }
  });
};

// Get all notifications for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const { read, type, limit = 50 } = req.query;
    const query = { user: req.user._id };

    if (read !== undefined) {
      query.read = read === 'true';
    }

    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get unread notification count
router.get('/unread/count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
