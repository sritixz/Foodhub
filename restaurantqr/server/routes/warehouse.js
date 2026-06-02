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

// Create warehouse (Admin/Company Admin)
router.post('/', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const warehouse = new Warehouse(req.body);
    const savedWarehouse = await warehouse.save();
    res.status(201).json(savedWarehouse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update warehouse (Admin/Company Admin)
router.put('/:id', authenticate, authorize('Admin', 'Company Admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update warehouse inventory (Vendor/Admin/Company Admin)
router.put('/:id/inventory', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      { inventoryItems: req.body.inventoryItems || [] },
      { new: true, runValidators: true }
    );

    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    res.json(warehouse);
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
