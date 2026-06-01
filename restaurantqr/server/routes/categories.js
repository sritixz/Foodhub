import express from 'express';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import authenticate from '../middleware/auth.js';
import { adminOnly } from '../middleware/roleAuth.js';
import validator from 'validator';

const router = express.Router();

// Helper function to sanitize input
const sanitizeInput = (input) => {
  if (!input) return input;
  return validator.escape(input.trim());
};

// GET /api/categories - List all categories (any authenticated user)
router.get('/', authenticate, async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    
    // Calculate menu item count for each category using aggregation
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const menuItemCount = await MenuItem.countDocuments({ category: category._id });
        return {
          _id: category._id,
          name: category.name,
          description: category.description,
          menuItemCount,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        };
      })
    );
    
    res.json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/categories/:id - Get single category (any authenticated user)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({
      _id: category._id,
      name: category.name,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(500).json({ message: error.message });
  }
});

// GET /api/categories/:id/menu-items-count - Get menu item count (any authenticated user)
router.get('/:id/menu-items-count', authenticate, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const count = await MenuItem.countDocuments({ category: req.params.id });
    
    res.json({ categoryId: req.params.id, menuItemCount: count });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(500).json({ message: error.message });
  }
});

// POST /api/categories - Create category (admin only)
router.post('/', ...adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Validate name
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    const trimmedName = name.trim();
    
    if (trimmedName.length > 50) {
      return res.status(400).json({ message: 'Category name must not exceed 50 characters' });
    }
    
    // Validate description if provided
    if (description && description.length > 200) {
      return res.status(400).json({ message: 'Description must not exceed 200 characters' });
    }
    
    // Sanitize inputs
    const sanitizedName = sanitizeInput(trimmedName);
    const sanitizedDescription = description ? sanitizeInput(description.trim()) : '';
    
    // Check for duplicate name (case-insensitive)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') } 
    });
    
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    
    // Create category
    const category = new Category({
      name: sanitizedName,
      description: sanitizedDescription
    });
    
    const savedCategory = await category.save();
    
    res.status(201).json(savedCategory);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/categories/:id - Update category (admin only)
router.put('/:id', ...adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if category exists
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: 'Category name is required' });
      }
      
      const trimmedName = name.trim();
      
      if (trimmedName.length > 50) {
        return res.status(400).json({ message: 'Category name must not exceed 50 characters' });
      }
      
      // Sanitize name
      const sanitizedName = sanitizeInput(trimmedName);
      
      // Check for duplicate name (case-insensitive), excluding current category
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        return res.status(400).json({ message: 'Category with this name already exists' });
      }
      
      category.name = sanitizedName;
    }
    
    // Validate and update description if provided
    if (description !== undefined) {
      if (description && description.length > 200) {
        return res.status(400).json({ message: 'Description must not exceed 200 characters' });
      }
      
      category.description = description ? sanitizeInput(description.trim()) : '';
    }
    
    // Update timestamp
    category.updatedAt = Date.now();
    
    const updatedCategory = await category.save();
    
    res.json(updatedCategory);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/categories/:id - Delete category (admin only)
router.delete('/:id', ...adminOnly, async (req, res) => {
  try {
    // Check if category exists
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Count associated menu items
    const menuItemCount = await MenuItem.countDocuments({ category: req.params.id });
    
    if (menuItemCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category with ${menuItemCount} associated menu items`,
        menuItemCount
      });
    }
    
    // Delete category
    await Category.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(500).json({ message: error.message });
  }
});

export default router;
