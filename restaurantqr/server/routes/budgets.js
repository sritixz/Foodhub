import express from 'express';
import Budget from '../models/Budget.js';
import Order from '../models/Order.js';
import Outlet from '../models/Outlet.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

// Helpers
const getPeriodStart = (period) => {
  const now = new Date();
  if (period === 'weekly') {
    const day = now.getDay(); // 0 = Sunday
    const diff = now.getDate() - day;
    return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
};

// GET /api/budgets — list all budgets (Admin / Company Admin)
router.get(
  '/',
  authenticate,
  authorize('Admin', 'Company Admin'),
  async (req, res) => {
    try {
      const budgets = await Budget.find()
        .populate('outletId', 'name outletId location businessType')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
      res.json(budgets);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// GET /api/budgets/spend/:outletId — current period spend for an outlet
// MUST be before /:id so Express doesn't match "spend" as an id
router.get(
  '/spend/:outletId',
  authenticate,
  authorize('Admin', 'Company Admin'),
  async (req, res) => {
    try {
      const { outletId } = req.params;

      // Verify outlet exists
      const outlet = await Outlet.findById(outletId);
      if (!outlet) {
        return res.status(404).json({ message: 'Outlet not found' });
      }

      // Look up the budget to know the period
      const budget = await Budget.findOne({ outletId });
      const periodStart = getPeriodStart(budget?.period || 'monthly');

      // Revenue = sum of completed order amounts for this outlet in the period
      const revenueResult = await Order.aggregate([
        {
          $match: {
            vendor: outlet._id,
            status: { $nin: ['Cancelled'] },
            createdAt: { $gte: periodStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const revenue = revenueResult[0]?.total ?? 0;

      // Procurement spend — sum of non-cancelled orders in the period
      // (treated as procurement spend proxy; a dedicated Warehouse Purchase model
      //  can replace this if the project adds one)
      const procurementResult = await Order.aggregate([
        {
          $match: {
            vendor: outlet._id,
            status: { $nin: ['Cancelled'] },
            createdAt: { $gte: periodStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      const procurement = procurementResult[0]?.total ?? 0;

      res.json({
        outletId,
        period: budget?.period || 'monthly',
        periodStart,
        procurement,
        revenue,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// GET /api/budgets/:id — single budget by budget _id
router.get(
  '/:id',
  authenticate,
  authorize('Admin', 'Company Admin'),
  async (req, res) => {
    try {
      const budget = await Budget.findById(req.params.id)
        .populate('outletId', 'name outletId location businessType')
        .populate('createdBy', 'name email');
      if (!budget) {
        return res.status(404).json({ message: 'Budget not found' });
      }
      res.json(budget);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// POST /api/budgets — create budget config for an outlet
router.post(
  '/',
  authenticate,
  authorize('Admin', 'Company Admin'),
  async (req, res) => {
    try {
      const {
        outletId,
        period,
        procurementLimit,
        perOrderLimit,
        salesTarget,
        alertThreshold,
        blockOnExceed,
      } = req.body;

      // Validate outlet exists
      const outlet = await Outlet.findById(outletId);
      if (!outlet) {
        return res.status(404).json({ message: 'Outlet not found' });
      }

      // Validate limits
      if (perOrderLimit > procurementLimit) {
        return res.status(400).json({
          message: 'Per-order limit cannot exceed procurement limit',
        });
      }

      // Upsert — if a budget already exists for this outlet, update it
      const budget = await Budget.findOneAndUpdate(
        { outletId },
        {
          outletId,
          period,
          procurementLimit,
          perOrderLimit,
          salesTarget,
          alertThreshold,
          blockOnExceed,
          createdBy: req.user._id,
        },
        { new: true, upsert: true, runValidators: true }
      )
        .populate('outletId', 'name outletId location businessType')
        .populate('createdBy', 'name email');

      res.status(201).json(budget);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: 'Budget already exists for this outlet' });
      }
      res.status(400).json({ message: err.message });
    }
  }
);

// PUT /api/budgets/:id — update existing budget
router.put(
  '/:id',
  authenticate,
  authorize('Admin', 'Company Admin'),
  async (req, res) => {
    try {
      const {
        period,
        procurementLimit,
        perOrderLimit,
        salesTarget,
        alertThreshold,
        blockOnExceed,
      } = req.body;

      if (perOrderLimit > procurementLimit) {
        return res.status(400).json({
          message: 'Per-order limit cannot exceed procurement limit',
        });
      }

      const budget = await Budget.findByIdAndUpdate(
        req.params.id,
        {
          period,
          procurementLimit,
          perOrderLimit,
          salesTarget,
          alertThreshold,
          blockOnExceed,
        },
        { new: true, runValidators: true }
      )
        .populate('outletId', 'name outletId location businessType')
        .populate('createdBy', 'name email');

      if (!budget) {
        return res.status(404).json({ message: 'Budget not found' });
      }

      res.json(budget);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// DELETE /api/budgets/:id — remove budget config
router.delete(
  '/:id',
  authenticate,
  authorize('Admin', 'Company Admin'),
  async (req, res) => {
    try {
      const budget = await Budget.findByIdAndDelete(req.params.id);
      if (!budget) {
        return res.status(404).json({ message: 'Budget not found' });
      }
      res.json({ message: 'Budget configuration removed' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
