import express from 'express';
import { authenticate} from '../middleware/auth.js';
import {authorize } from '../middleware/roleAuth.js';
import DailyLedger from '../models/DailyLedger.js';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';

const router = express.Router();

// @route   GET /api/ledger/daily
// @desc    Get all outlet ledgers for a specific date
// @access  Admin, Company Admin
router.get('/daily', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { date } = req.query; // 'YYYY-MM-DD'
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const ledgers = await DailyLedger.find({ date })
      .populate('outlet', 'name outletId')
      .populate('submittedBy', 'name role')
      .populate('items.menuItem', 'name category foodType')
      .sort({ 'outlet.name': 1 });

    res.json(ledgers);
  } catch (err) {
    console.error('Error fetching daily ledgers:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/ledger/outlet
// @desc    Get specific outlet ledger data
// @access  Admin, Company Admin, Vendor, Staff
router.get('/outlet', authenticate, async (req, res) => {
  try {
    const { date, outletId } = req.query;
    
    if (!date || !outletId) {
      return res.status(400).json({ message: 'Date and Outlet ID are required' });
    }

    // Basic access control
    if (['Vendor', 'Staff'].includes(req.user.role) && req.user.outlet.toString() !== outletId) {
       return res.status(403).json({ message: 'Not authorized for this outlet' });
    }

    const ledger = await DailyLedger.findOne({ date, outlet: outletId })
      .populate('items.menuItem', 'name category foodType')
      .populate('submittedBy', 'name role');

    if (!ledger) {
      return res.status(404).json({ message: 'Ledger not found for this date and outlet' });
    }

    res.json(ledger);
  } catch (err) {
    console.error('Error fetching outlet ledger:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/ledger/calculate-sales
// @desc    Fetch digital sales from orders to pre-fill EOD form
// @access  Vendor, Staff, Admin
router.get('/calculate-sales', authenticate, async (req, res) => {
  try {
    const { date, outletId } = req.query;
    
    if (!date || !outletId) {
      return res.status(400).json({ message: 'Date and Outlet ID are required' });
    }

    // Basic access control
    if (['Vendor', 'Staff'].includes(req.user.role) && req.user.outlet.toString() !== outletId) {
       return res.status(403).json({ message: 'Not authorized for this outlet' });
    }

    // Date range for the specific day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Aggregate sold items from Paid or Delivered orders
    const salesData = await Order.aggregate([
      {
        $match: {
          vendor: outletId, // Assuming Order has 'vendor' field for outlet
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $nin: ['Cancelled'] }, // Only count non-cancelled
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.menuItem",
          digitalSoldQty: {
            $sum: { $cond: [{ $eq: ["$orderType", "QR"] }, "$items.quantity", 0] }
          },
          posSoldQty: {
            $sum: { $cond: [{ $in: ["$orderType", ["Retail", "Bulk"]] }, "$items.quantity", 0] }
          },
          digitalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
        }
      }
    ]);

    res.json(salesData);
  } catch (err) {
    console.error('Error calculating sales:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/ledger/submit
// @desc    Submit End-of-Day ledger
// @access  Vendor, Staff, Admin
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { date, outlet, items, collections, expenses, financials } = req.body;

    if (!date || !outlet || !items) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Basic access control
    if (['Vendor', 'Staff'].includes(req.user.role) && req.user.outlet.toString() !== outlet) {
       return res.status(403).json({ message: 'Not authorized to submit for this outlet' });
    }

    // Find if ledger exists to update, or create new
    let ledger = await DailyLedger.findOne({ date, outlet });

    if (ledger) {
      if (ledger.status === 'Approved') {
         return res.status(400).json({ message: 'Cannot modify an approved ledger' });
      }
      ledger.items = items;
      ledger.collections = collections;
      ledger.expenses = expenses;
      ledger.financials = financials;
      ledger.submittedBy = req.user.id;
      ledger.status = 'Submitted';
    } else {
      ledger = new DailyLedger({
        date,
        outlet,
        submittedBy: req.user.id,
        items,
        collections,
        expenses,
        financials,
        status: 'Submitted'
      });
    }

    await ledger.save();
    res.json(ledger);
  } catch (err) {
    console.error('Error submitting ledger:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/ledger/dispatch
// @desc    Central Kitchen dispatches sentQty to an outlet ledger
// @access  Admin, Company Admin
router.post('/dispatch', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const { date, outlet, items } = req.body;
    if (!date || !outlet || !items) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let ledger = await DailyLedger.findOne({ date, outlet });
    if (!ledger) {
      // Create draft
      ledger = new DailyLedger({
        date,
        outlet,
        submittedBy: req.user.id,
        items: items.map(i => ({
          menuItem: i.menuItem,
          sentQty: i.sentQty,
          costPrice: i.costPrice || 0,
          sellingPrice: i.sellingPrice || 0,
        })),
        status: 'Draft'
      });
    } else {
      if (ledger.status === 'Approved') {
         return res.status(400).json({ message: 'Cannot modify an approved ledger' });
      }
      // Update existing items
      items.forEach(dispatchItem => {
        const existingItemIndex = ledger.items.findIndex(i => i.menuItem.toString() === dispatchItem.menuItem.toString());
        if (existingItemIndex > -1) {
          ledger.items[existingItemIndex].sentQty = dispatchItem.sentQty;
          // recalculate wastage/costing if needed
          const totalSold = ledger.items[existingItemIndex].totalSoldQty || 0;
          ledger.items[existingItemIndex].wastageQty = dispatchItem.sentQty - totalSold;
          ledger.items[existingItemIndex].costing = dispatchItem.sentQty * ledger.items[existingItemIndex].costPrice;
        } else {
          ledger.items.push({
            menuItem: dispatchItem.menuItem,
            sentQty: dispatchItem.sentQty,
            costPrice: dispatchItem.costPrice || 0,
            sellingPrice: dispatchItem.sellingPrice || 0,
            wastageQty: dispatchItem.sentQty,
            costing: dispatchItem.sentQty * (dispatchItem.costPrice || 0)
          });
        }
      });
    }

    // Recalculate totals
    let totalRevenue = 0, totalCosting = 0, grossProfit = 0;
    ledger.items.forEach(i => {
      totalRevenue += i.revenue || 0;
      totalCosting += i.costing || 0;
      grossProfit += (i.revenue || 0) - (i.costing || 0);
      i.grossProfit = (i.revenue || 0) - (i.costing || 0);
    });

    const totalExpenses = (ledger.expenses?.salary || 0) + (ledger.expenses?.transport || 0) + (ledger.expenses?.corp || 0) + (ledger.expenses?.other || 0);
    
    ledger.financials = {
      totalRevenue,
      totalCosting,
      grossProfit,
      indirectExpenses: totalExpenses,
      netProfit: grossProfit - totalExpenses
    };

    await ledger.save();
    res.json(ledger);
  } catch (err) {
    console.error('Error dispatching to ledger:', err.message);
    res.status(500).send('Server Error');
  }
});

export default router;
