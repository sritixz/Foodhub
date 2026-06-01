import express from 'express';
import mongoose from 'mongoose';
import Outlet from '../models/Outlet.js';
import Order from '../models/Order.js';
import authenticate from '../middleware/auth.js';

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
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'Vendor') {
      const vendorOutlet = await Outlet.findById(req.user.outlet);
      return res.json(vendorOutlet ? [vendorOutlet] : []);
    }

    if (!['Admin', 'Company Admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const outlets = await Outlet.find().sort({ createdAt: -1 });
    res.json(outlets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get vendor earnings summary
router.get('/:id/earnings', authenticate, async (req, res) => {
  try {
    const outletId = req.params.id;
    if (!isVendorAllowed(req, outletId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const summary = await Order.aggregate([
      { $match: { vendor: new mongoose.Types.ObjectId(outletId) } },
      {
        $group: {
          _id: '$status',
          totalRevenue: { $sum: '$amount' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const totals = summary.reduce(
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

    res.json(totals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
