import express from 'express';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { v4 as uuidv4 } from 'uuid';
import authenticate from '../middleware/auth.js';
import { broadcastNotification } from './notifications.js';

const router = express.Router();

// Store for SSE connections
const orderClients = new Map();

// SSE endpoint for real-time order updates
router.get('/stream', (req, res) => {
  const clientId = uuidv4();
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  orderClients.set(clientId, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    orderClients.delete(clientId);
  });
});

// Broadcast order update to all connected clients
const broadcastOrderUpdate = (order) => {
  const message = `data: ${JSON.stringify({ type: 'order_update', order })}\n\n`;
  orderClients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending SSE message:', error);
    }
  });
};

const createNotifications = async ({ users, title, message, type, relatedId, relatedModel }) => {
  if (!users || users.length === 0) return;
  const docs = users.map((user) => ({
    user: user._id,
    title,
    message,
    type,
    relatedId,
    relatedModel,
  }));
  const saved = await Notification.insertMany(docs);
  // Broadcast each notification to the respective user via SSE
  saved.forEach((notification) => {
    broadcastNotification(notification.user, notification);
  });
};

// Get active delivery staff (for assignment dropdown - Vendor/Admin/Company Admin)
router.get('/delivery-staff/list', authenticate, async (req, res) => {
  try {
    const allowedRoles = ['Vendor', 'Admin', 'Company Admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const query = { role: 'Delivery Staff', status: 'Active' };

    // Filter by outlet if provided, or by vendor's own outlet
    if (req.query.outlet) {
      query.outlet = req.query.outlet;
    } else if (req.user.role === 'Vendor' && req.user.outlet) {
      query.outlet = req.user.outlet;
    }

    const staff = await User.find(query)
      .select('_id name phone outlet');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all orders (protected)
router.get('/', authenticate, async (req, res) => {
  try {
    const { vendor, status, orderType, startDate, endDate } = req.query;
    const query = {};

    if (vendor) query.vendor = vendor;
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get orders by outlet (protected)
router.get('/outlet/:outletId', authenticate, async (req, res) => {
  try {
    const { outletId } = req.params;
    const { status } = req.query;
    const query = { vendor: outletId };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single order - public for order tracking (QR customers need this)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice variants')
      .populate('assignedTo', 'name phone');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create order (including QR code orders) - Public for QR/Bulk/Retail orders
router.post('/', async (req, res) => {
  // Allow QR, Bulk, and Retail orders without authentication (customer-facing ordering)
  const publicOrderTypes = ['QR', 'Bulk', 'Retail'];
  if (!publicOrderTypes.includes(req.body.orderType) && !req.header('Authorization')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // If auth token provided, verify it
  if (req.header('Authorization')) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      const jwt = (await import('jsonwebtoken')).default;
      const User = (await import('../models/User.js')).default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (user && user.status === 'Active') {
        req.user = user;
      }
    } catch (error) {
      // If token invalid but it's a public order type, allow it
      if (!publicOrderTypes.includes(req.body.orderType)) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }
  }
  try {
    const orderData = req.body;
    
    // Generate order ID
    const count = await Order.countDocuments();
    orderData.orderId = `ORD-${new Date().getFullYear()}${String(count + 1).padStart(4, '0')}`;

    const order = new Order(orderData);
    const savedOrder = await order.save();
    
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    // Broadcast order update via SSE
    broadcastOrderUpdate(populatedOrder);

    const vendorUsers = await User.find({ role: 'Vendor', outlet: populatedOrder.vendor?._id });
    const adminUsers = await User.find({ role: { $in: ['Admin', 'Company Admin'] } });
    await createNotifications({
      users: [...vendorUsers, ...adminUsers],
      title: 'New Order Received',
      message: `Order ${populatedOrder.orderId} has been placed.`,
      type: 'order',
      relatedId: populatedOrder._id,
      relatedModel: 'Order',
    });

    res.status(201).json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update order status (protected)
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, estimatedMinutes, note } = req.body;
    const allowedStatuses = ['New', 'Preparing', 'Ready', 'Picked', 'In Transit', 'Delivered', 'Cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const role = req.user.role;
    const allowedStatusesByRole = {
      Vendor: ['Preparing', 'Ready', 'Cancelled'],
      'Delivery Staff': ['Picked', 'In Transit', 'Delivered'],
      Admin: ['New', 'Preparing', 'Ready', 'Picked', 'In Transit', 'Delivered', 'Cancelled'],
      'Company Admin': ['New', 'Preparing', 'Ready', 'Picked', 'In Transit', 'Delivered', 'Cancelled'],
    };

    if (!allowedStatusesByRole[role]?.includes(status)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Enforce delivery staff assignment — only assigned staff can update delivery statuses
    const deliveryStatuses = ['Picked', 'In Transit', 'Delivered'];
    if (role === 'Delivery Staff' && deliveryStatuses.includes(status)) {
      const existingOrder = await Order.findById(req.params.id);
      if (existingOrder && existingOrder.assignedTo && existingOrder.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'This order is assigned to another delivery staff' });
      }
    }

    const updateFields = { status };

    // Set estimated ready/delivery time for any status transition that includes estimatedMinutes
    if (estimatedMinutes && Number(estimatedMinutes) > 0) {
      updateFields.estimatedReadyTime = new Date(Date.now() + Number(estimatedMinutes) * 60 * 1000);
    }

    // Append to status timeline
    const timelineEntry = {
      status,
      timestamp: new Date(),
      note: note || (estimatedMinutes && Number(estimatedMinutes) > 0 ? `~${estimatedMinutes} min` : null),
      setBy: req.user._id,
    };

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        ...updateFields,
        $push: { statusTimeline: timelineEntry },
      },
      { new: true, runValidators: true }
    )
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone')
      .populate('statusTimeline.setBy', 'name role');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    broadcastOrderUpdate(order);

    const vendorUsers = await User.find({ role: 'Vendor', outlet: order.vendor?._id });
    const adminUsers = await User.find({ role: { $in: ['Admin', 'Company Admin'] } });
    await createNotifications({
      users: [...vendorUsers, ...adminUsers],
      title: 'Order Status Updated',
      message: `Order ${order.orderId} is now ${order.status}.`,
      type: 'order',
      relatedId: order._id,
      relatedModel: 'Order',
    });

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update order (protected)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Broadcast order update via SSE
    broadcastOrderUpdate(order);

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Assign delivery staff to order (Vendor/Admin/Company Admin only)
router.patch('/:id/assign', authenticate, async (req, res) => {
  try {
    // Authorization check
    const allowedRoles = ['Vendor', 'Admin', 'Company Admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Vendor/Admin/Company Admin can assign delivery staff' });
    }

    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ message: 'assignedTo is required' });
    }

    // Validate assignedTo is an active Delivery Staff user
    const deliveryUser = await User.findById(assignedTo);
    if (!deliveryUser || deliveryUser.role !== 'Delivery Staff') {
      return res.status(400).json({ message: 'Invalid delivery staff user' });
    }
    if (deliveryUser.status !== 'Active') {
      return res.status(400).json({ message: 'Delivery staff is not active' });
    }

    // Validate order exists and is in assignable status
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (!['Preparing', 'Ready'].includes(order.status)) {
      return res.status(400).json({ message: 'Order can only be assigned when Preparing or Ready' });
    }

    // Assign and save
    order.assignedTo = assignedTo;
    await order.save();

    // Populate and return
    const populatedOrder = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    // Broadcast via SSE
    broadcastOrderUpdate(populatedOrder);

    // Notify assigned delivery staff
    const assignNotification = await Notification.create({
      user: assignedTo,
      title: 'New Delivery Assignment',
      message: `You have been assigned to deliver order ${order.orderId}.`,
      type: 'delivery',
      relatedId: order._id,
      relatedModel: 'Order',
    });
    broadcastNotification(assignedTo, assignNotification);

    res.json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Vendor accept order (protected - Vendor only)
router.patch('/:id/accept', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.vendor.toString() !== req.user.outlet?.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'You can only accept orders for your outlet' });
    }

    if (order.status !== 'New') {
      return res.status(400).json({ message: 'Order cannot be accepted in current status' });
    }

    const { estimatedMinutes, note } = req.body;

    order.status = 'Preparing';
    if (estimatedMinutes && Number(estimatedMinutes) > 0) {
      order.estimatedReadyTime = new Date(Date.now() + Number(estimatedMinutes) * 60 * 1000);
    }
    order.statusTimeline.push({
      status: 'Preparing',
      timestamp: new Date(),
      note: note || (estimatedMinutes ? `Ready in ~${estimatedMinutes} min` : null),
      setBy: req.user._id,
    });
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone')
      .populate('statusTimeline.setBy', 'name role');

    broadcastOrderUpdate(populatedOrder);
    const vendorUsers = await User.find({ role: 'Vendor', outlet: populatedOrder.vendor?._id });
    const adminUsers = await User.find({ role: { $in: ['Admin', 'Company Admin'] } });
    await createNotifications({
      users: [...vendorUsers, ...adminUsers],
      title: 'Order Accepted',
      message: `Order ${populatedOrder.orderId} is now being prepared.`,
      type: 'order',
      relatedId: populatedOrder._id,
      relatedModel: 'Order',
    });
    res.json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Vendor reject order (protected - Vendor only)
router.patch('/:id/reject', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user is vendor for this order
    if (order.vendor.toString() !== req.user.outlet?.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'You can only reject orders for your outlet' });
    }

    if (order.status !== 'New') {
      return res.status(400).json({ message: 'Order cannot be rejected in current status' });
    }

    order.status = 'Cancelled';
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    broadcastOrderUpdate(populatedOrder);
    const vendorUsers = await User.find({ role: 'Vendor', outlet: populatedOrder.vendor?._id });
    const adminUsers = await User.find({ role: { $in: ['Admin', 'Company Admin'] } });
    await createNotifications({
      users: [...vendorUsers, ...adminUsers],
      title: 'Order Rejected',
      message: `Order ${populatedOrder.orderId} was rejected.`,
      type: 'order',
      relatedId: populatedOrder._id,
      relatedModel: 'Order',
    });
    res.json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete order (protected - Admin only)
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Admin can delete orders' });
  }
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Payment notification — public, called after customer completes payment
router.post('/:id/payment-notification', async (req, res) => {
  try {
    const { paymentMethod, amount } = req.body;

    const order = await Order.findById(req.params.id)
      .populate('vendor', 'name outletId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update payment fields on the order
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
      order.paymentStatus = ['cash', 'cod'].includes(paymentMethod) ? 'Pending' : 'Paid';
      await order.save();
    }

    const methodLabels = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', cash: 'Cash', cod: 'Pay on Delivery' };
    const methodLabel = methodLabels[paymentMethod] || paymentMethod;
    const amountStr = amount ? `₹${Number(amount).toLocaleString('en-IN')}` : '';
    const isPending = ['cash', 'cod'].includes(paymentMethod);

    // Notify vendor and admins
    const vendorUsers = await User.find({ role: 'Vendor', outlet: order.vendor?._id });
    const adminUsers = await User.find({ role: { $in: ['Admin', 'Company Admin'] } });
    await createNotifications({
      users: [...vendorUsers, ...adminUsers],
      title: isPending ? 'Payment Pending — Collect on Delivery' : 'Payment Received',
      message: isPending
        ? `Order ${order.orderId} of ${amountStr} — payment to be collected via ${methodLabel}.`
        : `Order ${order.orderId} payment of ${amountStr} completed via ${methodLabel}.`,
      type: 'payment',
      relatedId: order._id,
      relatedModel: 'Order',
    });

    res.json({ message: 'Payment notification sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cancel order — public for QR/customer-facing orders
router.patch('/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (['Delivered', 'Cancelled', 'Preparing', 'Ready', 'Picked', 'In Transit'].includes(order.status)) {
      return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
    }

    order.status = 'Cancelled';
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    broadcastOrderUpdate(populatedOrder);
    const vendorUsers = await User.find({ role: 'Vendor', outlet: populatedOrder.vendor?._id });
    const adminUsers = await User.find({ role: { $in: ['Admin', 'Company Admin'] } });
    await createNotifications({
      users: [...vendorUsers, ...adminUsers],
      title: 'Order Cancelled',
      message: `Order ${populatedOrder.orderId} was cancelled by the customer.`,
      type: 'order',
      relatedId: populatedOrder._id,
      relatedModel: 'Order',
    });
    res.json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
