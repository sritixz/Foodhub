import express from 'express';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

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

// Get menu items by outlet (for QR code scanning) — filters by status and active time slots
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

    // Filter by time slots and days for Custom Time Slots items
    const now = new Date();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayLabel = dayMap[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const filtered = menuItems.filter((item) => {
      if (item.availabilityType !== 'Custom Time Slots') return true;

      // Check day restriction
      if (item.days?.length > 0 && !item.days.includes(todayLabel)) return false;

      // Check time slots — item is available if NOW falls within ANY slot
      if (item.timeSlots?.length > 0) {
        return item.timeSlots.some((slot) => {
          if (!slot.start || !slot.end) return true;
          const [sh, sm] = slot.start.split(':').map(Number);
          const [eh, em] = slot.end.split(':').map(Number);
          const slotStart = sh * 60 + sm;
          const slotEnd = eh * 60 + em;
          return currentMinutes >= slotStart && currentMinutes <= slotEnd;
        });
      }
      return true;
    });

    res.json(filtered);
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

// Create menu item (protected - Vendor/Admin/Company Admin)
router.post('/', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), validateCategory, async (req, res) => {
  try {
    const menuItem = new MenuItem(req.body);
    const savedMenuItem = await menuItem.save();
    res.status(201).json(savedMenuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH status toggle (Available / Paused) — quick toggle without full update
router.patch('/:id/status', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Available', 'Paused', 'Draft'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('vendor', 'name outletId').populate('category', 'name');
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update menu item (protected - Vendor/Admin/Company Admin)
router.put('/:id', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), validateCategory, async (req, res) => {
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

// Delete menu item (protected - Vendor/Admin/Company Admin)
router.delete('/:id', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), async (req, res) => {
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
