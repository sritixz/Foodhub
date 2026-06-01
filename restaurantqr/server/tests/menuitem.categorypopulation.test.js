import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';

/**
 * Feature: category-management
 * Property 12: Menu item category population
 * 
 * For any menu item retrieval operation, the system should populate the category
 * field with the category's name and description (not just the ID reference).
 * 
 * Validates: Requirements 6.3
 */
describe('Feature: category-management, Property 12: Menu item category population', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'menuitem-population-test' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clean up before each test
    await Category.deleteMany({});
    await MenuItem.deleteMany({});
  });

  it('should populate category name and description when retrieving single menu item', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, categoryDescription, menuItemName, price) => {
          // Create a category with name and description
          const category = await Category.create({
            name: categoryName.trim(),
            description: categoryDescription.trim()
          });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu item with category reference
          const menuItem = await MenuItem.create({
            name: menuItemName.trim(),
            category: category._id,
            description: 'Test menu item',
            foodType: 'Veg',
            basePrice: price,
            vendor: vendorId,
            status: 'Available'
          });
          
          // Retrieve menu item with populated category
          const retrieved = await MenuItem.findById(menuItem._id)
            .populate('category', 'name description');
          
          // Verify category is populated (not just an ID)
          expect(retrieved.category).toBeDefined();
          expect(retrieved.category).not.toBeInstanceOf(mongoose.Types.ObjectId);
          expect(typeof retrieved.category).toBe('object');
          
          // Verify category contains name and description
          expect(retrieved.category.name).toBe(category.name);
          expect(retrieved.category.description).toBe(category.description);
          
          // Verify category._id is still accessible
          expect(retrieved.category._id.toString()).toBe(category._id.toString());
          
          // Cleanup
          await MenuItem.deleteOne({ _id: menuItem._id });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should populate category when retrieving multiple menu items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            fc.string({ minLength: 1, maxLength: 200 })
          ),
          { minLength: 1, maxLength: 5 }
        ).map(tuples => {
          // Ensure unique category names
          const uniqueNames = new Set();
          return tuples.filter(([name]) => {
            const trimmedName = name.trim();
            if (uniqueNames.has(trimmedName)) return false;
            uniqueNames.add(trimmedName);
            return true;
          });
        }).filter(arr => arr.length > 0),
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ).map(names => [...new Set(names.map(n => n.trim()))]).filter(arr => arr.length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryData, menuItemNames, price) => {
          // Skip if no data
          if (categoryData.length === 0 || menuItemNames.length === 0) return;
          
          // Create categories
          const categories = await Promise.all(
            categoryData.map(([name, description]) =>
              Category.create({
                name: name.trim(),
                description: description.trim()
              })
            )
          );
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu items, each with a random category
          const menuItems = await Promise.all(
            menuItemNames.map((name, index) =>
              MenuItem.create({
                name: name,
                category: categories[index % categories.length]._id,
                description: 'Test menu item',
                foodType: 'Veg',
                basePrice: price,
                vendor: vendorId,
                status: 'Available'
              })
            )
          );
          
          // Retrieve all menu items with populated categories
          const retrieved = await MenuItem.find({
            _id: { $in: menuItems.map(m => m._id) }
          }).populate('category', 'name description');
          
          // Verify all menu items have populated categories
          expect(retrieved.length).toBe(menuItems.length);
          retrieved.forEach(menuItem => {
            expect(menuItem.category).toBeDefined();
            expect(typeof menuItem.category).toBe('object');
            expect(menuItem.category.name).toBeDefined();
            expect(menuItem.category.description).toBeDefined();
            expect(menuItem.category._id).toBeDefined();
            
            // Verify the populated data matches a real category
            const matchingCategory = categories.find(
              c => c._id.toString() === menuItem.category._id.toString()
            );
            expect(matchingCategory).toBeDefined();
            expect(menuItem.category.name).toBe(matchingCategory.name);
            expect(menuItem.category.description).toBe(matchingCategory.description);
          });
          
          // Cleanup
          await MenuItem.deleteMany({ _id: { $in: menuItems.map(m => m._id) } });
          await Category.deleteMany({ _id: { $in: categories.map(c => c._id) } });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should populate category when querying by outlet', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 3 }
        ).map(names => [...new Set(names.map(n => n.trim()))]).filter(arr => arr.length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, categoryDescription, menuItemNames, price) => {
          // Skip if no menu items
          if (menuItemNames.length === 0) return;
          
          // Create a category
          const category = await Category.create({
            name: categoryName.trim(),
            description: categoryDescription.trim()
          });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu items for this outlet
          const menuItems = await Promise.all(
            menuItemNames.map(name =>
              MenuItem.create({
                name: name,
                category: category._id,
                description: 'Test menu item',
                foodType: 'Veg',
                basePrice: price,
                vendor: vendorId,
                status: 'Available'
              })
            )
          );
          
          // Query menu items by outlet with category population
          const retrieved = await MenuItem.find({
            vendor: vendorId,
            status: 'Available'
          }).populate('category', 'name description');
          
          // Verify all menu items have populated categories
          expect(retrieved.length).toBe(menuItems.length);
          retrieved.forEach(menuItem => {
            expect(menuItem.category).toBeDefined();
            expect(typeof menuItem.category).toBe('object');
            expect(menuItem.category.name).toBe(category.name);
            expect(menuItem.category.description).toBe(category.description);
            expect(menuItem.category._id.toString()).toBe(category._id.toString());
          });
          
          // Cleanup
          await MenuItem.deleteMany({ _id: { $in: menuItems.map(m => m._id) } });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should populate category when filtering by category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            fc.string({ minLength: 1, maxLength: 200 })
          ),
          { minLength: 2, maxLength: 4 }
        ).map(tuples => {
          // Ensure unique category names
          const uniqueNames = new Set();
          return tuples.filter(([name]) => {
            const trimmedName = name.trim();
            if (uniqueNames.has(trimmedName)) return false;
            uniqueNames.add(trimmedName);
            return true;
          });
        }).filter(arr => arr.length >= 2),
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          { minLength: 2, maxLength: 5 }
        ).map(names => [...new Set(names.map(n => n.trim()))]).filter(arr => arr.length >= 2),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryData, menuItemNames, price) => {
          // Skip if insufficient data
          if (categoryData.length < 2 || menuItemNames.length < 2) return;
          
          // Create categories
          const categories = await Promise.all(
            categoryData.map(([name, description]) =>
              Category.create({
                name: name.trim(),
                description: description.trim()
              })
            )
          );
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu items - first half in first category, second half in second category
          const halfPoint = Math.floor(menuItemNames.length / 2);
          const menuItems = await Promise.all(
            menuItemNames.map((name, index) =>
              MenuItem.create({
                name: name,
                category: index < halfPoint ? categories[0]._id : categories[1]._id,
                description: 'Test menu item',
                foodType: 'Veg',
                basePrice: price,
                vendor: vendorId,
                status: 'Available'
              })
            )
          );
          
          // Query menu items by first category with population
          const retrieved = await MenuItem.find({
            category: categories[0]._id
          }).populate('category', 'name description');
          
          // Verify only items from first category are returned
          expect(retrieved.length).toBe(halfPoint);
          retrieved.forEach(menuItem => {
            expect(menuItem.category).toBeDefined();
            expect(typeof menuItem.category).toBe('object');
            expect(menuItem.category.name).toBe(categories[0].name);
            expect(menuItem.category.description).toBe(categories[0].description);
            expect(menuItem.category._id.toString()).toBe(categories[0]._id.toString());
          });
          
          // Cleanup
          await MenuItem.deleteMany({ _id: { $in: menuItems.map(m => m._id) } });
          await Category.deleteMany({ _id: { $in: categories.map(c => c._id) } });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should only populate name and description fields, not other category fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, categoryDescription, menuItemName, price) => {
          // Create a category
          const category = await Category.create({
            name: categoryName.trim(),
            description: categoryDescription.trim()
          });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu item
          const menuItem = await MenuItem.create({
            name: menuItemName.trim(),
            category: category._id,
            description: 'Test menu item',
            foodType: 'Veg',
            basePrice: price,
            vendor: vendorId,
            status: 'Available'
          });
          
          // Retrieve with population (only name and description)
          const retrieved = await MenuItem.findById(menuItem._id)
            .populate('category', 'name description');
          
          // Verify only specified fields are populated
          expect(retrieved.category.name).toBeDefined();
          expect(retrieved.category.description).toBeDefined();
          expect(retrieved.category._id).toBeDefined(); // _id is always included
          
          // Verify timestamp fields are NOT populated (since we only selected name and description)
          expect(retrieved.category.createdAt).toBeUndefined();
          expect(retrieved.category.updatedAt).toBeUndefined();
          
          // Cleanup
          await MenuItem.deleteOne({ _id: menuItem._id });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle menu items with empty category descriptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, menuItemName, price) => {
          // Create a category without description (or empty description)
          const category = await Category.create({
            name: categoryName.trim(),
            description: '' // Empty description
          });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu item
          const menuItem = await MenuItem.create({
            name: menuItemName.trim(),
            category: category._id,
            description: 'Test menu item',
            foodType: 'Veg',
            basePrice: price,
            vendor: vendorId,
            status: 'Available'
          });
          
          // Retrieve with population
          const retrieved = await MenuItem.findById(menuItem._id)
            .populate('category', 'name description');
          
          // Verify category is populated correctly even with empty description
          expect(retrieved.category).toBeDefined();
          expect(retrieved.category.name).toBe(category.name);
          expect(retrieved.category.description).toBe('');
          
          // Cleanup
          await MenuItem.deleteOne({ _id: menuItem._id });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});
