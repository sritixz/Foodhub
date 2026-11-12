import express from 'express';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import DailyMenu from '../models/DailyMenu.js';
import Promotion from '../models/Promotion.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

const router = express.Router();

// Helper to resolve effective price for an item at a given outlet
const resolveItemPrice = (item, outletId) => {
  let price = item.basePrice || item.price || 0;
  if (outletId && item.outletPricing && item.outletPricing.length > 0) {
    const override = item.outletPricing.find(
      (op) => op.outlet && op.outlet.toString() === outletId.toString()
    );
    if (override && override.price !== undefined) {
      price = override.price;
    }
  }
  return price;
};

// 1. Get Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({ status: 'Active' }).sort({ name: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get Menu Items
router.get('/items', async (req, res) => {
  try {
    const { category, vegOnly, search, outlet } = req.query;
    const query = { status: 'Available' };

    if (category && category !== 'all') {
      query.category = category;
    }
    if (vegOnly === 'true') {
      query.foodType = 'Veg';
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (outlet) {
      query.$or = [
        { vendor: outlet },
        { outlets: outlet },
        { applyToAll: true },
      ];
    }

    const rawItems = await MenuItem.find(query).populate('category', 'name').sort({ name: 1 });
    const items = rawItems.map((item) => {
      const obj = item.toObject();
      obj.price = resolveItemPrice(item, outlet);
      return obj;
    });

    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Today's Hot Menu
router.get('/todays', async (req, res) => {
  try {
    const { outlet } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];

    let items = [];
    if (outlet) {
      const dailyMenu = await DailyMenu.findOne({ date: todayStr, outlet }).populate(
        'meals.breakfast meals.lunch meals.fullMeal meals.snack'
      );
      if (dailyMenu && dailyMenu.meals) {
        const slots = [
          { key: 'breakfast', slot: 'Breakfast (08:30 - 11:00 AM)', time: '08:30 AM' },
          { key: 'lunch', slot: 'Lunch (12:30 - 03:00 PM)', time: '12:30 PM' },
          { key: 'snack', slot: 'Evening Snack (04:30 - 06:30 PM)', time: '04:30 PM' },
          { key: 'fullMeal', slot: 'Dinner (07:30 - 10:00 PM)', time: '07:30 PM' },
        ];
        slots.forEach(({ key, slot, time }) => {
          (dailyMenu.meals[key] || []).forEach((m) => {
            if (m) {
              const obj = m.toObject ? m.toObject() : m;
              items.push({
                id: obj._id,
                slot,
                time: time || obj.prepTime || '12 mins',
                name: obj.name,
                foodType: obj.foodType || 'Veg',
                price: resolveItemPrice(obj, outlet),
                originalPrice: obj.basePrice ? obj.basePrice + 30 : null,
                rating: obj.rating || 4.8,
                description: obj.description || '',
                image: obj.image || '',
                prepTime: obj.prepTime || '12-15 mins',
              });
            }
          });
        });
      }
    }

    // Fallback: If no daily menu configured yet, pull items from MenuItem collection
    if (items.length === 0) {
      const query = { status: 'Available' };
      if (outlet) {
        query.$or = [{ vendor: outlet }, { outlets: outlet }, { applyToAll: true }];
      }
      const generalItems = await MenuItem.find(query).limit(10);
      const slotNames = [
        'Breakfast (08:30 - 11:00 AM)',
        'Lunch (12:30 - 03:00 PM)',
        'Evening Snack (04:30 - 06:30 PM)',
        'Dinner (07:30 - 10:00 PM)',
      ];
      items = generalItems.map((item, idx) => ({
        id: item._id,
        slot: slotNames[idx % slotNames.length],
        time: item.prepTime || '12 mins',
        name: item.name,
        foodType: item.foodType || 'Veg',
        price: resolveItemPrice(item, outlet),
        originalPrice: item.basePrice ? item.basePrice + 30 : null,
        rating: item.rating || 4.8,
        description: item.description || '',
        image: item.image || '',
        prepTime: item.prepTime || '12-15 mins',
      }));
    }

    res.json({ success: true, todaysMenu: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Get Health Pantry Items
router.get('/health', async (req, res) => {
  try {
    const { outlet } = req.query;
    const query = {
      $or: [
        { isHealth: true },
        { healthTag: { $ne: null } },
        { calories: { $gt: 0 } },
      ],
    };
    if (outlet) {
      query.$and = [{ $or: [{ vendor: outlet }, { outlets: outlet }, { applyToAll: true }] }];
    }

    let items = await MenuItem.find(query).populate('category', 'name').limit(20);

    // If no specifically tagged health items found, fallback to top veg items with estimated nutrition
    if (items.length === 0) {
      items = await MenuItem.find({ foodType: 'Veg', status: 'Available' }).populate('category', 'name').limit(10);
    }

    const healthMenu = items.map((item) => ({
      id: item._id,
      name: item.name,
      foodType: item.foodType || 'Veg',
      category: item.category?.name || 'Healthy Eats',
      price: resolveItemPrice(item, outlet),
      originalPrice: item.basePrice ? item.basePrice + 40 : null,
      calories: item.calories || 340,
      protein: item.protein || 18,
      carbs: item.carbs || 42,
      fat: item.fat || 8,
      tag: item.healthTag || 'High Protein',
      description: item.description || '',
      image: item.image || '',
    }));

    res.json({ success: true, healthMenu });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Get Live Offers of the Day
router.get('/offers', async (req, res) => {
  try {
    const { outlet, customerType } = req.query;
    const query = { isActive: true };

    if (outlet) {
      query.$or = [{ applicableOutlets: outlet }, { applyToAllOutlets: true }];
    }
    if (customerType && customerType !== 'All') {
      query.applicableCustomerType = { $in: [customerType, 'All'] };
    }

    let offers = await Promotion.find(query).sort({ createdAt: -1 });

    // Seed default MOPY offers if collection is empty
    if (offers.length === 0) {
      const defaultPromotions = [
        {
          code: 'CORP50',
          title: 'Flat 50% Off First 3 Desk Orders',
          description: 'Special onboarding welcome discount for registered corporate floor employees.',
          discountType: 'percentage',
          discountValue: 50,
          minOrderAmount: 150,
          maxDiscount: 100,
          badge: 'WELCOME50',
          bgGradient: ['#E31B23', '#991B1B'],
          applyToAllOutlets: true,
          applicableCustomerType: 'Corporate',
        },
        {
          code: 'HEALTH20',
          title: '20% Cashback on Health Pantry Items',
          description: 'Earn instant pantry loyalty credits on salads, protein bowls and juices.',
          discountType: 'percentage',
          discountValue: 20,
          minOrderAmount: 200,
          maxDiscount: 75,
          badge: 'HEALTH CARE',
          bgGradient: ['#047857', '#065F46'],
          applyToAllOutlets: true,
          applicableCustomerType: 'All',
        },
        {
          code: 'FREESHIP',
          title: 'Free Desk Delivery All Week',
          description: 'Zero delivery convenience fees across all internal tech park towers.',
          discountType: 'flat',
          discountValue: 30,
          minOrderAmount: 100,
          badge: 'FREE DELIVERY',
          bgGradient: ['#2563EB', '#1D4ED8'],
          applyToAllOutlets: true,
          applicableCustomerType: 'Corporate',
        },
      ];
      offers = await Promotion.insertMany(defaultPromotions);
    }

    const formattedOffers = offers.map((o) => ({
      id: o._id,
      code: o.code,
      title: o.title,
      description: o.description,
      discount: o.discountType === 'percentage' ? `${o.discountValue}% OFF` : `₹${o.discountValue} FLAT`,
      expiry: o.validUntil ? o.validUntil.toLocaleDateString('en-IN') : 'Ongoing',
      badge: o.badge || 'HOT OFFER',
      bgGradient: o.bgGradient && o.bgGradient.length >= 2 ? o.bgGradient : ['#E31B23', '#991B1B'],
      minOrder: o.minOrderAmount || 0,
    }));

    res.json({ success: true, offers: formattedOffers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Get Weekly Schedule
router.get('/weekly', async (req, res) => {
  try {
    const { outlet } = req.query;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sampleItems = await MenuItem.find({ status: 'Available' }).limit(6);

    const weeklyMenu = days.map((day, idx) => {
      const item = sampleItems[idx % sampleItems.length] || {};
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + (idx - targetDate.getDay() + 1));
      return {
        day,
        date: targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        dishName: item.name || `${day} Executive Lunch Box`,
        category: 'Executive Thali',
        foodType: item.foodType || 'Veg',
        price: resolveItemPrice(item, outlet) || 199.0,
        description: item.description || 'Nutritious balanced meal box prepared fresh at Central Kitchen',
        image: item.image || '',
      };
    });

    res.json({ success: true, weeklyMenu });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Get Subscription Plans
router.get('/subscriptions', async (req, res) => {
  try {
    let plans = await SubscriptionPlan.find({ isActive: true });

    // Seed default MOPY 5-Day and 20-Day passes if empty
    if (plans.length === 0) {
      const defaultPlans = [
        {
          planId: 'plan-weekly-5d',
          title: '5-Day Weekly Desk Pass',
          duration: '5 Working Days (Mon - Fri)',
          daysCount: 5,
          price: 899.0,
          originalPrice: 1100.0,
          savings: 'Save ₹201',
          badge: 'FLEXIBLE',
          badgeColor: 'blue',
          features: [
            '1 Chef Special Lunch Thali every working day',
            'Priority 12-min desk delivery guaranteed',
            'Meal swap allowed up to 24 hrs in advance',
            '1 Free beverage or dessert per week',
          ],
        },
        {
          planId: 'plan-monthly-20d',
          title: '20-Day Monthly Executive Pass',
          duration: '20 Working Days (Mon - Fri)',
          daysCount: 20,
          price: 3299.0,
          originalPrice: 4400.0,
          savings: 'Save ₹1,101',
          badge: 'BEST VALUE',
          badgeColor: 'gold',
          features: [
            '20 Full Meals delivered straight to your workstation',
            'WFH pause protection: rollover unconsumed days to next month',
            'Daily menu selection with calorie control',
            'Dedicated runner assignment & zero delivery charges',
          ],
        },
      ];
      plans = await SubscriptionPlan.insertMany(defaultPlans);
    }

    const formattedPlans = plans.map((p) => ({
      id: p.planId || p._id,
      title: p.title,
      duration: p.duration,
      price: p.price,
      originalPrice: p.originalPrice,
      savings: p.savings,
      badge: p.badge,
      badgeColor: p.badgeColor,
      features: p.features || [],
    }));

    res.json({ success: true, subscriptionPlans: formattedPlans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
