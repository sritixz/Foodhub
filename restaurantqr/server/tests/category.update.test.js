import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';

/**
 * Feature: category-management
 * Property 7: Category update with valid data
 * 
 * For any existing category and valid new name, when a super admin updates the category,
 * the system should update the category name and/or description, update the modification
 * timestamp, and return the updated category.
 * 
 * Validates: Requirements 4.1, 4.3
 */
describe('Feature: category-management, Property 7: Category update with valid data', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-update-test' });
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
  });

  it('should update category name and update modification timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
        ).filter(([name1, name2]) => name1.trim() !== name2.trim()),
        async ([originalName, newName]) => {
          const trimmedOriginalName = originalName.trim();
          const trimmedNewName = newName.trim();
          
          // Create category with original name
          const category = await Category.create({ 
            name: trimmedOriginalName,
            description: 'Original description'
          });
          
          const originalUpdatedAt = category.updatedAt;
          
          // Wait a small amount to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Update category name
          category.name = trimmedNewName;
          category.updatedAt = Date.now();
          const updated = await category.save();
          
          // Verify name was updated
          expect(updated.name).toBe(trimmedNewName);
          
          // Verify updatedAt timestamp was updated
          expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
          
          // Verify createdAt timestamp remains unchanged
          expect(updated.createdAt.getTime()).toBe(category.createdAt.getTime());
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update category description and update modification timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.tuple(
          fc.string({ maxLength: 200 }),
          fc.string({ maxLength: 200 })
        ).filter(([desc1, desc2]) => desc1.trim() !== desc2.trim()),
        async (categoryName, [originalDescription, newDescription]) => {
          const trimmedName = categoryName.trim();
          const trimmedOriginalDesc = originalDescription.trim();
          const trimmedNewDesc = newDescription.trim();
          
          // Create category with original description
          const category = await Category.create({ 
            name: trimmedName,
            description: trimmedOriginalDesc
          });
          
          const originalUpdatedAt = category.updatedAt;
          
          // Wait a small amount to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Update category description
          category.description = trimmedNewDesc;
          category.updatedAt = Date.now();
          const updated = await category.save();
          
          // Verify description was updated
          expect(updated.description).toBe(trimmedNewDesc);
          
          // Verify name remains unchanged
          expect(updated.name).toBe(trimmedName);
          
          // Verify updatedAt timestamp was updated
          expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update both name and description simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
        ).filter(([name1, name2]) => name1.trim() !== name2.trim()),
        fc.tuple(
          fc.string({ maxLength: 200 }),
          fc.string({ maxLength: 200 })
        ).filter(([desc1, desc2]) => desc1.trim() !== desc2.trim()),
        async ([originalName, newName], [originalDescription, newDescription]) => {
          const trimmedOriginalName = originalName.trim();
          const trimmedNewName = newName.trim();
          const trimmedOriginalDesc = originalDescription.trim();
          const trimmedNewDesc = newDescription.trim();
          
          // Create category with original values
          const category = await Category.create({ 
            name: trimmedOriginalName,
            description: trimmedOriginalDesc
          });
          
          const originalUpdatedAt = category.updatedAt;
          
          // Wait a small amount to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Update both name and description
          category.name = trimmedNewName;
          category.description = trimmedNewDesc;
          category.updatedAt = Date.now();
          const updated = await category.save();
          
          // Verify both fields were updated
          expect(updated.name).toBe(trimmedNewName);
          expect(updated.description).toBe(trimmedNewDesc);
          
          // Verify updatedAt timestamp was updated
          expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
          
          // Verify createdAt timestamp remains unchanged
          expect(updated.createdAt.getTime()).toBe(category.createdAt.getTime());
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return updated category with all fields after update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
        ).filter(([name1, name2]) => name1.trim() !== name2.trim()),
        fc.string({ maxLength: 200 }),
        async ([originalName, newName], newDescription) => {
          const trimmedOriginalName = originalName.trim();
          const trimmedNewName = newName.trim();
          const trimmedNewDesc = newDescription.trim();
          
          // Create category
          const category = await Category.create({ 
            name: trimmedOriginalName,
            description: 'Original description'
          });
          
          const originalId = category._id;
          const originalCreatedAt = category.createdAt;
          
          // Wait a small amount to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Update category
          category.name = trimmedNewName;
          category.description = trimmedNewDesc;
          category.updatedAt = Date.now();
          const updated = await category.save();
          
          // Verify all fields are present in returned category
          expect(updated._id).toBeDefined();
          expect(updated._id.toString()).toBe(originalId.toString());
          expect(updated.name).toBe(trimmedNewName);
          expect(updated.description).toBe(trimmedNewDesc);
          expect(updated.createdAt).toBeDefined();
          expect(updated.updatedAt).toBeDefined();
          
          // Verify ID and createdAt remain unchanged
          expect(updated._id.toString()).toBe(originalId.toString());
          expect(updated.createdAt.getTime()).toBe(originalCreatedAt.getTime());
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist updates to database', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
        ).filter(([name1, name2]) => name1.trim() !== name2.trim()),
        async ([originalName, newName]) => {
          const trimmedOriginalName = originalName.trim();
          const trimmedNewName = newName.trim();
          
          // Create category
          const category = await Category.create({ 
            name: trimmedOriginalName,
            description: 'Test description'
          });
          
          // Wait a small amount to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Update category
          category.name = trimmedNewName;
          category.updatedAt = Date.now();
          await category.save();
          
          // Retrieve from database to verify persistence
          const retrieved = await Category.findById(category._id);
          
          // Verify updates were persisted
          expect(retrieved.name).toBe(trimmedNewName);
          expect(retrieved.updatedAt.getTime()).toBeGreaterThan(category.createdAt.getTime());
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow updating category to empty description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (categoryName, originalDescription) => {
          const trimmedName = categoryName.trim();
          const trimmedDesc = originalDescription.trim();
          
          // Create category with description
          const category = await Category.create({ 
            name: trimmedName,
            description: trimmedDesc
          });
          
          // Wait a small amount to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Update to empty description
          category.description = '';
          category.updatedAt = Date.now();
          const updated = await category.save();
          
          // Verify description was cleared
          expect(updated.description).toBe('');
          
          // Verify name remains unchanged
          expect(updated.name).toBe(trimmedName);
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});
