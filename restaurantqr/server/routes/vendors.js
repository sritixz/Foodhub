import express from 'express';
import mongoose from 'mongoose';
import Outlet from '../models/Outlet.js';
import Order from '../models/Order.js';
import Payout from '../models/Payout.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

const isVendorAllowed = (req, outletId) => {
  if (['Admin', 'Company Admin'].includes(req.user.role)) {
    return true;
  }
  if (req.user.role === 'Vendor' && req.user.outlet?.toString() === outletId.toString()) {
    return true;
  }
  return false;
};

// Get vendor list (Admin/Company Admin) or own outlet (Vendor)
router.get('/', authenticate, authorize('Admin', 'Company Admin', 'Vendor'), async (req, res) => {
  try {
    if (req.user.role === 'Vendor') {
      const vendorOutlet = await Outlet.findById(req.user.outlet);
      return res.json(vendorOutlet ? [vendorOutlet] : []);
    }

    const outlets = await Outlet.find().sort({ createdAt: -1 });
    res.json(outlets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get vendor earnings with commission breakdown
router.get('/:id/earnings', authenticate, async (req, res) => {
  try {
    const outletId = req.params.id;
    if (!isVendorAllowed(req, outletId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { startDate, endDate, period } = req.query;
    const match = { vendor: new mongoose.Types.ObjectId(outletId) };

    // Date filtering
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    } else if (period) {
      const now = new Date();
      match.createdAt = {};
      if (period === 'today') {
        match.createdAt.$gte = new Date(now.setHours(0, 0, 0, 0));
      } else if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        match.createdAt.$gte = weekAgo;
      } else if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        match.createdAt.$gte = monthAgo;
      }
    }

    // Get outlet commission rate
    const outlet = await Outlet.findById(outletId).select('commissionRate name');
    const commissionRate = outlet?.commissionRate || 0;

    // Aggregate orders
    const summary = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          totalRevenue: { $sum: '$amount' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    // Only count delivered orders for actual earnings
    const deliveredStats = summary.find(s => s._id === 'Delivered') || { totalRevenue: 0, totalOrders: 0 };
    const allStats = summary.reduce(
      (acc, item) => {
        acc.totalRevenue += item.totalRevenue;
        acc.totalOrders += item.totalOrders;
        acc.statusBreakdown[item._id] = {
          totalOrders: item.totalOrders,
          totalRevenue: item.totalRevenue,
        };
        return acc;
      },
      { totalOrders: 0, totalRevenue: 0, statusBreakdown: {} }
    );

    // Commission calculation (only on delivered orders)
    const grossEarnings = deliveredStats.totalRevenue;
    const commissionAmount = (grossEarnings * commissionRate) / 100;
    const netEarnings = grossEarnings - commissionAmount;

    // Get paid out amount
    const paidOut = await Payout.aggregate([
      { $match: { vendor: new mongoose.Types.ObjectId(outletId), status: 'Paid' } },
      { $group: { _id: null, totalPaid: { $sum: '$netPayout' } } },
    ]);
    const totalPaidOut = paidOut[0]?.totalPaid || 0;

    // Daily revenue trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyTrend = await Order.aggregate([
      {
        $match: {
          vendor: new mongoose.Types.ObjectId(outletId),
          status: 'Delivered',
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      vendorName: outlet?.name,
      commissionRate,
      totalOrders: allStats.totalOrders,
      totalRevenue: allStats.totalRevenue,
      statusBreakdown: allStats.statusBreakdown,
      // Earnings (delivered orders only)
      deliveredOrders: deliveredStats.totalOrders,
      grossEarnings,
      commissionAmount,
      netEarnings,
      // Payout status
      totalPaidOut,
      pendingPayout: netEarnings - totalPaidOut,
      // Trend
      dailyTrend,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update commission rate (Admin only)
router.patch('/:id/commission', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { commissionRate } = req.body;

    if (commissionRate === undefined || commissionRate === null) {
      return res.status(400).json({ message: 'commissionRate is required' });
    }

    if (commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ message: 'Commission rate must be between 0 and 100' });
    }

    const outlet = await Outlet.findByIdAndUpdate(
      req.params.id,
      { commissionRate: Number(commissionRate) },
      { new: true, runValidators: true }
    );

    if (!outlet) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({ message: 'Commission rate updated', commissionRate: outlet.commissionRate, vendor: outlet.name });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get payouts for a vendor
router.get('/:id/payouts', authenticate, async (req, res) => {
  try {
    const outletId = req.params.id;
    if (!isVendorAllowed(req, outletId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status, limit = 20 } = req.query;
    const query = { vendor: outletId };
    if (status) query.status = status;

    const payouts = await Payout.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(payouts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a payout (Admin only)
router.post('/:id/payouts', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const outletId = req.params.id;
    const { periodStart, periodEnd, notes } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ message: 'periodStart and periodEnd are required' });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (start >= end) {
      return res.status(400).json({ message: 'periodStart must be before periodEnd' });
    }

    // Get outlet commission rate
    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Calculate earnings for the period (only delivered orders)
    const periodOrders = await Order.aggregate([
      {
        $match: {
          vendor: new mongoose.Types.ObjectId(outletId),
          status: 'Delivered',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const stats = periodOrders[0] || { totalRevenue: 0, totalOrders: 0 };
    const commissionRate = outlet.commissionRate || 0;
    const commissionAmount = (stats.totalRevenue * commissionRate) / 100;
    const netPayout = stats.totalRevenue - commissionAmount;

    if (netPayout <= 0) {
      return res.status(400).json({ message: 'No earnings to pay out for this period' });
    }

    const payout = new Payout({
      vendor: outletId,
      periodStart: start,
      periodEnd: end,
      totalOrders: stats.totalOrders,
      grossRevenue: stats.totalRevenue,
      commissionRate,
      commissionAmount,
      netPayout,
      status: 'Pending',
      notes: notes || null,
      createdBy: req.user._id,
    });

    const saved = await payout.save();
    const populated = await Payout.findById(saved._id).populate('createdBy', 'name');

    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update payout status (Admin only)
router.patch('/payouts/:payoutId/status', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Processing', 'Paid', 'Failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const update = { status };
    if (status === 'Paid') {
      update.paidAt = new Date();
    }

    const payout = await Payout.findByIdAndUpdate(
      req.params.payoutId,
      update,
      { new: true }
    ).populate('createdBy', 'name');

    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }

    res.json(payout);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all payouts (Admin - across all vendors)
router.get('/payouts/all', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;

    const payouts = await Payout.find(query)
      .populate('vendor', 'name outletId')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(payouts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
