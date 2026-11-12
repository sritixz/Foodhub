import express from 'express';
import MenuItem from '../models/MenuItem.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';
import {
  fetchLiveIngredientPrice,
  calculateRecipeCost,
  clearPriceCache
} from '../services/priceScraperService.js';

const router = express.Router();

/**
 * @route   GET /api/recipes/search-price
 * @desc    Fetch live market rate for a specific ingredient
 * @access  Public / Authenticated
 */
router.get('/search-price', async (req, res) => {
  try {
    const { ingredient } = req.query;
    if (!ingredient) {
      return res.status(400).json({ message: 'Query parameter "ingredient" is required' });
    }

    const priceData = await fetchLiveIngredientPrice(ingredient);
    res.json(priceData);
  } catch (err) {
    console.error('Error fetching ingredient price:', err.message);
    res.status(500).json({ message: 'Failed to fetch ingredient price', error: err.message });
  }
});

/**
 * @route   POST /api/recipes/estimate-cost
 * @desc    Calculate live recipe cost and suggested selling price from ingredients
 * @access  Public / Authenticated
 */
router.post('/estimate-cost', async (req, res) => {
  try {
    const { recipeName, ingredients, targetFoodCostPercent } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        message: 'Request body must include a non-empty "ingredients" array with [{ item, qty, unit }]'
      });
    }

    const result = await calculateRecipeCost(ingredients, targetFoodCostPercent || 30);
    res.json({
      recipeName: recipeName || 'Custom Recipe',
      ...result
    });
  } catch (err) {
    console.error('Error calculating recipe cost:', err.message);
    res.status(500).json({ message: 'Failed to calculate recipe cost', error: err.message });
  }
});

/**
 * @route   POST /api/recipes/apply-to-menu-item/:id
 * @desc    Calculate recipe cost and automatically update MenuItem costPrice & basePrice
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.post(
  '/apply-to-menu-item/:id',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { ingredients, targetFoodCostPercent, updateBasePrice } = req.body;

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ message: 'Ingredients list is required' });
      }

      const menuItem = await MenuItem.findById(id);
      if (!menuItem) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      const costResult = await calculateRecipeCost(ingredients, targetFoodCostPercent || 30);

      menuItem.costPrice = costResult.totalIngredientCost;
      if (updateBasePrice) {
        menuItem.basePrice = costResult.suggestedSellingPrice;
      }

      await menuItem.save();

      res.json({
        message: 'Menu item pricing updated successfully from live recipe costing',
        menuItem: {
          id: menuItem._id,
          name: menuItem.name,
          costPrice: menuItem.costPrice,
          basePrice: menuItem.basePrice,
        },
        costAnalysis: costResult
      });
    } catch (err) {
      console.error('Error applying recipe cost to menu item:', err.message);
      res.status(500).json({ message: 'Failed to apply recipe cost to menu item', error: err.message });
    }
  }
);

/**
 * @route   POST /api/recipes/clear-cache
 * @desc    Flush memory cache of fetched prices
 * @access  Owner, Management, Admin
 */
router.post(
  '/clear-cache',
  authenticate,
  authorize('Owner', 'Management', 'Admin'),
  (req, res) => {
    const result = clearPriceCache();
    res.json(result);
  }
);

export default router;
