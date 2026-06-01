import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';

/**
 * Feature: category-management
 * Property 2: Category creation with valid data
 * 
 * For any valid category name (non-empty, 1-50 characters) submitted by a super admin,
 * the system should successfully create a category and return it with a unique identifier,
 * timestamps, and the provided name and optional description.
 * 
 * Validates: Requirements 1.4, 1.5, 2.1, 2.4
 */
describe('Feature: category-management, Property 2: Category creation with valid data', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-creation-test' });
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

  it('should create category with valid name and return with unique identifier and timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          const beforeCreation = Date.now();
          
          // Create category with valid name
          const category = await Category.create({ name: trimmedName });
          
          const afterCreation = Date.now();
          
          // Verify unique identifier is assigned
          expect(category._id).toBeDefined();
          expect(category._id).toBeInstanceOf(mongoose.Types.ObjectId);
          
          // Verify name is stored correctly
          expect(category.name).toBe(trimmedName);
          
          // Verify createdAt timestamp exists and is within reasonable range
          expect(category.createdAt).toBeDefined();
          expect(category.createdAt).toBeInstanceOf(Date);
          expect(category.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation);
          expect(category.createdAt.getTime()).toBeLessThanOrEqual(afterCreation);
          
          // Verify updatedAt timestamp exists and is within reasonable range
          expect(category.updatedAt).toBeDefined();
          expect(category.updatedAt).toBeInstanceOf(Date);
          expect(category.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreation);
          expect(category.updatedAt.getTime()).toBeLessThanOrEqual(afterCreation);
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create category with valid name and optional description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ maxLength: 200 }),
        async (categoryName, description) => {
          const trimmedName = categoryName.trim();
          const trimmedDescription = description.trim();
          
          // Create category with name and description
          const category = await Category.create({ 
            name: trimmedName,
            description: trimmedDescription
          });
          
          // Verify all required fields
          expect(category._id).toBeDefined();
          expect(category.name).toBe(trimmedName);
          expect(category.description).toBe(trimmedDescription);
          expect(category.createdAt).toBeDefined();
          expect(category.updatedAt).toBeDefined();
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create category without description (optional field)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          
          // Create category without description
          const category = await Category.create({ name: trimmedName });
          
          // Verify category is created successfully
          expect(category._id).toBeDefined();
          expect(category.name).toBe(trimmedName);
          
          // Description should default to empty string
          expect(category.description).toBe('');
          
          // Timestamps should still be present
          expect(category.createdAt).toBeDefined();
          expect(category.updatedAt).toBeDefined();
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create multiple categories with unique identifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          { minLength: 2, maxLength: 10 }
        ).map(names => [...new Set(names.map(n => n.trim()))]), // Ensure unique names
        async (categoryNames) => {
          // Skip if we don't have at least 2 unique names after filtering
          if (categoryNames.length < 2) return;
          
          // Create multiple categories
          const categories = await Promise.all(
            categoryNames.map(name => Category.create({ name }))
          );
          
          // Verify all have unique identifiers
          const ids = categories.map(c => c._id.toString());
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(categories.length);
          
          // Verify all have timestamps
          categories.forEach(category => {
            expect(category.createdAt).toBeDefined();
            expect(category.updatedAt).toBeDefined();
            expect(category.createdAt).toBeInstanceOf(Date);
            expect(category.updatedAt).toBeInstanceOf(Date);
          });
          
          // Cleanup
          await Category.deleteMany({ _id: { $in: categories.map(c => c._id) } });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve timestamps after retrieval from database', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          
          // Create category
          const created = await Category.create({ name: trimmedName });
          
          // Retrieve from database
          const retrieved = await Category.findById(created._id);
          
          // Verify timestamps are preserved
          expect(retrieved.createdAt.getTime()).toBe(created.createdAt.getTime());
          expect(retrieved.updatedAt.getTime()).toBe(created.updatedAt.getTime());
          
          // Cleanup
          await Category.deleteOne({ _id: created._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});
