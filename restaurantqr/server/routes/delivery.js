import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import DeliveryBatch from '../models/DeliveryBatch.js';
import DeliveryShift from '../models/DeliveryShift.js';
import RunnerEarnings from '../models/RunnerEarnings.js';
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

// 12. Shift Clock-In
router.post('/shift/clock-in', authenticate, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let shift = await DeliveryShift.findOne({
      runner: req.user._id,
      status: 'Active',
      createdAt: { $gte: todayStart },
    });

    if (!shift) {
      shift = await DeliveryShift.create({
        runner: req.user._id,
        dutyDate: new Date(),
        clockInTime: new Date(),
        campus: req.user.assignedZone?.officeComplex || 'Embassy TechVillage',
        outlet: req.user.outlet,
        status: 'Active',
      });
    }

    await User.findByIdAndUpdate(req.user._id, { dutyStatus: 'Online' });

    res.json({ success: true, shift });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 13. Shift Clock-Out & Summary
router.post('/shift/clock-out', authenticate, async (req, res) => {
  try {
    const shift = await DeliveryShift.findOne({
      runner: req.user._id,
      status: 'Active',
    }).sort({ createdAt: -1 });

    const now = new Date();
    let totalOnlineMinutes = 0;
    if (shift) {
      const diffMs = now.getTime() - new Date(shift.clockInTime).getTime();
      totalOnlineMinutes = Math.max(1, Math.round(diffMs / 60000));
      shift.clockOutTime = now;
      shift.totalOnlineMinutes = totalOnlineMinutes;
      shift.status = 'Completed';
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const deliveredOrders = await Order.find({
      assignedTo: req.user._id,
      status: 'Delivered',
      updatedAt: { $gte: todayStart },
    });

    const deliveriesCount = deliveredOrders.length;
    const onTimeDeliveries = deliveredOrders.filter(
      (o) => !o.slaDeadline || new Date(o.updatedAt) <= new Date(o.slaDeadline)
    ).length;

    const slaRate = deliveriesCount > 0 ? (onTimeDeliveries / deliveriesCount) * 100 : 100.0;

    if (shift) {
      shift.totalDeliveries = deliveriesCount;
      shift.onTimeDeliveries = onTimeDeliveries;
      shift.slaRate = Math.round(slaRate * 10) / 10;
      await shift.save();
    }

    // Calculate earnings
    const baseShiftPay = 350.0;
    const perOrderPay = deliveriesCount * 30.0;
    const batchBonus = Math.floor(deliveriesCount / 3) * 20.0;
    const tips = 0.0;
    const netEarnings = baseShiftPay + perOrderPay + batchBonus + tips;

    let earnings = await RunnerEarnings.findOne({
      runner: req.user._id,
      date: { $gte: todayStart },
    });

    if (!earnings) {
      earnings = await RunnerEarnings.create({
        runner: req.user._id,
        shift: shift ? shift._id : null,
        date: new Date(),
        deliveriesCount,
        baseShiftPay,
        perOrderPay,
        batchBonus,
        tips,
        netEarnings,
        settlementStatus: 'Pending',
      });
    } else {
      earnings.deliveriesCount = deliveriesCount;
      earnings.perOrderPay = perOrderPay;
      earnings.batchBonus = batchBonus;
      earnings.netEarnings = netEarnings;
      await earnings.save();
    }

    await User.findByIdAndUpdate(req.user._id, { dutyStatus: 'Offline' });

    res.json({
      success: true,
      message: 'Shift closed successfully',
      shift,
      earnings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 14. Earnings Summary (Today & Weekly)
router.get('/earnings/summary', authenticate, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const deliveredToday = await Order.countDocuments({
      assignedTo: req.user._id,
      status: 'Delivered',
      updatedAt: { $gte: todayStart },
    });

    let todayEarnings = await RunnerEarnings.findOne({
      runner: req.user._id,
      date: { $gte: todayStart },
    });

    const basePay = 350.0;
    const orderPay = deliveredToday * 30.0;
    const batchBonus = Math.floor(deliveredToday / 3) * 20.0;
    const tips = todayEarnings?.tips || 0.0;
    const net = basePay + orderPay + batchBonus + tips;

    // Past 7 days calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const pastEarnings = await RunnerEarnings.find({
      runner: req.user._id,
      date: { $gte: sevenDaysAgo },
    });

    const weeklyTotal = pastEarnings.reduce((acc, curr) => acc + curr.netEarnings, 0) + net;

    res.json({
      success: true,
      today: {
        deliveriesCount: deliveredToday,
        baseShiftPay: basePay,
        perOrderPay: orderPay,
        batchBonus,
        tips,
        netEarnings: net,
        settlementStatus: todayEarnings?.settlementStatus || 'Pending',
      },
      weeklyTotal,
      weeklyDeliveries: pastEarnings.reduce((acc, curr) => acc + curr.deliveriesCount, 0) + deliveredToday,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 15. Earnings & Shift History
router.get('/earnings/history', authenticate, async (req, res) => {
  try {
    const history = await RunnerEarnings.find({ runner: req.user._id })
      .sort({ date: -1 })
      .limit(30)
      .populate('shift');

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 16. Raise Earnings Dispute / Ticket
router.post('/disputes', authenticate, async (req, res) => {
  try {
    const { reason, notes, earningsId } = req.body;
    if (!reason) {
      return res.status(400).json({ message: 'Dispute reason is required' });
    }

    if (earningsId) {
      await RunnerEarnings.findByIdAndUpdate(earningsId, {
        settlementStatus: 'Disputed',
        disputeReason: reason,
        disputeNotes: notes || '',
      });
    }

    res.json({
      success: true,
      ticketId: `DISP-${Date.now().toString().slice(-6)}`,
      message: 'Dispute ticket registered. Operations manager will review within 24 hours.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
