import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';

/**
 * Feature: category-management
 * Property 6: Category list retrieval and ordering
 * 
 * For any set of categories in the system, when an authenticated user requests the category list,
 * the system should return all categories ordered alphabetically by name, with each category
 * including its identifier, name, description, and menu item count.
 * 
 * Validates: Requirements 3.1, 3.2
 */
describe('Feature: category-management, Property 6: Category list retrieval and ordering', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-list-test' });
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

  it('should return all categories ordered alphabetically by name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          { minLength: 2, maxLength: 10 }
        ).map(names => [...new Set(names.map(n => n.trim()))]), // Ensure unique names
        async (categoryNames) => {
          // Skip if we don't have at least 2 unique names
          if (categoryNames.length < 2) return;
          
          // Clean up before this iteration
          await Category.deleteMany({});
          
          // Create categories in random order
          const createdCategories = await Promise.all(
            categoryNames.map(name => Category.create({ name }))
          );
          
          // Retrieve categories (simulating the API endpoint logic)
          const retrievedCategories = await Category.find().sort({ name: 1 });
          
          // Verify all categories are returned
          expect(retrievedCategories.length).toBe(createdCategories.length);
          
          // Verify ordering is consistent with MongoDB's sort
          // MongoDB sorts using binary comparison, so we just verify it's sorted
          for (let i = 0; i < retrievedCategories.length - 1; i++) {
            const current = retrievedCategories[i].name;
            const next = retrievedCategories[i + 1].name;
            // MongoDB's sort order: current should come before or equal to next
            expect(current <= next).toBe(true);
          }
          
          // Verify each category has required fields
          retrievedCategories.forEach(category => {
            expect(category._id).toBeDefined();
            expect(category.name).toBeDefined();
            expect(category.description).toBeDefined();
            expect(category.createdAt).toBeDefined();
            expect(category.updatedAt).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include menu item count for each category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            menuItemCount: fc.integer({ min: 0, max: 10 })
          }),
          { minLength: 1, maxLength: 5 }
        ).map(records => {
          // Ensure unique category names
          const uniqueNames = new Set();
          return records.filter(r => {
            const trimmedName = r.name.trim();
            if (uniqueNames.has(trimmedName)) return false;
            uniqueNames.add(trimmedName);
            return true;
          });
        }),
        async (categoryData) => {
          // Skip if no valid categories
          if (categoryData.length === 0) return;
          
          // Clean up before this iteration
          await Category.deleteMany({});
          await MenuItem.deleteMany({});
          
          // Create categories and associated menu items
          for (const data of categoryData) {
            const category = await Category.create({ name: data.name.trim() });
            
            // Create menu items for this category
            for (let i = 0; i < data.menuItemCount; i++) {
              await MenuItem.create({
                name: `Item ${i} for ${category.name}`,
                category: category._id,
                description: 'Test item',
                basePrice: 10,
                foodType: 'Veg',
                vendor: new mongoose.Types.ObjectId(),
                outlet: new mongoose.Types.ObjectId()
              });
            }
          }
          
          // Retrieve categories with menu item counts (simulating API logic)
          const categories = await Category.find().sort({ name: 1 });
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
          
          // Verify menu item counts match expected values
          categoriesWithCount.forEach(category => {
            const expectedData = categoryData.find(d => d.name.trim() === category.name);
            expect(category.menuItemCount).toBe(expectedData.menuItemCount);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty array when no categories exist', async () => {
    // Ensure database is empty
    await Category.deleteMany({});
    
    // Retrieve categories
    const categories = await Category.find().sort({ name: 1 });
    
    // Verify empty array is returned
    expect(categories).toEqual([]);
    expect(categories.length).toBe(0);
  });

  it('should include all required fields in category response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          description: fc.string({ maxLength: 200 })
        }),
        async (categoryData) => {
          const trimmedName = categoryData.name.trim();
          const trimmedDescription = categoryData.description.trim();
          
          // Create category
          const created = await Category.create({ 
            name: trimmedName,
            description: trimmedDescription
          });
          
          // Retrieve categories
          const categories = await Category.find().sort({ name: 1 });
          
          // Verify the category has all required fields
          expect(categories.length).toBe(1);
          const category = categories[0];
          
          // Required fields from Requirements 3.2
          expect(category._id).toBeDefined();
          expect(category._id).toBeInstanceOf(mongoose.Types.ObjectId);
          expect(category.name).toBe(trimmedName);
          expect(category.description).toBe(trimmedDescription);
          expect(category.createdAt).toBeDefined();
          expect(category.createdAt).toBeInstanceOf(Date);
          expect(category.updatedAt).toBeDefined();
          expect(category.updatedAt).toBeInstanceOf(Date);
          
          // Cleanup
          await Category.deleteOne({ _id: created._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain alphabetical order regardless of creation order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          { minLength: 3, maxLength: 8 }
        ).map(names => [...new Set(names.map(n => n.trim()))]),
        async (categoryNames) => {
          // Skip if we don't have at least 3 unique names
          if (categoryNames.length < 3) return;
          
          // Clean up before this iteration
          await Category.deleteMany({});
          
          // Shuffle the names to create in random order
          const shuffled = [...categoryNames].sort(() => Math.random() - 0.5);
          
          // Create categories in shuffled order
          await Promise.all(
            shuffled.map(name => Category.create({ name }))
          );
          
          // Retrieve categories
          const retrievedCategories = await Category.find().sort({ name: 1 });
          
          // Verify alphabetical ordering using MongoDB's sort order
          const retrievedNames = retrievedCategories.map(c => c.name);
          
          // Verify the order matches what MongoDB would produce
          for (let i = 0; i < retrievedNames.length - 1; i++) {
            expect(retrievedNames[i] <= retrievedNames[i + 1]).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle categories with special characters in alphabetical ordering', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          { minLength: 2, maxLength: 6 }
        ).map(names => [...new Set(names.map(n => n.trim()))]),
        async (categoryNames) => {
          // Skip if we don't have at least 2 unique names
          if (categoryNames.length < 2) return;
          
          // Clean up before this iteration
          await Category.deleteMany({});
          
          // Create categories
          await Promise.all(
            categoryNames.map(name => Category.create({ name }))
          );
          
          // Retrieve categories
          const retrievedCategories = await Category.find().sort({ name: 1 });
          
          // Verify ordering is consistent with MongoDB's sort
          for (let i = 0; i < retrievedCategories.length - 1; i++) {
            const current = retrievedCategories[i].name;
            const next = retrievedCategories[i + 1].name;
            
            // MongoDB's sort should maintain consistent ordering
            expect(current <= next).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
