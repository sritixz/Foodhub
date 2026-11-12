import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Inventory from '../models/Inventory.js';
import KitchenIndent from '../models/KitchenIndent.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

// SSE Clients Registry for Real-time Inventory Updates
const inventoryClients = new Map();

// @route   GET /api/inventory/stream
// @desc    SSE endpoint for real-time inventory updates across all users
// @access  Public / Authenticated
router.get('/stream', (req, res) => {
  const clientId = uuidv4();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  inventoryClients.set(clientId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  req.on('close', () => {
    inventoryClients.delete(clientId);
  });
});

export const broadcastInventoryUpdate = (data) => {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  inventoryClients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending inventory SSE message:', error);
    }
  });
};

// Get all inventory items (protected - Owner/Management/Central Kitchen Manager/Outlet Sales Representative)
router.get('/', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const { branch, category, lowStock } = req.query;
    const query = {};

    // Outlet Sales Representatives can only see their own outlet's inventory
    if (req.user.role === 'Outlet Sales Representative' && req.user.outlet) {
      query.branch = req.user.outlet;
    } else {
      if (branch) query.branch = branch;
    }

    if (category) query.category = category;
    if (lowStock === 'true') {
      const items = await Inventory.find(query).populate('branch', 'name outletId');
      const lowStockItems = items.filter(item => item.quantity < item.threshold);
      return res.json(lowStockItems);
    }

    const inventory = await Inventory.find(query)
      .populate('branch', 'name outletId')
      .sort({ name: 1 });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// R2/A2: Kitchen Indent Requests (List, Create, Update Status)
router.get('/indents', authenticate, async (req, res) => {
  try {
    const { outlet, status } = req.query;
    const query = {};
    if (outlet) query.outlet = outlet;
    if (status) query.status = status;

    const indents = await KitchenIndent.find(query)
      .populate('outlet', 'name outletId')
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, indents });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/indents', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const { outlet, itemName, requestedQty, urgency, notes } = req.body;
    const targetOutlet = outlet || req.user.outlet;
    if (!targetOutlet || !itemName || !requestedQty) {
      return res.status(400).json({ message: 'outlet, itemName, and requestedQty are required' });
    }

    const indentNumber = `IND-MOPY-${Date.now().toString().slice(-6)}`;
    const indent = new KitchenIndent({
      indentNumber,
      outlet: targetOutlet,
      requestedBy: req.user._id,
      itemName,
      requestedQty: Number(requestedQty),
      urgency: urgency || 'Normal',
      notes: notes || '',
      status: 'Raised',
    });

    await indent.save();
    broadcastInventoryUpdate({ type: 'indent_raised', outlet: targetOutlet, indent });
    res.status(201).json({ success: true, indent });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/indents/:indentId/status', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const { status } = req.body;
    const indent = await KitchenIndent.findByIdAndUpdate(
      req.params.indentId,
      { status },
      { new: true }
    );
    if (!indent) return res.status(404).json({ message: 'Indent not found' });
    broadcastInventoryUpdate({ type: 'indent_updated', outlet: indent.outlet, indent });
    res.json({ success: true, indent });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// R2: Log Wastage & Deduct from Inventory
router.post('/wastage', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const { outlet, itemId, itemName, quantity, reason } = req.body;
    const qty = Number(quantity) || 0;
    if (!qty || (!itemId && !itemName)) {
      return res.status(400).json({ message: 'quantity and itemId/itemName are required' });
    }

    const query = itemId ? { _id: itemId } : { branch: outlet || req.user.outlet, name: itemName };
    const invItem = await Inventory.findOne(query);
    if (invItem) {
      invItem.quantity = Math.max(0, invItem.quantity - qty);
      invItem.lastUpdated = new Date();
      await invItem.save();
      broadcastInventoryUpdate({ type: 'wastage_logged', branch: invItem.branch, item: invItem });
    }

    res.status(201).json({
      success: true,
      message: 'Wastage logged and stock adjusted',
      item: invItem || { itemName, quantity: qty, reason },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get single inventory item (protected - Owner/Management/Central Kitchen Manager/Outlet Sales Representative)
router.get('/:id', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id).populate('branch', 'name outletId');
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create inventory item (protected - Owner/Management/Central Kitchen Manager)
router.post('/', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const inventory = new Inventory(req.body);
    const savedInventory = await inventory.save();
    const populated = await Inventory.findById(savedInventory._id).populate('branch', 'name outletId');
    
    broadcastInventoryUpdate({
      type: 'item_created',
      branch: populated.branch?._id || populated.branch,
      item: populated
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update inventory item (protected - Owner/Management/Central Kitchen Manager)
router.put('/:id', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: new Date() },
      { new: true, runValidators: true }
    ).populate('branch', 'name outletId');
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    broadcastInventoryUpdate({
      type: 'item_updated',
      branch: inventory.branch?._id || inventory.branch,
      item: inventory
    });

    res.json(inventory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update inventory quantity (protected - Owner/Management/Central Kitchen Manager/Outlet Sales Representative)
router.patch('/:id/quantity', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' or 'subtract'
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    if (operation === 'add') {
      item.quantity += quantity;
    } else if (operation === 'subtract') {
      item.quantity = Math.max(0, item.quantity - quantity);
    } else {
      item.quantity = quantity;
    }

    item.lastUpdated = new Date();
    await item.save();
    
    const populated = await Inventory.findById(item._id).populate('branch', 'name outletId');

    broadcastInventoryUpdate({
      type: 'quantity_updated',
      branch: populated.branch?._id || populated.branch,
      item: populated,
      operation,
      adjustedQty: quantity
    });

    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Transfer stock between outlets (protected - Owner/Management/Central Kitchen Manager/Outlet Sales Representative)
router.post('/transfer', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative'), async (req, res) => {
  try {
    const { itemId, fromBranch, toBranch, quantity } = req.body;

    // Subtract from source
    const sourceItem = await Inventory.findOne({ _id: itemId, branch: fromBranch });
    if (!sourceItem || sourceItem.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    sourceItem.quantity -= quantity;
    sourceItem.lastUpdated = new Date();
    await sourceItem.save();

    // Add to destination (or create if doesn't exist)
    let destItem = await Inventory.findOne({ sku: sourceItem.sku, branch: toBranch });
    if (destItem) {
      destItem.quantity += quantity;
      destItem.lastUpdated = new Date();
      await destItem.save();
    } else {
      destItem = new Inventory({
        ...sourceItem.toObject(),
        _id: undefined,
        branch: toBranch,
        quantity: quantity,
        lastUpdated: new Date(),
      });
      await destItem.save();
    }

    const populatedSource = await Inventory.findById(sourceItem._id).populate('branch', 'name outletId');
    const populatedDest = await Inventory.findById(destItem._id).populate('branch', 'name outletId');

    broadcastInventoryUpdate({
      type: 'transfer_completed',
      fromBranch,
      toBranch,
      quantity,
      source: populatedSource,
      destination: populatedDest
    });

    res.json({
      source: populatedSource,
      destination: populatedDest,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete inventory item (protected - Owner/Management/Central Kitchen Manager)
router.delete('/:id', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager'), async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndDelete(req.params.id);
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    broadcastInventoryUpdate({
      type: 'item_deleted',
      branch: inventory.branch,
      id: req.params.id
    });

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
