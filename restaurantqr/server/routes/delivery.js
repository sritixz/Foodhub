import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import DeliveryBatch from '../models/DeliveryBatch.js';
import Notification from '../models/Notification.js';
import authenticate from '../middleware/auth.js';
import { broadcastOrderUpdate } from './orders.js';
import { broadcastNotification } from './notifications.js';

const router = express.Router();

// Helper to notify user
const notifyRunner = async (userId, title, message, relatedId) => {
  try {
    const notif = await Notification.create({
      user: userId,
      title,
      message,
      type: 'delivery',
      relatedId,
      relatedModel: 'Order',
    });
    broadcastNotification(userId, notif);
  } catch (_) {}
};

// 1. GET Available Tasks for Runner's Kiosk / Delivery Zone
router.get('/tasks/available', authenticate, async (req, res) => {
  try {
    const query = {
      deliveryMode: 'Delivery',
      status: { $in: ['Preparing', 'Ready'] },
      $or: [
        { assignedTo: null },
        { assignedTo: req.user._id, status: 'Preparing' },
      ],
    };

    if (req.user.outlet) {
      query.vendor = req.user.outlet;
    }

    const tasks = await Order.find(query)
      .populate('vendor', 'name outletId address')
      .populate('items.menuItem', 'name image basePrice category')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. GET Runner's Active Assigned Tasks
router.get('/tasks/active', authenticate, async (req, res) => {
  try {
    const query = {
      assignedTo: req.user._id,
      status: { $in: ['Ready', 'Picked', 'In Transit', 'En Route', 'Arrived'] },
    };

    const tasks = await Order.find(query)
      .populate('vendor', 'name outletId address')
      .populate('items.menuItem', 'name image basePrice category')
      .populate('batchRunId')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Accept Task Assignment (Stops auto-reassign timeout)
router.patch('/tasks/:id/accept', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.assignedTo = req.user._id;
    order.reassignmentDeadline = null;
    if (order.status === 'New') {
      order.status = 'Ready';
    }

    order.statusTimeline.push({
      status: 'Accepted',
      note: `Accepted by runner ${req.user.name}`,
      setBy: req.user._id,
      timestamp: new Date(),
    });

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    broadcastOrderUpdate(populated);
    res.json({ success: true, message: 'Task accepted', order: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 4. Reject Task Assignment (Triggers auto-reassign)
router.patch('/tasks/:id/reject', authenticate, async (req, res) => {
  try {
    const { reason = 'Runner overloaded' } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.rejectedBy.push({
      runner: req.user._id,
      reason,
      timestamp: new Date(),
    });

    order.assignedTo = null;
    order.reassignmentDeadline = new Date(Date.now() + 60 * 1000);

    order.statusTimeline.push({
      status: 'Reassigned',
      note: `Rejected by ${req.user.name}: ${reason}`,
      setBy: req.user._id,
      timestamp: new Date(),
    });

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice');

    broadcastOrderUpdate(populated);
    res.json({ success: true, message: 'Task rejected and queued for reassignment', order: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 5. Confirm Kiosk Counter Pickup Checklist
router.patch('/tasks/:id/pickup', authenticate, async (req, res) => {
  try {
    const { checklist } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = 'Picked';
    if (Array.isArray(checklist)) {
      order.pickupChecklist = checklist;
    }

    order.statusTimeline.push({
      status: 'Picked',
      note: `Handover verified at counter by runner ${req.user.name}`,
      setBy: req.user._id,
      timestamp: new Date(),
    });

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    broadcastOrderUpdate(populated);
    res.json({ success: true, message: 'Pickup verified', order: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 6. Create Multi-Order Batch Run
router.post('/tasks/batch', authenticate, async (req, res) => {
  try {
    const { orderIds, building, floors } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'orderIds array is required' });
    }

    const batchNumber = `BATCH-${Date.now().toString().slice(-6)}`;
    const batch = new DeliveryBatch({
      batchNumber,
      runner: req.user._id,
      vendor: req.user.outlet || orderIds[0],
      orders: orderIds,
      building: building || 'Tower B',
      floors: floors || ['Floor 7'],
      status: 'Formed',
    });

    await batch.save();

    await Order.updateMany(
      { _id: { $in: orderIds } },
      { $set: { batchRunId: batch._id, assignedTo: req.user._id } }
    );

    res.status(201).json({ success: true, message: 'Batch run created', batch });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 7. Update Task Status (En Route, Arrived, Delivered)
router.patch('/tasks/:id/status', authenticate, async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    order.statusTimeline.push({
      status,
      note: note || `Updated by runner ${req.user.name}`,
      setBy: req.user._id,
      timestamp: new Date(),
    });

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    broadcastOrderUpdate(populated);
    res.json({ success: true, order: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 8. Submit Proof of Delivery (PoD)
router.post('/tasks/:id/proof', authenticate, async (req, res) => {
  try {
    const { recipientName, recipientPhone, photoUrl, handoverType = 'Direct Desk', notes } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = 'Delivered';
    order.proofOfDelivery = {
      timestamp: new Date(),
      runner: req.user._id,
      handoverType,
      recipientName: recipientName || order.customer?.name,
      recipientPhone: recipientPhone || order.customer?.phone,
      photoUrl,
      notes,
    };

    order.statusTimeline.push({
      status: 'Delivered',
      note: `Desk handover verified: ${handoverType} (${recipientName || 'Recipient'})`,
      setBy: req.user._id,
      timestamp: new Date(),
    });

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    broadcastOrderUpdate(populated);
    res.json({ success: true, message: 'Proof of delivery submitted successfully', order: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 9. Report Delivery Exception / Reception Handover
router.post('/tasks/:id/exception', authenticate, async (req, res) => {
  try {
    const { reason, comment, receptionName, receptionContact } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.deliveryException = {
      reason,
      comment,
      receptionName,
      receptionContact,
      reportedAt: new Date(),
    };

    if (reason === 'Reception Handover') {
      order.status = 'Delivered';
      order.statusTimeline.push({
        status: 'Delivered at Reception',
        note: `Handed over to Concierge/Reception: ${receptionName} (${receptionContact || 'No contact'}). ${comment || ''}`,
        setBy: req.user._id,
        timestamp: new Date(),
      });
    } else {
      order.statusTimeline.push({
        status: 'Delivery Exception',
        note: `Exception: ${reason} - ${comment || ''}`,
        setBy: req.user._id,
        timestamp: new Date(),
      });
    }

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name image basePrice')
      .populate('assignedTo', 'name phone');

    broadcastOrderUpdate(populated);
    res.json({ success: true, message: 'Exception recorded', order: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 10. Duty Status Toggle
router.patch('/duty/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Online', 'Offline', 'On Break'].includes(status)) {
      return res.status(400).json({ message: 'Invalid duty status' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { dutyStatus: status },
      { new: true }
    ).select('-password');

    res.json({ success: true, dutyStatus: user.dutyStatus });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 11. Duty Status & Workload Query
router.get('/duty/status', authenticate, async (req, res) => {
  try {
    const activeTasksCount = await Order.countDocuments({
      assignedTo: req.user._id,
      status: { $in: ['Ready', 'Picked', 'In Transit', 'En Route', 'Arrived'] },
    });

    res.json({
      dutyStatus: req.user.dutyStatus || 'Online',
      activeTasksCount,
      maxCapacity: req.user.maxCapacity || 4,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
