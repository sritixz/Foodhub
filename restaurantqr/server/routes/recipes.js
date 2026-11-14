import express from 'express';
import Recipe from '../models/Recipe.js';
import MenuItem from '../models/MenuItem.js';
import Outlet from '../models/Outlet.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';
import {
  fetchLiveIngredientPrice,
  calculateRecipeCost,
} from '../services/priceScraperService.js';
import {
  calculateRecipeFullCost,
  scaleRecipeYield,
  resolveIngredientRate,
} from '../services/foodCostEngine.js';

const router = express.Router();

/**
 * @route   GET /api/recipes
 * @desc    Fetch all central recipes
 * @access  Public / Authenticated
 */
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = { isActive: true };
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { recipeCode: { $regex: search, $options: 'i' } },
      ];
    }

    const recipes = await Recipe.find(filter)
      .populate('menuItem', 'name basePrice costPrice image category foodType')
      .populate('outletTransferRules.outlet', 'name address')
      .sort({ updatedAt: -1 });

    res.json(recipes);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).json({ message: 'Failed to fetch recipes', error: err.message });
  }
});

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
 * @desc    Calculate live recipe cost and suggested pricing with 3 valuation modes & prep expenses
 * @access  Public / Authenticated
 */
router.post('/estimate-cost', async (req, res) => {
  try {
    const {
      recipeName,
      standardYield = 100,
      defaultValuationMode = 'WAC',
      ingredients = [],
      prepExpenses = {},
      outletTransferRules = [],
    } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        message: 'Request must include a non-empty "ingredients" array with [{ name, quantity, unit }]',
      });
    }

    const evaluated = await calculateRecipeFullCost({
      title: recipeName || 'Draft Recipe',
      standardYield: Number(standardYield) || 100,
      defaultValuationMode,
      ingredients,
      prepExpenses,
      outletTransferRules,
    });

    res.json(evaluated);
  } catch (err) {
    console.error('Error calculating recipe cost:', err);
    res.status(500).json({ message: 'Failed to calculate recipe cost', error: err.message });
  }
});

/**
 * @route   GET /api/recipes/:id
 * @desc    Fetch single recipe details
 * @access  Public / Authenticated
 */
router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('menuItem', 'name basePrice costPrice image category foodType outletPricing')
      .populate('ingredients.rawMaterial', 'name sku unit quantity unitCost')
      .populate('outletTransferRules.outlet', 'name address building floor');

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json(recipe);
  } catch (err) {
    console.error('Error fetching recipe by id:', err);
    res.status(500).json({ message: 'Failed to fetch recipe', error: err.message });
  }
});

/**
 * @route   GET /api/recipes/:id/scale
 * @desc    Calculate dynamically scaled ingredient amounts and costs for target portions
 * @access  Public / Authenticated
 */
router.get('/:id/scale', async (req, res) => {
  try {
    const portions = Number(req.query.portions);
    if (!portions || portions <= 0) {
      return res.status(400).json({ message: 'Query parameter "portions" must be a positive number' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const scaled = scaleRecipeYield(recipe, portions);
    res.json({
      recipeId: recipe._id,
      recipeCode: recipe.recipeCode,
      title: recipe.title,
      ...scaled,
    });
  } catch (err) {
    console.error('Error scaling recipe:', err);
    res.status(500).json({ message: 'Failed to scale recipe', error: err.message });
  }
});

/**
 * @route   POST /api/recipes
 * @desc    Create new Central Recipe Master and synchronize pricing with linked MenuItem
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.post(
  '/',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const {
        recipeCode,
        menuItem: menuItemId,
        title,
        category,
        standardYield = 100,
        yieldUnit = 'Plates',
        defaultValuationMode = 'WAC',
        ingredients = [],
        prepExpenses = {},
        outletTransferRules = [],
        instructions = [],
        allergens = [],
        dietaryFlags = {},
        storageSpecs = {},
      } = req.body;

      if (!menuItemId) {
        return res.status(400).json({ message: 'Linked MenuItem ID is required' });
      }
      if (!title) {
        return res.status(400).json({ message: 'Recipe title is required' });
      }

      // Generate or validate recipe code
      const generatedCode =
        recipeCode ||
        `RCP-${title.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      // Run full cost calculation
      const calculatedData = await calculateRecipeFullCost({
        recipeCode: generatedCode,
        menuItem: menuItemId,
        title,
        category,
        standardYield: Number(standardYield) || 100,
        yieldUnit,
        defaultValuationMode,
        ingredients,
        prepExpenses,
        outletTransferRules,
        instructions,
        allergens,
        dietaryFlags,
        storageSpecs,
      });

      const newRecipe = new Recipe(calculatedData);
      await newRecipe.save();

      // Synchronize with linked MenuItem
      const menuItem = await MenuItem.findById(menuItemId);
      if (menuItem) {
        menuItem.recipe = newRecipe._id;
        menuItem.costPrice = newRecipe.perPlateCost;

        // Sync outlet-specific pricing if defined
        if (newRecipe.outletTransferRules && newRecipe.outletTransferRules.length > 0) {
          newRecipe.outletTransferRules.forEach((rule) => {
            const existingOutletIdx = (menuItem.outletPricing || []).findIndex(
              (op) => op.outlet?.toString() === rule.outlet?.toString()
            );
            if (existingOutletIdx >= 0) {
              menuItem.outletPricing[existingOutletIdx].costPrice = rule.finalCostPrice;
              if (rule.targetSellingPrice > 0) {
                menuItem.outletPricing[existingOutletIdx].price = rule.targetSellingPrice;
              }
            } else {
              menuItem.outletPricing.push({
                outlet: rule.outlet,
                price: rule.targetSellingPrice || menuItem.basePrice,
                costPrice: rule.finalCostPrice,
                isAvailable: true,
              });
            }
          });
        }
        await menuItem.save();
      }

      res.status(201).json({
        message: 'Recipe created and MenuItem pricing synchronized successfully',
        recipe: newRecipe,
      });
    } catch (err) {
      console.error('Error creating recipe:', err);
      res.status(500).json({ message: 'Failed to create recipe', error: err.message });
    }
  }
);

/**
 * @route   PUT /api/recipes/:id
 * @desc    Update existing Central Recipe Master and update MenuItem pricing
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const existing = await Recipe.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      const merged = {
        ...existing.toObject(),
        ...req.body,
        _id: existing._id,
      };

      const calculatedData = await calculateRecipeFullCost(merged);
      Object.assign(existing, calculatedData);
      await existing.save();

      // Synchronize linked MenuItem
      if (existing.menuItem) {
        const menuItem = await MenuItem.findById(existing.menuItem);
        if (menuItem) {
          menuItem.costPrice = existing.perPlateCost;
          if (existing.outletTransferRules && existing.outletTransferRules.length > 0) {
            existing.outletTransferRules.forEach((rule) => {
              const idx = (menuItem.outletPricing || []).findIndex(
                (op) => op.outlet?.toString() === rule.outlet?.toString()
              );
              if (idx >= 0) {
                menuItem.outletPricing[idx].costPrice = rule.finalCostPrice;
                if (rule.targetSellingPrice > 0) {
                  menuItem.outletPricing[idx].price = rule.targetSellingPrice;
                }
              } else {
                menuItem.outletPricing.push({
                  outlet: rule.outlet,
                  price: rule.targetSellingPrice || menuItem.basePrice,
                  costPrice: rule.finalCostPrice,
                  isAvailable: true,
                });
              }
            });
          }
          await menuItem.save();
        }
      }

      res.json({
        message: 'Recipe updated and MenuItem pricing synchronized successfully',
        recipe: existing,
      });
    } catch (err) {
      console.error('Error updating recipe:', err);
      res.status(500).json({ message: 'Failed to update recipe', error: err.message });
    }
  }
);

/**
 * @route   POST /api/recipes/apply-to-menu-item/:id
 * @desc    Backward compatibility: Calculate recipe cost and update MenuItem
 * @access  Owner, Management, Central Kitchen Manager, Admin
 */
router.post(
  '/apply-to-menu-item/:id',
  authenticate,
  authorize('Owner', 'Management', 'Central Kitchen Manager', 'Admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { ingredients, targetFoodCostPercent = 30, updateBasePrice } = req.body;

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ message: 'Ingredients list is required' });
      }

      const menuItem = await MenuItem.findById(id);
      if (!menuItem) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      const costResult = await calculateRecipeCost(ingredients, targetFoodCostPercent);
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
        costAnalysis: costResult,
      });
    } catch (err) {
      console.error('Error applying cost to menu item:', err);
      res.status(500).json({ message: 'Failed to apply cost to menu item', error: err.message });
    }
  }
);

export default router;
