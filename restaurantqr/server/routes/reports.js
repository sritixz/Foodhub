import express from 'express';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

const getMatchByRole = (user) => {
  if (user.role === 'Vendor' && user.outlet) {
    return { vendor: user.outlet };
  }
  if (user.role === 'Company Admin') {
    return { orderType: 'Bulk' };
  }
  return {};
};

router.get('/summary', authenticate, async (req, res) => {
  try {
    const match = getMatchByRole(req.user);

    const [orderStats] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$amount' },
        },
      },
    ]);

    const statusBreakdown = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          totalOrders: { $sum: 1 },
        },
      },
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
      { $limit: 5 },
    ]);

    const itemDetails = await MenuItem.find({
      _id: { $in: topItems.map((item) => item._id) },
    }).select('name category');

    const mappedTopItems = topItems.map((item) => {
      const detail = itemDetails.find((d) => d._id.toString() === item._id.toString());
      return {
        itemId: item._id,
        name: detail?.name || 'Unknown',
        category: detail?.category || 'N/A',
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
      };
    });

    res.json({
      totalOrders: orderStats?.totalOrders || 0,
      totalRevenue: orderStats?.totalRevenue || 0,
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.totalOrders;
        return acc;
      }, {}),
      topItems: mappedTopItems,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
