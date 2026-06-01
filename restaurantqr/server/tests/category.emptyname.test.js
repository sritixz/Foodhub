import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import Category from '../models/Category.js';

/**
 * Feature: category-management
 * Property 3: Empty name rejection
 * 
 * For any string composed entirely of whitespace or empty string,
 * attempting to create or update a category with that name should be
 * rejected with a validation error.
 * 
 * Validates: Requirements 2.3
 */
describe('Feature: category-management, Property 3: Empty name rejection', () => {
  let mongoServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-emptyname-test' });
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

  it('should reject category creation with empty string name', async () => {
    // Attempt to create category with empty string
    await expect(
      Category.create({ name: '' })
    ).rejects.toThrow();
  });

  it('should reject category creation with whitespace-only names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }),
        async (whitespaceChars) => {
          const whitespaceName = whitespaceChars.join('');
          
          // Attempt to create category with whitespace-only name
          // After trim(), this becomes empty string which should be rejected
          await expect(
            Category.create({ name: whitespaceName })
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject category update to empty string name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (validName) => {
          const trimmedName = validName.trim();
          
          // Create category with valid name
          const category = await Category.create({ name: trimmedName });
          
          // Attempt to update to empty string
          category.name = '';
          await expect(category.save()).rejects.toThrow();
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject category update to whitespace-only name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }),
        async (validName, whitespaceChars) => {
          const trimmedName = validName.trim();
          const whitespaceName = whitespaceChars.join('');
          
          // Create category with valid name
          const category = await Category.create({ name: trimmedName });
          
          // Attempt to update to whitespace-only name
          category.name = whitespaceName;
          await expect(category.save()).rejects.toThrow();
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject category creation with name that becomes empty after trim', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }),
        async (whitespaceChars) => {
          const whitespaceName = whitespaceChars.join('');
          
          // The trim() in the schema will convert this to empty string
          // which should fail the minlength: 1 validation
          await expect(
            Category.create({ name: whitespaceName })
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept category with valid name containing internal whitespace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
        ),
        async ([part1, part2]) => {
          const validName = `${part1.trim()} ${part2.trim()}`;
          
          // Should successfully create category with internal whitespace
          const category = await Category.create({ name: validName });
          
          // Verify category was created
          expect(category._id).toBeDefined();
          expect(category.name).toBe(validName);
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should trim leading and trailing whitespace but reject if result is empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 10 }),
        fc.array(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 10 }),
        async (leadingSpaceChars, trailingSpaceChars) => {
          // Name with only leading and trailing whitespace
          const nameWithSpaces = leadingSpaceChars.join('') + trailingSpaceChars.join('');
          
          // Should be rejected because after trim it's empty
          await expect(
            Category.create({ name: nameWithSpaces })
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
