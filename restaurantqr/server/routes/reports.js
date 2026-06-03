import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Outlet from '../models/Outlet.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

const getMatchByRole = (user, dateFilter) => {
  const match = {};

  if (user.role === 'Vendor' && user.outlet) {
    match.vendor = new mongoose.Types.ObjectId(user.outlet.toString());
  } else if (user.role === 'Company Admin') {
    match.orderType = 'Bulk';
  }

  if (dateFilter) {
    match.createdAt = dateFilter;
  }

  return match;
};

const parseDateRange = (query) => {
  const { startDate, endDate, period } = query;

  if (startDate || endDate) {
    const filter = {};
    if (startDate) filter.$gte = new Date(startDate);
    if (endDate) filter.$lte = new Date(endDate + 'T23:59:59.999Z');
    return filter;
  }

  if (period) {
    const now = new Date();
    const filter = {};
    if (period === 'today') {
      filter.$gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filter.$gte = weekAgo;
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filter.$gte = monthAgo;
    } else if (period === 'year') {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      filter.$gte = yearAgo;
    }
    return filter;
  }

  return null;
};

// Summary report
router.get('/summary', authenticate, authorize('Admin', 'Company Admin', 'Vendor'), async (req, res) => {
  try {
    const dateFilter = parseDateRange(req.query);
    const match = getMatchByRole(req.user, dateFilter);

    const [orderStats] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
          avgOrderValue: { $avg: '$amount' },
        },
      },
    ]);

    const statusBreakdown = await Order.aggregate([
      { $match: match },
      { $group: { _id: '$status', totalOrders: { $sum: 1 }, totalRevenue: { $sum: '$amount' } } },
    ]);

    const topItems = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItem',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    const itemDetails = await MenuItem.find({
      _id: { $in: topItems.map((item) => item._id) },
    }).select('name category').populate('category', 'name');

    const mappedTopItems = topItems.map((item) => {
      const detail = itemDetails.find((d) => d._id.toString() === item._id.toString());
      return {
        itemId: item._id,
        name: detail?.name || 'Unknown',
        category: detail?.category?.name || detail?.category || 'N/A',
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
      };
    });

    res.json({
      totalOrders: orderStats?.totalOrders || 0,
      totalRevenue: orderStats?.totalRevenue || 0,
      avgOrderValue: orderStats?.avgOrderValue || 0,
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = { orders: item.totalOrders, revenue: item.totalRevenue };
        return acc;
      }, {}),
      topItems: mappedTopItems,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Orders per day (daily trend)
router.get('/daily-orders', authenticate, authorize('Admin', 'Company Admin', 'Vendor'), async (req, res) => {
  try {
    const { days = 14 } = req.query;
    const daysBack = parseInt(days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const match = getMatchByRole(req.user, { $gte: startDate });

    const dailyData = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing days with zeros
    const result = [];
    for (let i = 0; i < daysBack; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyData.find((d) => d._id === dateStr);
      result.push({
        date: dateStr,
        orders: dayData?.orders || 0,
        revenue: dayData?.revenue || 0,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Revenue per outlet
router.get('/revenue-by-outlet', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const dateFilter = parseDateRange(req.query);
    const match = dateFilter ? { createdAt: dateFilter } : {};

    const outletRevenue = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$vendor',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
          deliveredRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, '$amount', 0] },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Populate outlet names
    const outletIds = outletRevenue.map((r) => r._id);
    const outlets = await Outlet.find({ _id: { $in: outletIds } }).select('name outletId');

    const result = outletRevenue.map((item) => {
      const outlet = outlets.find((o) => o._id.toString() === item._id?.toString());
      return {
        outletId: item._id,
        name: outlet?.name || 'Unknown',
        outletCode: outlet?.outletId || 'N/A',
        totalOrders: item.totalOrders,
        totalRevenue: item.totalRevenue,
        deliveredRevenue: item.deliveredRevenue,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Orders by type breakdown
router.get('/order-types', authenticate, authorize('Admin', 'Company Admin', 'Vendor'), async (req, res) => {
  try {
    const dateFilter = parseDateRange(req.query);
    const match = getMatchByRole(req.user, dateFilter);

    const typeBreakdown = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { orderType: '$orderType', deliveryMode: '$deliveryMode' },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
        },
      },
      { $sort: { totalOrders: -1 } },
    ]);

    res.json(typeBreakdown.map((item) => ({
      orderType: item._id.orderType,
      deliveryMode: item._id.deliveryMode,
      totalOrders: item.totalOrders,
      totalRevenue: item.totalRevenue,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export orders as CSV
router.get('/export/csv', authenticate, authorize('Admin', 'Company Admin', 'Vendor'), async (req, res) => {
  try {
    const dateFilter = parseDateRange(req.query);
    const match = getMatchByRole(req.user, dateFilter);

    const orders = await Order.find(match)
      .populate('vendor', 'name outletId')
      .populate('items.menuItem', 'name')
      .sort({ createdAt: -1 })
      .limit(1000);

    // Build CSV
    const headers = ['Order ID', 'Date', 'Customer', 'Outlet', 'Type', 'Delivery Mode', 'Items', 'Amount', 'Status'];
    const rows = orders.map((order) => {
      const items = order.items.map((i) => `${i.menuItem?.name || 'Item'} x${i.quantity}`).join('; ');
      return [
        order.orderId,
        new Date(order.createdAt).toISOString().split('T')[0],
        order.customer?.name || 'Guest',
        order.vendor?.name || 'N/A',
        order.orderType,
        order.deliveryMode,
        `"${items}"`,
        order.amount.toFixed(2),
        order.status,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders-report.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
