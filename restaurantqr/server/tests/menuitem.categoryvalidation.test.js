import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';

/**
 * Feature: category-management
 * Property 11: Menu item category validation
 * 
 * For any menu item creation or update request, the system should validate that
 * the specified category identifier exists. If the category ID is invalid,
 * the request should be rejected with an error message.
 * 
 * Validates: Requirements 6.1, 6.2
 */
describe('Feature: category-management, Property 11: Menu item category validation', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'menuitem-validation-test' });
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

  it('should successfully create menu item with valid category ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, menuItemName, price) => {
          // Create a valid category
          const category = await Category.create({ name: categoryName.trim() });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu item with valid category ID
          const menuItem = await MenuItem.create({
            name: menuItemName.trim(),
            category: category._id,
            description: 'Test menu item',
            foodType: 'Veg',
            basePrice: price,
            vendor: vendorId,
            status: 'Available'
          });
          
          // Verify menu item was created successfully
          expect(menuItem._id).toBeDefined();
          expect(menuItem.category.toString()).toBe(category._id.toString());
          
          // Cleanup
          await MenuItem.deleteOne({ _id: menuItem._id });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject menu item creation with non-existent category ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (menuItemName, price) => {
          // Generate a valid ObjectId that doesn't exist in the database
          const nonExistentCategoryId = new mongoose.Types.ObjectId();
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Attempt to create menu item with non-existent category ID
          // This should fail due to referential integrity
          await expect(
            MenuItem.create({
              name: menuItemName.trim(),
              category: nonExistentCategoryId,
              description: 'Test menu item',
              foodType: 'Veg',
              basePrice: price,
              vendor: vendorId,
              status: 'Available'
            })
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject menu item creation with invalid category ID format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !mongoose.Types.ObjectId.isValid(s)),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (menuItemName, invalidCategoryId, price) => {
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Attempt to create menu item with invalid category ID format
          await expect(
            MenuItem.create({
              name: menuItemName.trim(),
              category: invalidCategoryId,
              description: 'Test menu item',
              foodType: 'Veg',
              basePrice: price,
              vendor: vendorId,
              status: 'Available'
            })
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should successfully update menu item with valid category ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
        ).filter(([name1, name2]) => name1.trim() !== name2.trim()),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async ([categoryName1, categoryName2], menuItemName, price) => {
          // Create two valid categories
          const category1 = await Category.create({ name: categoryName1.trim() });
          const category2 = await Category.create({ name: categoryName2.trim() });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu item with first category
          const menuItem = await MenuItem.create({
            name: menuItemName.trim(),
            category: category1._id,
            description: 'Test menu item',
            foodType: 'Veg',
            basePrice: price,
            vendor: vendorId,
            status: 'Available'
          });
          
          // Update menu item to use second category
          menuItem.category = category2._id;
          await menuItem.save();
          
          // Verify update succeeded
          const updated = await MenuItem.findById(menuItem._id);
          expect(updated.category.toString()).toBe(category2._id.toString());
          
          // Cleanup
          await MenuItem.deleteOne({ _id: menuItem._id });
          await Category.deleteMany({ _id: { $in: [category1._id, category2._id] } });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject menu item update with non-existent category ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, menuItemName, price) => {
          // Create a valid category
          const category = await Category.create({ name: categoryName.trim() });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu item with valid category
          const menuItem = await MenuItem.create({
            name: menuItemName.trim(),
            category: category._id,
            description: 'Test menu item',
            foodType: 'Veg',
            basePrice: price,
            vendor: vendorId,
            status: 'Available'
          });
          
          // Generate a non-existent category ID
          const nonExistentCategoryId = new mongoose.Types.ObjectId();
          
          // Attempt to update with non-existent category ID
          menuItem.category = nonExistentCategoryId;
          await expect(menuItem.save()).rejects.toThrow();
          
          // Cleanup
          await MenuItem.deleteOne({ _id: menuItem._id });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject menu item update with invalid category ID format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !mongoose.Types.ObjectId.isValid(s)),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, menuItemName, invalidCategoryId, price) => {
          // Create a valid category
          const category = await Category.create({ name: categoryName.trim() });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create menu item with valid category
          const menuItem = await MenuItem.create({
            name: menuItemName.trim(),
            category: category._id,
            description: 'Test menu item',
            foodType: 'Veg',
            basePrice: price,
            vendor: vendorId,
            status: 'Available'
          });
          
          // Attempt to update with invalid category ID format
          menuItem.category = invalidCategoryId;
          await expect(menuItem.save()).rejects.toThrow();
          
          // Cleanup
          await MenuItem.deleteOne({ _id: menuItem._id });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain referential integrity when category exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ).map(names => [...new Set(names.map(n => n.trim()))]),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        async (categoryName, menuItemNames, price) => {
          // Skip if no unique menu item names
          if (menuItemNames.length === 0) return;
          
          // Create a valid category
          const category = await Category.create({ name: categoryName.trim() });
          
          // Create a mock vendor (outlet) ID
          const vendorId = new mongoose.Types.ObjectId();
          
          // Create multiple menu items with the same category
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
          
          // Verify all menu items reference the same category
          menuItems.forEach(menuItem => {
            expect(menuItem.category.toString()).toBe(category._id.toString());
          });
          
          // Verify we can query menu items by category
          const foundItems = await MenuItem.find({ category: category._id });
          expect(foundItems.length).toBe(menuItems.length);
          
          // Cleanup
          await MenuItem.deleteMany({ _id: { $in: menuItems.map(m => m._id) } });
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });
});
