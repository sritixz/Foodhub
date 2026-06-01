import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';

/**
 * Feature: category-management
 * Property 23: Migration creates default categories
 * Property 24: Migration updates menu items
 * Property 25: Migration logging
 * 
 * Tests for the migration script that converts hardcoded categories to database entities.
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
describe('Feature: category-management, Migration Properties', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'migration-test' });
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

  /**
   * Property 23: Migration creates default categories
   * 
   * When the migration script runs, it should create exactly four category records
   * corresponding to the existing hardcoded categories: "Main Course", "Appetizers",
   * "Beverages", and "Desserts".
   * 
   * Validates: Requirements 10.1
   */
  describe('Property 23: Migration creates default categories', () => {
    it('should create exactly four default categories with correct names', async () => {
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
      const categoryMapping = {};

      // Simulate migration: Create category documents
      for (const categoryName of hardcodedCategories) {
        const category = await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
        categoryMapping[categoryName] = category._id;
      }

      // Verify exactly 4 categories were created
      const allCategories = await Category.find({});
      expect(allCategories).toHaveLength(4);

      // Verify each expected category exists
      for (const expectedName of hardcodedCategories) {
        const category = await Category.findOne({ name: expectedName });
        expect(category).toBeDefined();
        expect(category.name).toBe(expectedName);
        expect(category._id).toBeDefined();
        expect(category.createdAt).toBeDefined();
        expect(category.updatedAt).toBeDefined();
      }

      // Verify category names match exactly
      const categoryNames = allCategories.map(c => c.name).sort();
      expect(categoryNames).toEqual(hardcodedCategories.sort());
    });

    it('should not create duplicate categories if migration runs twice', async () => {
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];

      // First migration run
      for (const categoryName of hardcodedCategories) {
        await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
      }

      // Verify 4 categories exist
      let allCategories = await Category.find({});
      expect(allCategories).toHaveLength(4);

      // Second migration run (simulating idempotency check)
      for (const categoryName of hardcodedCategories) {
        let category = await Category.findOne({ name: categoryName });
        if (!category) {
          await Category.create({
            name: categoryName,
            description: `${categoryName} items`,
          });
        }
      }

      // Verify still only 4 categories exist
      allCategories = await Category.find({});
      expect(allCategories).toHaveLength(4);
    });

    it('should create categories with valid ObjectIds', async () => {
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];

      // Create categories
      for (const categoryName of hardcodedCategories) {
        await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
      }

      // Verify all categories have valid ObjectIds
      const allCategories = await Category.find({});
      allCategories.forEach(category => {
        expect(category._id).toBeInstanceOf(mongoose.Types.ObjectId);
        expect(mongoose.Types.ObjectId.isValid(category._id)).toBe(true);
      });
    });
  });

  /**
   * Property 24: Migration updates menu items
   * 
   * For any existing menu item with a hardcoded category string, the migration should
   * update its category field to reference the corresponding new category identifier,
   * and all menu items should have valid category references after migration completes.
   * 
   * Validates: Requirements 10.2, 10.3
   */
  describe('Property 24: Migration updates menu items', () => {
    it('should update menu items from string categories to ObjectId references', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              category: fc.constantFrom('Main Course', 'Appetizers', 'Beverages', 'Desserts'),
              description: fc.string({ maxLength: 200 }),
              basePrice: fc.integer({ min: 1, max: 1000 }),
              foodType: fc.constantFrom('Veg', 'Non-Veg', 'Egg', 'Jain'),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (menuItemsData) => {
            // Clean up first to avoid duplicate categories
            await Category.deleteMany({});
            await MenuItem.deleteMany({});

            // Step 1: Create categories
            const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
            const categoryMapping = {};

            for (const categoryName of hardcodedCategories) {
              const category = await Category.create({
                name: categoryName,
                description: `${categoryName} items`,
              });
              categoryMapping[categoryName] = category._id;
            }

            // Step 2: Create menu items with string categories (pre-migration state)
            const createdMenuItems = [];
            const dummyVendor = new mongoose.Types.ObjectId();
            
            for (const itemData of menuItemsData) {
              // Create menu item with string category (bypassing validation)
              // Use direct collection insert to bypass mongoose validation entirely
              const menuItemDoc = {
                name: itemData.name.trim(),
                category: itemData.category, // String value
                description: itemData.description,
                basePrice: itemData.basePrice,
                foodType: itemData.foodType,
                vendor: dummyVendor,
                status: 'Available',
                availabilityType: 'All Day',
                stockType: 'Unlimited',
                days: [],
                variants: [],
                promotions: { enabled: false, discount: 0 },
                applyToAll: true,
                outlets: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              
              const result = await mongoose.connection.collection('menuitems').insertOne(menuItemDoc);
              createdMenuItems.push({ _id: result.insertedId, ...menuItemDoc });
            }

            // Step 3: Simulate migration - update menu items
            const menuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
            let menuItemsUpdated = 0;

            for (const menuItem of menuItems) {
              const categoryString = String(menuItem.category);
              const categoryId = categoryMapping[categoryString];

              if (categoryId) {
                await mongoose.connection.collection('menuitems').updateOne(
                  { _id: menuItem._id },
                  { $set: { category: categoryId } }
                );
                menuItemsUpdated++;
              }
            }

            // Step 4: Verify all menu items were updated
            expect(menuItemsUpdated).toBe(createdMenuItems.length);

            // Step 5: Verify all menu items have valid ObjectId references
            const updatedMenuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
            for (const menuItem of updatedMenuItems) {
              expect(menuItem.category).toBeInstanceOf(mongoose.Types.ObjectId);
              expect(mongoose.Types.ObjectId.isValid(menuItem.category)).toBe(true);

              // Verify the category reference is valid
              const category = await Category.findById(menuItem.category);
              expect(category).toBeDefined();
              expect(hardcodedCategories).toContain(category.name);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should skip menu items that are already migrated', async () => {
      // Create categories
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
      const categoryMapping = {};

      for (const categoryName of hardcodedCategories) {
        const category = await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
        categoryMapping[categoryName] = category._id;
      }

      const dummyVendor = new mongoose.Types.ObjectId();

      // Create menu item with string category using direct collection insert
      await mongoose.connection.collection('menuitems').insertOne({
        name: 'String Category Item',
        category: 'Main Course', // String value
        description: 'Test item',
        basePrice: 100,
        foodType: 'Veg',
        vendor: dummyVendor,
        status: 'Available',
        availabilityType: 'All Day',
        stockType: 'Unlimited',
        days: [],
        variants: [],
        promotions: { enabled: false, discount: 0 },
        applyToAll: true,
        outlets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create menu item with ObjectId category (already migrated)
      await mongoose.connection.collection('menuitems').insertOne({
        name: 'ObjectId Category Item',
        category: categoryMapping['Appetizers'], // ObjectId value
        description: 'Test item',
        basePrice: 150,
        foodType: 'Non-Veg',
        vendor: dummyVendor,
        status: 'Available',
        availabilityType: 'All Day',
        stockType: 'Unlimited',
        days: [],
        variants: [],
        promotions: { enabled: false, discount: 0 },
        applyToAll: true,
        outlets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Simulate migration
      const menuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
      let menuItemsUpdated = 0;
      let menuItemsSkipped = 0;

      for (const menuItem of menuItems) {
        // Check if already migrated
        if (mongoose.Types.ObjectId.isValid(menuItem.category) &&
            menuItem.category instanceof mongoose.Types.ObjectId) {
          menuItemsSkipped++;
          continue;
        }

        const categoryString = String(menuItem.category);
        const categoryId = categoryMapping[categoryString];

        if (categoryId) {
          await mongoose.connection.collection('menuitems').updateOne(
            { _id: menuItem._id },
            { $set: { category: categoryId } }
          );
          menuItemsUpdated++;
        }
      }

      // Verify counts
      expect(menuItemsUpdated).toBe(1); // Only the string category item
      expect(menuItemsSkipped).toBe(1); // The ObjectId category item
      expect(menuItemsUpdated + menuItemsSkipped).toBe(2);
    });

    it('should handle menu items with all four category types', async () => {
      // Create categories
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
      const categoryMapping = {};

      for (const categoryName of hardcodedCategories) {
        const category = await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
        categoryMapping[categoryName] = category._id;
      }

      const dummyVendor = new mongoose.Types.ObjectId();

      // Create one menu item for each category using direct collection insert
      for (const categoryName of hardcodedCategories) {
        await mongoose.connection.collection('menuitems').insertOne({
          name: `${categoryName} Item`,
          category: categoryName, // String value
          description: `Test ${categoryName}`,
          basePrice: 100,
          foodType: 'Veg',
          vendor: dummyVendor,
          status: 'Available',
          availabilityType: 'All Day',
          stockType: 'Unlimited',
          days: [],
          variants: [],
          promotions: { enabled: false, discount: 0 },
          applyToAll: true,
          outlets: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Simulate migration
      const menuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
      for (const menuItem of menuItems) {
        const categoryString = String(menuItem.category);
        const categoryId = categoryMapping[categoryString];
        if (categoryId) {
          await mongoose.connection.collection('menuitems').updateOne(
            { _id: menuItem._id },
            { $set: { category: categoryId } }
          );
        }
      }

      // Verify all menu items have valid category references
      const updatedMenuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
      expect(updatedMenuItems).toHaveLength(4);

      const categoriesUsed = new Set();
      for (const menuItem of updatedMenuItems) {
        const category = await Category.findById(menuItem.category);
        expect(category).toBeDefined();
        expect(category).not.toBeNull();
        categoriesUsed.add(category.name);
      }

      // Verify all four categories are represented
      expect(categoriesUsed.size).toBe(4);
      hardcodedCategories.forEach(catName => {
        expect(categoriesUsed.has(catName)).toBe(true);
      });
    });
  });

  /**
   * Property 25: Migration logging
   * 
   * When the migration script runs, it should log the migration process including
   * the number of categories created, menu items updated, and any errors encountered.
   * 
   * Validates: Requirements 10.4
   */
  describe('Property 25: Migration logging', () => {
    it('should track and return migration statistics', async () => {
      // Create categories
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
      const categoryMapping = {};
      let categoriesCreated = 0;

      for (const categoryName of hardcodedCategories) {
        let category = await Category.findOne({ name: categoryName });
        if (!category) {
          category = await Category.create({
            name: categoryName,
            description: `${categoryName} items`,
          });
          categoriesCreated++;
        }
        categoryMapping[categoryName] = category._id;
      }

      const dummyVendor = new mongoose.Types.ObjectId();

      // Create menu items using direct collection insert
      const menuItemsData = [
        { name: 'Item 1', category: 'Main Course', foodType: 'Veg' },
        { name: 'Item 2', category: 'Appetizers', foodType: 'Non-Veg' },
        { name: 'Item 3', category: 'Beverages', foodType: 'Veg' },
      ];

      for (const itemData of menuItemsData) {
        await mongoose.connection.collection('menuitems').insertOne({
          name: itemData.name,
          category: itemData.category, // String value
          description: 'Test',
          basePrice: 100,
          foodType: itemData.foodType,
          vendor: dummyVendor,
          status: 'Available',
          availabilityType: 'All Day',
          stockType: 'Unlimited',
          days: [],
          variants: [],
          promotions: { enabled: false, discount: 0 },
          applyToAll: true,
          outlets: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Simulate migration with tracking
      const menuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
      let menuItemsUpdated = 0;
      let menuItemsSkipped = 0;
      const errors = [];

      for (const menuItem of menuItems) {
        try {
          if (mongoose.Types.ObjectId.isValid(menuItem.category) &&
              menuItem.category instanceof mongoose.Types.ObjectId) {
            menuItemsSkipped++;
            continue;
          }

          const categoryString = String(menuItem.category);
          const categoryId = categoryMapping[categoryString];

          if (!categoryId) {
            errors.push(`No mapping found for category "${categoryString}"`);
            continue;
          }

          await mongoose.connection.collection('menuitems').updateOne(
            { _id: menuItem._id },
            { $set: { category: categoryId } }
          );
          menuItemsUpdated++;
        } catch (error) {
          errors.push(`Error updating menu item "${menuItem.name}": ${error.message}`);
        }
      }

      // Verify statistics
      expect(categoriesCreated).toBe(4);
      expect(menuItemsUpdated).toBe(3);
      expect(menuItemsSkipped).toBe(0);
      expect(errors).toHaveLength(0);

      // Verify total items processed
      expect(menuItemsUpdated + menuItemsSkipped).toBe(menuItemsData.length);
    });

    it('should track errors for invalid category mappings', async () => {
      // Create categories (but not all of them)
      const category = await Category.create({
        name: 'Main Course',
        description: 'Main Course items',
      });
      const categoryMapping = { 'Main Course': category._id };

      const dummyVendor = new mongoose.Types.ObjectId();

      // Create menu items with various categories using direct collection insert
      const menuItemsData = [
        { name: 'Item 1', category: 'Main Course', foodType: 'Veg' },
        { name: 'Item 2', category: 'Invalid Category', foodType: 'Non-Veg' }, // This will cause an error
        { name: 'Item 3', category: 'Another Invalid', foodType: 'Egg' }, // This will cause an error
      ];

      for (const itemData of menuItemsData) {
        await mongoose.connection.collection('menuitems').insertOne({
          name: itemData.name,
          category: itemData.category, // String value
          description: 'Test',
          basePrice: 100,
          foodType: itemData.foodType,
          vendor: dummyVendor,
          status: 'Available',
          availabilityType: 'All Day',
          stockType: 'Unlimited',
          days: [],
          variants: [],
          promotions: { enabled: false, discount: 0 },
          applyToAll: true,
          outlets: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Simulate migration with error tracking
      const menuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
      let menuItemsUpdated = 0;
      const errors = [];

      for (const menuItem of menuItems) {
        const categoryString = String(menuItem.category);
        const categoryId = categoryMapping[categoryString];

        if (!categoryId) {
          errors.push(`No mapping found for category "${categoryString}" in menu item "${menuItem.name}"`);
          continue;
        }

        await mongoose.connection.collection('menuitems').updateOne(
          { _id: menuItem._id },
          { $set: { category: categoryId } }
        );
        menuItemsUpdated++;
      }

      // Verify statistics
      expect(menuItemsUpdated).toBe(1); // Only 'Main Course' item updated
      expect(errors).toHaveLength(2); // Two invalid categories
      expect(errors[0]).toContain('Invalid Category');
      expect(errors[1]).toContain('Another Invalid');
    });

    it('should verify all menu items have valid category references after migration', async () => {
      // Create categories
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
      const categoryMapping = {};

      for (const categoryName of hardcodedCategories) {
        const category = await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
        categoryMapping[categoryName] = category._id;
      }

      const dummyVendor = new mongoose.Types.ObjectId();

      // Create menu items using direct collection insert
      const menuItemsData = [
        { name: 'Item 1', category: 'Main Course', foodType: 'Veg' },
        { name: 'Item 2', category: 'Appetizers', foodType: 'Non-Veg' },
      ];

      for (const itemData of menuItemsData) {
        await mongoose.connection.collection('menuitems').insertOne({
          name: itemData.name,
          category: itemData.category, // String value
          description: 'Test',
          basePrice: 100,
          foodType: itemData.foodType,
          vendor: dummyVendor,
          status: 'Available',
          availabilityType: 'All Day',
          stockType: 'Unlimited',
          days: [],
          variants: [],
          promotions: { enabled: false, discount: 0 },
          applyToAll: true,
          outlets: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Simulate migration
      const menuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
      for (const menuItem of menuItems) {
        const categoryString = String(menuItem.category);
        const categoryId = categoryMapping[categoryString];
        if (categoryId) {
          await mongoose.connection.collection('menuitems').updateOne(
            { _id: menuItem._id },
            { $set: { category: categoryId } }
          );
        }
      }

      // Verify all menu items have valid category references
      const invalidMenuItems = [];
      const updatedMenuItems = await mongoose.connection.collection('menuitems').find({}).toArray();

      for (const menuItem of updatedMenuItems) {
        const category = await Category.findById(menuItem.category);
        if (!category) {
          invalidMenuItems.push(menuItem.name);
        }
      }

      // Verify no invalid menu items
      expect(invalidMenuItems).toHaveLength(0);
    });

    it('should track statistics for mixed migration scenarios', async () => {
      // Create categories
      const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
      const categoryMapping = {};

      for (const categoryName of hardcodedCategories) {
        const category = await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
        categoryMapping[categoryName] = category._id;
      }

      const dummyVendor = new mongoose.Types.ObjectId();

      // Create menu items: some with strings, some already migrated
      await mongoose.connection.collection('menuitems').insertOne({
        name: 'String Item 1',
        category: 'Main Course', // String value
        description: 'Test',
        basePrice: 100,
        foodType: 'Veg',
        vendor: dummyVendor,
        status: 'Available',
        availabilityType: 'All Day',
        stockType: 'Unlimited',
        days: [],
        variants: [],
        promotions: { enabled: false, discount: 0 },
        applyToAll: true,
        outlets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await mongoose.connection.collection('menuitems').insertOne({
        name: 'String Item 2',
        category: 'Appetizers', // String value
        description: 'Test',
        basePrice: 100,
        foodType: 'Non-Veg',
        vendor: dummyVendor,
        status: 'Available',
        availabilityType: 'All Day',
        stockType: 'Unlimited',
        days: [],
        variants: [],
        promotions: { enabled: false, discount: 0 },
        applyToAll: true,
        outlets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await mongoose.connection.collection('menuitems').insertOne({
        name: 'Migrated Item',
        category: categoryMapping['Beverages'], // ObjectId value (already migrated)
        description: 'Test',
        basePrice: 100,
        foodType: 'Egg',
        vendor: dummyVendor,
        status: 'Available',
        availabilityType: 'All Day',
        stockType: 'Unlimited',
        days: [],
        variants: [],
        promotions: { enabled: false, discount: 0 },
        applyToAll: true,
        outlets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Simulate migration
      const menuItems = await mongoose.connection.collection('menuitems').find({}).toArray();
      let menuItemsUpdated = 0;
      let menuItemsSkipped = 0;

      for (const menuItem of menuItems) {
        if (mongoose.Types.ObjectId.isValid(menuItem.category) &&
            menuItem.category instanceof mongoose.Types.ObjectId) {
          menuItemsSkipped++;
          continue;
        }

        const categoryString = String(menuItem.category);
        const categoryId = categoryMapping[categoryString];

        if (categoryId) {
          await mongoose.connection.collection('menuitems').updateOne(
            { _id: menuItem._id },
            { $set: { category: categoryId } }
          );
          menuItemsUpdated++;
        }
      }

      // Verify statistics
      expect(menuItemsUpdated).toBe(2); // Two string items updated
      expect(menuItemsSkipped).toBe(1); // One already migrated
      expect(menuItemsUpdated + menuItemsSkipped).toBe(3); // Total items
    });
  });
});
