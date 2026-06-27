import express from 'express';
import DailyMenu from '../models/DailyMenu.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

const router = express.Router();

// Get daily menu for a specific date and outlet
router.get('/', async (req, res) => {
  try {
    const { date, outletId } = req.query;

    if (!date || !outletId) {
      return res.status(400).json({ message: 'Date and outletId are required' });
    }

    // 1. Try to find direct match (either date "YYYY-MM-DD" or day name "Monday")
    let dailyMenu = await DailyMenu.findOne({ date, outlet: outletId });

    // 2. If not found and date is a YYYY-MM-DD string, try to fallback to the day of week name
    if (!dailyMenu && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeekName = days[d.getDay()];
      
      dailyMenu = await DailyMenu.findOne({ date: dayOfWeekName, outlet: outletId });
    }

    if (dailyMenu) {
      // Populate meals and categories
      await dailyMenu.populate([
        { path: 'meals.breakfast', populate: { path: 'category', select: 'name description' } },
        { path: 'meals.lunch', populate: { path: 'category', select: 'name description' } },
        { path: 'meals.fullMeal', populate: { path: 'category', select: 'name description' } },
        { path: 'meals.snack', populate: { path: 'category', select: 'name description' } }
      ]);
    }

    res.json(dailyMenu || null); // Return null if not found
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create or update daily menu (protected - Vendor/Admin/Company Admin)
router.post('/', authenticate, authorize('Vendor', 'Admin', 'Company Admin'), async (req, res) => {
  try {
    const { date, outlet, meals } = req.body;

    if (!date || !outlet) {
      return res.status(400).json({ message: 'Date and outlet are required' });
    }

    // Find existing or create new
    let dailyMenu = await DailyMenu.findOne({ date, outlet });

    if (dailyMenu) {
      dailyMenu.meals = meals;
      dailyMenu = await dailyMenu.save();
    } else {
      dailyMenu = new DailyMenu({
        date,
        outlet,
        meals,
      });
      dailyMenu = await dailyMenu.save();
    }

    res.status(200).json(dailyMenu);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
