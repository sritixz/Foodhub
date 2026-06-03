import express from 'express';
import Warehouse from '../models/Warehouse.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

// Get all warehouses (Admin/Company Admin/Vendor)
router.get('/', authenticate, authorize('Admin', 'Company Admin', 'Vendor'), async (req, res) => {
  try {
    const warehouses = await Warehouse.find()
      .populate('linkedOutlets', 'name outletId')
      .sort({ createdAt: -1 });
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get low-stock items across all warehouses — MUST be before /:id
router.get('/alerts/low-stock', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ isActive: true })
      .populate('linkedOutlets', 'name outletId')
      .select('name inventoryItems');

    const alerts = [];
    warehouses.forEach((warehouse) => {
      warehouse.inventoryItems.forEach((item) => {
        if (item.quantity <= item.threshold) {
          alerts.push({
            warehouseId: warehouse._id,
            warehouseName: warehouse.name,
            itemId: item._id,
            itemName: item.name,
            sku: item.sku,
            quantity: item.quantity,
            threshold: item.threshold,
            unit: item.unit,
          });
        }
      });
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single warehouse
router.get('/:id', authenticate, authorize('Admin', 'Company Admin', 'Vendor'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id)
      .populate('linkedOutlets', 'name outletId');
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create warehouse (Admin/Company Admin)
router.post('/', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const warehouse = new Warehouse(req.body);
    const saved = await warehouse.save();
    const populated = await Warehouse.findById(saved._id).populate('linkedOutlets', 'name outletId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update warehouse details (Admin/Company Admin)
router.put('/:id', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('linkedOutlets', 'name outletId');

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update inventory items (Vendor/Admin/Company Admin)
router.put('/:id/inventory', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      { inventoryItems: req.body.inventoryItems || [] },
      { new: true, runValidators: true }
    ).populate('linkedOutlets', 'name outletId');

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Adjust a single inventory item quantity (add/subtract)
router.patch('/:id/inventory/:itemId/adjust', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), async (req, res) => {
  try {
    const { operation, quantity } = req.body;

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    const item = warehouse.inventoryItems.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: 'quantity must be a positive number' });
    }

    if (operation === 'add') {
      item.quantity += qty;
    } else if (operation === 'subtract') {
      item.quantity = Math.max(0, item.quantity - qty);
    } else {
      return res.status(400).json({ message: 'operation must be "add" or "subtract"' });
    }

    await warehouse.save();
    const populated = await Warehouse.findById(warehouse._id).populate('linkedOutlets', 'name outletId');
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete warehouse (Admin only)
router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
