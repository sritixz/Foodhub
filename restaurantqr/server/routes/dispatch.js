import express from 'express';
import DispatchOrder from '../models/DispatchOrder.js';
import ProductionBatch from '../models/ProductionBatch.js';
import MenuItem from '../models/MenuItem.js';
import Warehouse from '../models/Warehouse.js';
import Outlet from '../models/Outlet.js';
import DailyLedger from '../models/DailyLedger.js';
import Inventory from '../models/Inventory.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * @route   GET /api/dispatch/orders
 * @desc    Fetch dispatch orders with filters
 * @access  Authenticated
 */
router.get('/orders', authenticate, async (req, res) => {
  try {
    const { date, outletId, status } = req.query;
    const filter = {};
    if (date) filter.dispatchDate = date;
    if (outletId && outletId !== 'All') filter.targetOutlet = outletId;
    if (status && status !== 'All') filter.transitStatus = status;

    const orders = await DispatchOrder.find(filter)
      .populate('targetOutlet', 'name address building floor')
      .populate('sourceKitchen', 'name zone')
      .populate('receivedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error('Error fetching dispatch orders:', err);
    res.status(500).json({ message: 'Failed to fetch dispatch orders', error: err.message });
  }
});

/**
 * @route   GET /api/dispatch/orders/:id
 * @desc    Fetch single dispatch order by ID
 * @access  Authenticated
 */
router.get('/orders/:id', authenticate, async (req, res) => {
  try {
    const order = await DispatchOrder.findById(req.params.id)
      .populate('targetOutlet', 'name address building floor contactPhone')
      .populate('sourceKitchen', 'name address zone contactPhone')
      .populate('items.menuItem', 'name category image foodType basePrice costPrice')
      .populate('items.productionBatch', 'batchNumber prepDate expiryDate actualCostPerPlate')
      .populate('receivedBy', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Dispatch order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error('Error fetching dispatch order by ID:', err);
    res.status(500).json({ message: 'Failed to fetch dispatch order', error: err.message });
  }
});

/**
 * @route   POST /api/dispatch/orders
 * @desc    Create new dispatch manifest and sync with outlet ledger
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.post(
  '/orders',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const {
        targetOutlet,
        sourceKitchen,
        dispatchDate = new Date().toISOString().split('T')[0],
        items = [],
        runnerName = '',
        vehicleNumber = '',
        temperatureAtDeparture = null,
      } = req.body;

      if (!targetOutlet) {
        return res.status(400).json({ message: 'Target outlet is required' });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Items array cannot be empty' });
      }

      // Identify source kitchen
      let kitchen = null;
      if (sourceKitchen) {
        kitchen = await Warehouse.findById(sourceKitchen);
      }
      if (!kitchen) {
        kitchen = (await Warehouse.findOne({ isCentralKitchen: true })) || (await Warehouse.findOne({}));
      }
      if (!kitchen) {
        kitchen = new Warehouse({
          name: 'MOPY Central Commissary & Kitchen Hub',
          address: 'Plot 42, Food Tech Park, Industrial Corridor',
          city: 'Mumbai',
          state: 'Maharashtra',
          zone: 'West Zone',
          contactName: 'Executive Chef Anand',
          contactPhone: '+91 98765 43210',
          isCentralKitchen: true,
          isActive: true,
        });
        await kitchen.save();
      }

      // Generate unique Dispatch Number
      const datePart = dispatchDate.replace(/-/g, '');
      const countToday = await DispatchOrder.countDocuments({
        dispatchNumber: { $regex: `^DISP-${datePart}` },
      });
      const dispatchNumber = `DISP-${datePart}-${String(countToday + 1).padStart(3, '0')}`;

      // Process items and batch allocations
      const processedItems = [];
      const ledgerSyncItems = [];

      for (const item of items) {
        const menuItem = await MenuItem.findById(item.menuItem);
        if (!menuItem) continue;

        let unitCostPrice = Number(item.unitCostPrice);
        if (!unitCostPrice || unitCostPrice <= 0) {
          // Look up outlet-specific price from MenuItem
          const outletPricing = (menuItem.outletPricing || []).find(
            (op) => op.outlet?.toString() === targetOutlet.toString()
          );
          unitCostPrice = outletPricing?.costPrice || menuItem.costPrice || 0;
        }

        const qty = Number(item.dispatchedQty) || 0;
        const totalCost = parseFloat((qty * unitCostPrice).toFixed(2));

        // Deduct from ProductionBatch if linked
        let batchDoc = null;
        if (item.productionBatch) {
          batchDoc = await ProductionBatch.findById(item.productionBatch);
          if (batchDoc) {
            batchDoc.dispatchedQty = (batchDoc.dispatchedQty || 0) + qty;
            batchDoc.remainingStagedQty = Math.max(0, (batchDoc.remainingStagedQty || 0) - qty);
            if (batchDoc.remainingStagedQty === 0) {
              batchDoc.status = 'Dispatched';
            }
            await batchDoc.save();
          }
        }

        processedItems.push({
          menuItem: menuItem._id,
          dishName: menuItem.name,
          productionBatch: batchDoc?._id || null,
          batchNumber: batchDoc?.batchNumber || item.batchNumber || '',
          dispatchedQty: qty,
          acceptedQty: 0,
          damagedQty: 0,
          unitCostPrice,
          totalItemCost: totalCost,
        });

        ledgerSyncItems.push({
          menuItem: menuItem._id,
          sentQty: qty,
          costPrice: unitCostPrice,
          sellingPrice: menuItem.basePrice,
        });
      }

      const newOrder = new DispatchOrder({
        dispatchNumber,
        sourceKitchen: kitchen._id,
        targetOutlet,
        dispatchDate,
        items: processedItems,
        transitStatus: 'In-Transit',
        runnerName,
        vehicleNumber,
        temperatureAtDeparture,
        departureTime: new Date(),
      });

      newOrder.recalculateAggregates();
      await newOrder.save();

      // Automatically sync dispatched quantities into Outlet DailyLedger
      try {
        let ledger = await DailyLedger.findOne({ date: dispatchDate, outlet: targetOutlet });
        if (!ledger) {
          ledger = new DailyLedger({
            date: dispatchDate,
            outlet: targetOutlet,
            items: [],
          });
        }

        ledgerSyncItems.forEach((syncItem) => {
          const existingItem = ledger.items.find(
            (i) => i.menuItem?.toString() === syncItem.menuItem.toString()
          );
          if (existingItem) {
            existingItem.sentQty = (existingItem.sentQty || 0) + syncItem.sentQty;
            existingItem.costPrice = syncItem.costPrice;
            existingItem.sellingPrice = syncItem.sellingPrice;
          } else {
            ledger.items.push({
              menuItem: syncItem.menuItem,
              sentQty: syncItem.sentQty,
              costPrice: syncItem.costPrice,
              sellingPrice: syncItem.sellingPrice,
              digitalSoldQty: 0,
              counterSoldQty: 0,
              totalSoldQty: 0,
              wastageQty: 0,
              revenue: 0,
              costing: 0,
              grossProfit: 0,
              closingStock: syncItem.sentQty,
            });
          }
        });

        await ledger.save();
      } catch (ledgerErr) {
        console.warn('Warning: Could not auto-sync DailyLedger:', ledgerErr.message);
      }

      res.status(201).json({
        message: `Dispatch Manifest ${dispatchNumber} created and dispatched to outlet!`,
        dispatchOrder: newOrder,
      });
    } catch (err) {
      console.error('Error creating dispatch order:', err);
      res.status(500).json({ message: 'Failed to create dispatch order', error: err.message });
    }
  }
);

/**
 * @route   PUT /api/dispatch/orders/:id/status
 * @desc    Update transit status of dispatch order
 * @access  Authenticated
 */
router.put('/orders/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await DispatchOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Dispatch order not found' });
    }

    if (status) order.transitStatus = status;
    await order.save();

    res.json({ message: 'Dispatch status updated', dispatchOrder: order });
  } catch (err) {
    console.error('Error updating dispatch status:', err);
    res.status(500).json({ message: 'Failed to update dispatch status', error: err.message });
  }
});

/**
 * @route   POST /api/dispatch/orders/:id/receive
 * @desc    Spoke Outlet Goods Receipt (GRN): verify accepted vs damaged stock & update outlet inventory
 * @access  Authenticated
 */
router.post('/orders/:id/receive', authenticate, async (req, res) => {
  try {
    const {
      receivedItems = [],
      receiverNotes = '',
      grnPhotoUrl = '',
    } = req.body;

    const order = await DispatchOrder.findById(req.params.id).populate('targetOutlet');
    if (!order) {
      return res.status(404).json({ message: 'Dispatch order not found' });
    }

    // Process receiving verification line-by-line
    for (const rItem of receivedItems) {
      const match = order.items.find(
        (i) => i.menuItem?.toString() === rItem.menuItemId?.toString()
      );
      if (match) {
        match.acceptedQty = Math.max(0, Number(rItem.acceptedQty) || 0);
        match.damagedQty = Math.max(0, Number(rItem.damagedQty) || 0);
        match.discrepancyReason = rItem.discrepancyReason || '';

        // Commit accepted finished goods quantity into Outlet Live Inventory
        try {
          const sku = `SKU-FG-${match.dishName.replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase()}`;
          let outletStock = await Inventory.findOne({
            branch: order.targetOutlet._id,
            sku,
          });

          if (!outletStock) {
            outletStock = new Inventory({
              name: match.dishName,
              sku,
              unit: 'pcs',
              quantity: match.acceptedQty,
              threshold: 5,
              branch: order.targetOutlet._id,
              category: 'Other',
              costPrice: match.unitCostPrice,
              lastUpdated: new Date(),
            });
          } else {
            outletStock.quantity = (outletStock.quantity || 0) + match.acceptedQty;
            outletStock.costPrice = match.unitCostPrice;
            outletStock.lastUpdated = new Date();
          }
          await outletStock.save();
        } catch (invErr) {
          console.warn('Warning: Could not update outlet live stock:', invErr.message);
        }
      }
    }

    order.receivedBy = req.user?.id || null;
    order.receivedAt = new Date();
    order.receiverNotes = receiverNotes;
    order.grnPhotoUrl = grnPhotoUrl;
    order.transitStatus = 'Reconciled';

    order.recalculateAggregates();
    await order.save();

    res.json({
      message: `Goods Receipt Note (GRN) confirmed for ${order.dispatchNumber}. Stock committed to Outlet!`,
      dispatchOrder: order,
    });
  } catch (err) {
    console.error('Error confirming Goods Receipt (GRN):', err);
    res.status(500).json({ message: 'Failed to process goods receipt', error: err.message });
  }
});

export default router;
