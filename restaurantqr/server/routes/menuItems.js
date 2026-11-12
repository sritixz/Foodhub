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
    if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }
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

// Get all menu items (with outlet filter, search, category, and custom pricing resolution)
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
          { 'outletPricing.outlet': outlet },
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
      .populate('vendor', 'name outletId category')
      .populate('outlets', 'name outletId category')
      .populate('category', 'name description')
      .populate('outletPricing.outlet', 'name outletId category')
      .sort({ createdAt: -1 });

    // If a specific outlet is requested, resolve effective price & custom status
    if (outlet) {
      const resolved = menuItems.map((item) => {
        const itemObj = item.toObject();
        const outletOverride = item.outletPricing?.find(
          (op) => op.outlet && (op.outlet._id?.toString() === outlet || op.outlet.toString() === outlet)
        );

        if (outletOverride) {
          itemObj.effectivePrice = outletOverride.price;
          itemObj.customOutletPrice = outletOverride.price;
          itemObj.hasCustomPrice = outletOverride.price !== item.basePrice;
          itemObj.outletAvailable = outletOverride.isAvailable;
          itemObj.customNotes = outletOverride.customNotes || '';
        } else {
          itemObj.effectivePrice = item.basePrice;
          itemObj.customOutletPrice = null;
          itemObj.hasCustomPrice = false;
          itemObj.outletAvailable = item.status === 'Available';
          itemObj.customNotes = '';
        }

        return itemObj;
      });
      return res.json(resolved);
    }

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get menu items by outlet (for QR code scanning and kiosk apps)
router.get('/outlet/:outletId', async (req, res) => {
  try {
    const { outletId } = req.params;
    const menuItems = await MenuItem.find({
      $or: [
        { vendor: outletId },
        { outlets: outletId },
        { applyToAll: true },
        { 'outletPricing.outlet': outletId },
      ],
      status: 'Available',
    })
      .populate('vendor', 'name outletId')
      .populate('category', 'name description')
      .populate('outletPricing.outlet', 'name outletId')
      .sort({ category: 1, name: 1 });

    const now = new Date();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayLabel = dayMap[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const filtered = menuItems.filter((item) => {
      // Check if explicitly disabled at this outlet
      const outletOverride = item.outletPricing?.find(
        (op) => op.outlet && (op.outlet._id?.toString() === outletId || op.outlet.toString() === outletId)
      );
      if (outletOverride && outletOverride.isAvailable === false) {
        return false;
      }

      if (item.availabilityType !== 'Custom Time Slots') return true;

      if (item.days?.length > 0 && !item.days.includes(todayLabel)) return false;

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
    }).map((item) => {
      const itemObj = item.toObject();
      const outletOverride = item.outletPricing?.find(
        (op) => op.outlet && (op.outlet._id?.toString() === outletId || op.outlet.toString() === outletId)
      );
      if (outletOverride) {
        itemObj.effectivePrice = outletOverride.price;
        itemObj.basePrice = outletOverride.price;
        itemObj.hasCustomPrice = outletOverride.price !== item.basePrice;
      } else {
        itemObj.effectivePrice = item.basePrice;
      }
      return itemObj;
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
      .populate('outlets', 'name outletId category')
      .populate('category', 'name description')
      .populate('outletPricing.outlet', 'name outletId category');
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create menu item (protected - Outlet Sales Representative/Owner/Management)
router.post('/', authenticate, authorize('Outlet Sales Representative', 'Owner', 'Management'), validateCategory, async (req, res) => {
  try {
    const menuItem = new MenuItem(req.body);
    const savedMenuItem = await menuItem.save();
    res.status(201).json(savedMenuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH quick status toggle (Available / Paused)
router.patch('/:id/status', authenticate, authorize('Outlet Sales Representative', 'Owner', 'Management'), async (req, res) => {
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

// PATCH quick outlet pricing & availability update (Fast inline edit from menu browse screen)
router.patch('/:id/outlet-pricing', authenticate, authorize('Outlet Sales Representative', 'Owner', 'Management'), async (req, res) => {
  try {
    const { outletId, price, isAvailable, customNotes } = req.body;
    if (!outletId) {
      return res.status(400).json({ message: 'outletId is required' });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    if (!menuItem.outletPricing) {
      menuItem.outletPricing = [];
    }

    const existingIndex = menuItem.outletPricing.findIndex(
      (op) => op.outlet && op.outlet.toString() === outletId.toString()
    );

    if (existingIndex > -1) {
      if (price !== undefined && price !== null && price !== '') {
        menuItem.outletPricing[existingIndex].price = Number(price);
      }
      if (isAvailable !== undefined) {
        menuItem.outletPricing[existingIndex].isAvailable = Boolean(isAvailable);
      }
      if (customNotes !== undefined) {
        menuItem.outletPricing[existingIndex].customNotes = customNotes;
      }
    } else {
      menuItem.outletPricing.push({
        outlet: outletId,
        price: (price !== undefined && price !== null && price !== '') ? Number(price) : menuItem.basePrice,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        customNotes: customNotes || '',
      });
    }

    await menuItem.save();
    const populated = await MenuItem.findById(menuItem._id)
      .populate('vendor', 'name outletId')
      .populate('outlets', 'name outletId category')
      .populate('category', 'name description')
      .populate('outletPricing.outlet', 'name outletId category');

    res.json({ success: true, menuItem: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update menu item (protected - Outlet Sales Representative/Owner/Management)
router.put('/:id', authenticate, authorize('Outlet Sales Representative', 'Owner', 'Management'), validateCategory, async (req, res) => {
  try {
    if (req.user.role === 'Outlet Sales Representative') {
      const existingItem = await MenuItem.findById(req.params.id);
      if (!existingItem) {
        return res.status(404).json({ message: 'Menu item not found' });
      }
      if (existingItem.status === 'Available') {
        return res.status(403).json({ message: 'Cannot edit an available item. Mark it unavailable first.' });
      }
    }

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

// Delete menu item (protected - Outlet Sales Representative/Owner/Management)
router.delete('/:id', authenticate, authorize('Outlet Sales Representative', 'Owner', 'Management'), async (req, res) => {
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
