import express from 'express';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import authenticate from '../middleware/auth.js';
import { vendorOnly, companyAdminOrAdmin } from '../middleware/roleAuth.js';

const router = express.Router();

// Category validation middleware
async function validateCategory(req, res, next) {
  if (req.body.category) {
    // Check if category ID is valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }
    
    // Query Category collection to ensure category exists
    try {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(400).json({ message: 'Invalid category ID' });
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }
  }
  next();
}

// Get all menu items
router.get('/', async (req, res) => {
  try {
    const { vendor, category, status, outlet, foodType, q, minPrice, maxPrice } = req.query;
    const query = {};

    if (vendor) query.vendor = vendor;
    if (category) query.category = category;
    if (status) query.status = status;
    if (foodType) query.foodType = foodType;

    // Outlet filter: show items belonging to, assigned to, or applied to all for this outlet
    if (outlet) {
      const outletFilter = {
        $or: [
          { vendor: outlet },
          { outlets: outlet },
          { applyToAll: true },
        ],
      };
      query.$and = query.$and || [];
      query.$and.push(outletFilter);
    }

    if (q) {
      const searchFilter = {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ],
      };
      query.$and = query.$and || [];
      query.$and.push(searchFilter);
    }
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    const menuItems = await MenuItem.find(query)
      .populate('vendor', 'name outletId')
      .populate('outlets', 'name outletId')
      .populate('category', 'name description')
      .sort({ createdAt: -1 });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get menu items by outlet (for QR code scanning)
router.get('/outlet/:outletId', async (req, res) => {
  try {
    const { outletId } = req.params;
    const menuItems = await MenuItem.find({
      $or: [
        { vendor: outletId },
        { outlets: outletId },
        { applyToAll: true },
      ],
      status: 'Available',
    })
      .populate('vendor', 'name outletId')
      .populate('category', 'name description')
      .sort({ category: 1, name: 1 });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single menu item
router.get('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate('vendor', 'name outletId')
      .populate('outlets', 'name outletId')
      .populate('category', 'name description');
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create menu item (protected - Vendor/Admin)
router.post('/', authenticate, validateCategory, async (req, res) => {
  // Allow Vendor, Admin, or Company Admin
  if (!['Vendor', 'Admin', 'Company Admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const menuItem = new MenuItem(req.body);
    const savedMenuItem = await menuItem.save();
    res.status(201).json(savedMenuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update menu item (protected)
router.put('/:id', authenticate, validateCategory, async (req, res) => {
  // Allow Vendor, Admin, or Company Admin
  if (!['Vendor', 'Admin', 'Company Admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete menu item (protected)
router.delete('/:id', authenticate, async (req, res) => {
  // Allow Vendor, Admin, or Company Admin
  if (!['Vendor', 'Admin', 'Company Admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
