import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';

/**
 * Feature: category-management
 * Property 9: Category deletion without menu items
 * 
 * For any category that has no associated menu items, when a super admin attempts to delete it,
 * the system should successfully delete the category and return a success confirmation.
 * 
 * Validates: Requirements 5.1, 5.3
 */
describe('Feature: category-management, Property 9: Category deletion without menu items', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-deletion-test' });
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

  it('should successfully delete a category with no associated menu items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ maxLength: 200 }),
        async (categoryName, description) => {
          const trimmedName = categoryName.trim();
          const trimmedDescription = description.trim();
          
          // Create category with no menu items
          const category = await Category.create({ 
            name: trimmedName,
            description: trimmedDescription
          });
          
          // Verify category exists
          const foundCategory = await Category.findById(category._id);
          expect(foundCategory).not.toBeNull();
          
          // Verify no menu items are associated
          const menuItemCount = await MenuItem.countDocuments({ category: category._id });
          expect(menuItemCount).toBe(0);
          
          // Delete the category
          await Category.findByIdAndDelete(category._id);
          
          // Verify category is deleted
          const deletedCategory = await Category.findById(category._id);
          expect(deletedCategory).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should successfully delete multiple categories without menu items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          { minLength: 2, maxLength: 5 }
        ).map(names => [...new Set(names.map(n => n.trim()))]), // Ensure unique names
        async (categoryNames) => {
          // Skip if we don't have at least 2 unique names after filtering
          if (categoryNames.length < 2) return;
          
          // Create multiple categories without menu items
          const categories = await Promise.all(
            categoryNames.map(name => Category.create({ name }))
          );
          
          // Verify all categories exist
          for (const category of categories) {
            const found = await Category.findById(category._id);
            expect(found).not.toBeNull();
            
            // Verify no menu items
            const count = await MenuItem.countDocuments({ category: category._id });
            expect(count).toBe(0);
          }
          
          // Delete all categories
          await Promise.all(
            categories.map(cat => Category.findByIdAndDelete(cat._id))
          );
          
          // Verify all categories are deleted
          for (const category of categories) {
            const deleted = await Category.findById(category._id);
            expect(deleted).toBeNull();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return the correct count of menu items (zero) before deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          
          // Create category
          const category = await Category.create({ name: trimmedName });
          
          // Use the model's instance method to get count
          const count = await category.getMenuItemCount();
          expect(count).toBe(0);
          
          // Also verify using direct query
          const directCount = await MenuItem.countDocuments({ category: category._id });
          expect(directCount).toBe(0);
          
          // Delete should succeed
          await Category.findByIdAndDelete(category._id);
          
          // Verify deletion
          const deleted = await Category.findById(category._id);
          expect(deleted).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow deletion immediately after category creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          
          // Create and immediately delete category
          const category = await Category.create({ name: trimmedName });
          const categoryId = category._id;
          
          // Verify no menu items
          const count = await MenuItem.countDocuments({ category: categoryId });
          expect(count).toBe(0);
          
          // Delete immediately
          const result = await Category.findByIdAndDelete(categoryId);
          
          // Verify deletion succeeded and returned the deleted document
          expect(result).not.toBeNull();
          expect(result._id.toString()).toBe(categoryId.toString());
          
          // Verify category no longer exists
          const deleted = await Category.findById(categoryId);
          expect(deleted).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain database consistency after deleting categories without menu items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          { minLength: 3, maxLength: 10 }
        ).map(names => [...new Set(names.map(n => n.trim()))]),
        async (categoryNames) => {
          if (categoryNames.length < 3) return;
          
          // Create categories
          const categories = await Promise.all(
            categoryNames.map(name => Category.create({ name }))
          );
          
          const initialCount = await Category.countDocuments({});
          expect(initialCount).toBe(categories.length);
          
          // Delete half of the categories (rounded down)
          const toDelete = categories.slice(0, Math.floor(categories.length / 2));
          const toKeep = categories.slice(Math.floor(categories.length / 2));
          
          await Promise.all(
            toDelete.map(cat => Category.findByIdAndDelete(cat._id))
          );
          
          // Verify correct number of categories remain
          const remainingCount = await Category.countDocuments({});
          expect(remainingCount).toBe(toKeep.length);
          
          // Verify deleted categories are gone
          for (const cat of toDelete) {
            const found = await Category.findById(cat._id);
            expect(found).toBeNull();
          }
          
          // Verify kept categories still exist
          for (const cat of toKeep) {
            const found = await Category.findById(cat._id);
            expect(found).not.toBeNull();
            expect(found.name).toBe(cat.name);
          }
          
          // Cleanup remaining
          await Category.deleteMany({});
        }
      ),
      { numRuns: 50 }
    );
  });
});
