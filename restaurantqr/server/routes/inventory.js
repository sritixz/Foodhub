import express from 'express';
import Inventory from '../models/Inventory.js';
import authenticate from '../middleware/auth.js';
import { companyAdminOrAdmin } from '../middleware/roleAuth.js';

const router = express.Router();

// Get all inventory items (protected)
router.get('/', authenticate, async (req, res) => {
  try {
    const { branch, category, lowStock } = req.query;
    const query = {};

    if (branch) query.branch = branch;
    if (category) query.category = category;
    if (lowStock === 'true') {
      // Find items where quantity is less than threshold
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

// Get single inventory item (protected)
router.get('/:id', authenticate, async (req, res) => {
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

// Create inventory item (protected)
router.post('/', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const inventory = new Inventory(req.body);
    const savedInventory = await inventory.save();
    const populated = await Inventory.findById(savedInventory._id).populate('branch', 'name outletId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update inventory item (protected)
router.put('/:id', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: new Date() },
      { new: true, runValidators: true }
    ).populate('branch', 'name outletId');
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    res.json(inventory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update inventory quantity (protected)
router.patch('/:id/quantity', authenticate, companyAdminOrAdmin, async (req, res) => {
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
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Transfer stock between outlets (protected)
router.post('/transfer', authenticate, companyAdminOrAdmin, async (req, res) => {
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

    res.json({
      source: await Inventory.findById(sourceItem._id).populate('branch', 'name outletId'),
      destination: await Inventory.findById(destItem._id).populate('branch', 'name outletId'),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete inventory item (protected)
router.delete('/:id', authenticate, companyAdminOrAdmin, async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndDelete(req.params.id);
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
