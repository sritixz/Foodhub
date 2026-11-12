import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/roleAuth.js';
import DailyLedger from '../models/DailyLedger.js';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Warehouse from '../models/Warehouse.js';
import Inventory from '../models/Inventory.js';

const router = express.Router();

// SSE Clients Registry for Real-time Ledger Updates
const ledgerClients = new Map();

// @route   GET /api/ledger/stream
// @desc    SSE endpoint for real-time daily ledger updates
// @access  Public / Authenticated
router.get('/stream', (req, res) => {
  const clientId = uuidv4();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  ledgerClients.set(clientId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  req.on('close', () => {
    ledgerClients.delete(clientId);
  });
});

export const broadcastLedgerUpdate = (data) => {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  ledgerClients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending ledger SSE message:', error);
    }
  });
};

// @route   GET /api/ledger/daily
// @desc    Get all outlet ledgers for a specific date
// @access  Owner, Management
router.get('/daily', authenticate, authorize('Owner', 'Management'), async (req, res) => {
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
// @access  Owner, Management, Outlet Sales Representative
router.get('/outlet', authenticate, async (req, res) => {
  try {
    const { date, outletId } = req.query;
    
    if (!date || !outletId) {
      return res.status(400).json({ message: 'Date and Outlet ID are required' });
    }

    // Basic access control
    if (['Outlet Sales Representative'].includes(req.user.role) && req.user.outlet.toString() !== outletId) {
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
// @access  Outlet Sales Representative, Owner, Management
router.get('/calculate-sales', authenticate, async (req, res) => {
  try {
    const { date, outletId } = req.query;
    
    if (!date || !outletId) {
      return res.status(400).json({ message: 'Date and Outlet ID are required' });
    }

    // Basic access control
    if (['Outlet Sales Representative'].includes(req.user.role) && req.user.outlet.toString() !== outletId) {
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
// @access  Outlet Sales Representative, Owner, Management
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { date, outlet, items, collections, expenses, financials } = req.body;

    if (!date || !outlet || !items) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Basic access control
    if (['Outlet Sales Representative'].includes(req.user.role) && req.user.outlet.toString() !== outlet) {
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
    broadcastLedgerUpdate({ type: 'ledger_submitted', outlet, date, ledger });
    res.json(ledger);
  } catch (err) {
    console.error('Error submitting ledger:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/ledger/dispatch
// @desc    Central Kitchen dispatches sentQty to an outlet ledger & auto-deducts warehouse inventory
// @access  Owner, Management, Central Kitchen Manager
router.post('/dispatch', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const { date, outlet, items, sourceWarehouse } = req.body;
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

    // 1. Auto-deduct from Central Kitchen Warehouse inventoryItems
    let sourceWh = null;
    if (sourceWarehouse) {
      sourceWh = await Warehouse.findById(sourceWarehouse);
    } else {
      sourceWh = await Warehouse.findOne({ isCentralKitchen: true, linkedOutlets: outlet })
              || await Warehouse.findOne({ isCentralKitchen: true });
    }

    if (sourceWh && Array.isArray(sourceWh.inventoryItems)) {
      for (const dispatchItem of items) {
        const menuItemDoc = await MenuItem.findById(dispatchItem.menuItem);
        if (!menuItemDoc) continue;

        const whItem = sourceWh.inventoryItems.find(wi => 
          (wi.sku && menuItemDoc.sku && wi.sku === menuItemDoc.sku) ||
          (wi.name && menuItemDoc.name && wi.name.toLowerCase() === menuItemDoc.name.toLowerCase())
        );

        if (whItem) {
          whItem.quantity = Math.max(0, whItem.quantity - (dispatchItem.sentQty || 0));
        }
      }
      await sourceWh.save();
    }

    // 2. Synchronize with Outlet Branch Inventory (Inventory collection)
    for (const dispatchItem of items) {
      const menuItemDoc = await MenuItem.findById(dispatchItem.menuItem);
      if (!menuItemDoc) continue;

      let branchItem = await Inventory.findOne({
        branch: outlet,
        $or: [
          { name: menuItemDoc.name },
          ...(menuItemDoc.sku ? [{ sku: menuItemDoc.sku }] : [])
        ]
      });

      if (branchItem) {
        branchItem.quantity += (dispatchItem.sentQty || 0);
        branchItem.lastUpdated = new Date();
        await branchItem.save();
      }
    }

    // 3. Real-time broadcast to connected clients via SSE
    broadcastLedgerUpdate({
      type: 'stock_dispatched',
      outlet,
      date,
      ledger,
      sourceWarehouseId: sourceWh?._id || null
    });

    res.json({
      ledger,
      warehouseDeducted: !!sourceWh,
      sourceWarehouse: sourceWh?.name || null
    });
  } catch (err) {
    console.error('Error dispatching to ledger:', err.message);
    res.status(500).send('Server Error');
  }
});

// R2: Morning Goods-Receipt Inspection (Accepted / Short / Damaged)
router.post('/daily-dispatch/inspect', authenticate, authorize('Owner', 'Management', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const { outlet, date, inspectedItems, managerName, comments } = req.body;
    if (!outlet || !date || !Array.isArray(inspectedItems)) {
      return res.status(400).json({ message: 'outlet, date, and inspectedItems array are required' });
    }

    let ledger = await DailyLedger.findOne({ date, outlet });
    if (!ledger) {
      ledger = new DailyLedger({ date, outlet, items: [], status: 'Draft' });
    }

    for (const insp of inspectedItems) {
      const existing = ledger.items.find(
        (li) => li.menuItem && li.menuItem.toString() === insp.itemId.toString()
      );
      if (existing) {
        existing.wastageQty = (existing.wastageQty || 0) + (Number(insp.damagedQty) || 0);
        existing.closingStock = Math.max(0, (Number(insp.acceptedQty) || 0) - (existing.soldQty || 0));
      }

      // Sync good stock with Inventory collection
      if (insp.itemName) {
        const inv = await Inventory.findOne({ branch: outlet, name: insp.itemName });
        if (inv) {
          inv.quantity = (inv.quantity || 0) + (Number(insp.acceptedQty) || 0);
          inv.lastUpdated = new Date();
          await inv.save();
        }
      }
    }

    ledger.receiptConfirmation = {
      confirmedBy: managerName || req.user.name,
      confirmedAt: new Date(),
      comments: comments || '',
      items: inspectedItems,
    };
    await ledger.save();

    broadcastLedgerUpdate({ type: 'goods_receipt_confirmed', outlet, date, ledger });
    res.json({ success: true, message: 'Morning goods receipt recorded', ledger });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// R5: Submit Daily Cash Settlement & Denomination Reconciliation
router.post('/daily-settlement', authenticate, authorize('Owner', 'Management', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const {
      outlet,
      date,
      openingCash,
      cashSales,
      cashRefunds,
      pettyCashExpenses,
      countedPhysicalCash,
      digitalPaymentsTotal,
      manualCounterSalesTotal,
      discrepancyNotes,
      denominations,
    } = req.body;

    if (!outlet || !date) {
      return res.status(400).json({ message: 'outlet and date are required' });
    }

    let ledger = await DailyLedger.findOne({ date, outlet });
    if (!ledger) {
      ledger = new DailyLedger({ date, outlet, items: [], status: 'Submitted' });
    } else {
      ledger.status = 'Submitted';
    }

    const expectedCash = (Number(openingCash) || 0) + (Number(cashSales) || 0) - (Number(cashRefunds) || 0) - (Number(pettyCashExpenses) || 0);
    const variance = (Number(countedPhysicalCash) || 0) - expectedCash;

    ledger.settlement = {
      openingCash: Number(openingCash) || 0,
      cashSales: Number(cashSales) || 0,
      cashRefunds: Number(cashRefunds) || 0,
      pettyCashExpenses: Number(pettyCashExpenses) || 0,
      countedPhysicalCash: Number(countedPhysicalCash) || 0,
      expectedCash,
      variance,
      digitalPaymentsTotal: Number(digitalPaymentsTotal) || 0,
      manualCounterSalesTotal: Number(manualCounterSalesTotal) || 0,
      discrepancyNotes: discrepancyNotes || '',
      denominations: denominations || [],
      submittedBy: req.user.name,
      submittedAt: new Date(),
      status: 'Submitted',
    };

    await ledger.save();
    broadcastLedgerUpdate({ type: 'settlement_submitted', outlet, date, ledger });
    res.json({ success: true, message: 'Daily settlement submitted', settlement: ledger.settlement, ledger });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// R5: Fetch Settlement History
router.get('/settlements', authenticate, async (req, res) => {
  try {
    const { outlet } = req.query;
    const query = { 'settlement.submittedAt': { $exists: true } };
    if (outlet) query.outlet = outlet;

    const ledgers = await DailyLedger.find(query)
      .populate('outlet', 'name outletId')
      .sort({ date: -1 })
      .limit(30);

    const settlements = ledgers.map((l) => ({
      id: l._id,
      outletId: l.outlet?.outletId || l.outlet?._id,
      outletName: l.outlet?.name || '',
      shiftDate: l.date,
      ...l.settlement,
    }));

    res.json({ success: true, settlements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
