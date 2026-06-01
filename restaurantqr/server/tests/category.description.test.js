import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';

/**
 * Feature: category-management
 * Property 4: Optional description field
 * 
 * For any category creation or update request, the description field should be optional -
 * categories can be created with or without descriptions, and both should succeed.
 * 
 * Validates: Requirements 1.3
 */
describe('Feature: category-management, Property 4: Optional description field', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-description-test' });
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

  it('should successfully create category without description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          
          // Create category without description field
          const category = await Category.create({ name: trimmedName });
          
          // Verify category is created successfully
          expect(category._id).toBeDefined();
          expect(category.name).toBe(trimmedName);
          
          // Description should default to empty string
          expect(category.description).toBeDefined();
          expect(category.description).toBe('');
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should successfully create category with description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (categoryName, description) => {
          const trimmedName = categoryName.trim();
          const trimmedDescription = description.trim();
          
          // Create category with description
          const category = await Category.create({ 
            name: trimmedName,
            description: trimmedDescription
          });
          
          // Verify category is created successfully with description
          expect(category._id).toBeDefined();
          expect(category.name).toBe(trimmedName);
          expect(category.description).toBe(trimmedDescription);
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should successfully create category with empty string description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          
          // Create category with explicitly empty description
          const category = await Category.create({ 
            name: trimmedName,
            description: ''
          });
          
          // Verify category is created successfully
          expect(category._id).toBeDefined();
          expect(category.name).toBe(trimmedName);
          expect(category.description).toBe('');
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should successfully update category to add description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (categoryName, newDescription) => {
          const trimmedName = categoryName.trim();
          const trimmedDescription = newDescription.trim();
          
          // Create category without description
          const category = await Category.create({ name: trimmedName });
          expect(category.description).toBe('');
          
          // Update to add description
          category.description = trimmedDescription;
          await category.save();
          
          // Verify description was added
          const updated = await Category.findById(category._id);
          expect(updated.description).toBe(trimmedDescription);
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should successfully update category to remove description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (categoryName, initialDescription) => {
          const trimmedName = categoryName.trim();
          const trimmedDescription = initialDescription.trim();
          
          // Create category with description
          const category = await Category.create({ 
            name: trimmedName,
            description: trimmedDescription
          });
          expect(category.description).toBe(trimmedDescription);
          
          // Update to remove description
          category.description = '';
          await category.save();
          
          // Verify description was removed
          const updated = await Category.findById(category._id);
          expect(updated.description).toBe('');
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept description with maximum allowed length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          const maxLengthDescription = 'a'.repeat(200);
          
          // Create category with max length description
          const category = await Category.create({ 
            name: trimmedName,
            description: maxLengthDescription
          });
          
          // Verify category is created successfully
          expect(category._id).toBeDefined();
          expect(category.name).toBe(trimmedName);
          expect(category.description).toBe(maxLengthDescription);
          expect(category.description.length).toBe(200);
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject description exceeding maximum length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          const tooLongDescription = 'a'.repeat(201);
          
          // Attempt to create category with description exceeding max length
          await expect(
            Category.create({ 
              name: trimmedName,
              description: tooLongDescription
            })
          ).rejects.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });
});
