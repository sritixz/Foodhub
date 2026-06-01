import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import Category from '../models/Category.js';
import User from '../models/User.js';
import categoryRoutes from '../routes/categories.js';

/**
 * Feature: category-management
 * Property 8: Invalid category ID error handling
 * 
 * For any invalid or non-existent category identifier, when attempting to update or delete
 * that category, the system should return a 404 Not Found error.
 * 
 * Validates: Requirements 4.5, 5.5
 */
describe('Feature: category-management, Property 8: Invalid category ID error handling', () => {
  let mongoServer;
  let app;
  let adminToken;
  
  // JWT secret for testing
  const JWT_SECRET = 'test-secret-key';
  process.env.JWT_SECRET = JWT_SECRET;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-invalidid-test' });

    // Set up Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/categories', categoryRoutes);

    // Create admin user and token for authentication
    const adminUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      phone: '1234567890',
      role: 'Admin',
      password: 'password123',
      status: 'Active'
    });
    
    adminToken = jwt.sign({ userId: adminUser._id }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clean up categories before each test (keep the admin user)
    await Category.deleteMany({});
  });

  it('should return 404 when updating a category with non-existent valid ObjectId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (newName) => {
          const trimmedName = newName.trim();
          
          // Generate a valid but non-existent ObjectId
          const nonExistentId = new mongoose.Types.ObjectId();
          
          // Verify the ID doesn't exist
          const exists = await Category.findById(nonExistentId);
          expect(exists).toBeNull();
          
          // Attempt to update with non-existent ID
          const response = await request(app)
            .put(`/api/categories/${nonExistentId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: trimmedName });
          
          // Should return 404
          expect(response.status).toBe(404);
          expect(response.body.message).toBe('Category not found');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 404 when deleting a category with non-existent valid ObjectId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Generate a valid but non-existent ObjectId
          const nonExistentId = new mongoose.Types.ObjectId();
          
          // Verify the ID doesn't exist
          const exists = await Category.findById(nonExistentId);
          expect(exists).toBeNull();
          
          // Attempt to delete with non-existent ID
          const response = await request(app)
            .delete(`/api/categories/${nonExistentId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          
          // Should return 404
          expect(response.status).toBe(404);
          expect(response.body.message).toBe('Category not found');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 404 when getting a category with non-existent valid ObjectId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Generate a valid but non-existent ObjectId
          const nonExistentId = new mongoose.Types.ObjectId();
          
          // Verify the ID doesn't exist
          const exists = await Category.findById(nonExistentId);
          expect(exists).toBeNull();
          
          // Attempt to get with non-existent ID
          const response = await request(app)
            .get(`/api/categories/${nonExistentId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          
          // Should return 404
          expect(response.status).toBe(404);
          expect(response.body.message).toBe('Category not found');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 404 when updating with malformed ObjectId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => {
          // Filter out valid ObjectIds, whitespace, and special URL characters
          const trimmed = s.trim();
          // Only test alphanumeric invalid IDs to avoid URL encoding issues
          return trimmed.length > 0 && 
                 /^[a-zA-Z0-9]+$/.test(trimmed) &&
                 (!mongoose.Types.ObjectId.isValid(s) || s.length !== 24);
        }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (invalidId, newName) => {
          const trimmedName = newName.trim();
          
          // Attempt to update with malformed ID
          const response = await request(app)
            .put(`/api/categories/${invalidId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: trimmedName });
          
          // Should return 404 (CastError is caught and converted to 404)
          expect(response.status).toBe(404);
          if (response.body.message) {
            expect(response.body.message).toBe('Category not found');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return 404 when deleting with malformed ObjectId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => {
          // Filter out valid ObjectIds, whitespace, and special URL characters
          const trimmed = s.trim();
          // Only test alphanumeric invalid IDs to avoid URL encoding issues
          return trimmed.length > 0 && 
                 /^[a-zA-Z0-9]+$/.test(trimmed) &&
                 (!mongoose.Types.ObjectId.isValid(s) || s.length !== 24);
        }),
        async (invalidId) => {
          // Attempt to delete with malformed ID
          const response = await request(app)
            .delete(`/api/categories/${invalidId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          
          // Should return 404 (CastError is caught and converted to 404)
          expect(response.status).toBe(404);
          if (response.body.message) {
            expect(response.body.message).toBe('Category not found');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return 404 when getting with malformed ObjectId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => {
          // Filter out valid ObjectIds, whitespace, and special URL characters
          const trimmed = s.trim();
          // Only test alphanumeric invalid IDs to avoid URL encoding issues
          return trimmed.length > 0 && 
                 /^[a-zA-Z0-9]+$/.test(trimmed) &&
                 (!mongoose.Types.ObjectId.isValid(s) || s.length !== 24);
        }),
        async (invalidId) => {
          // Attempt to get with malformed ID
          const response = await request(app)
            .get(`/api/categories/${invalidId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          
          // Should return 404 (CastError is caught and converted to 404)
          expect(response.status).toBe(404);
          if (response.body.message) {
            expect(response.body.message).toBe('Category not found');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return 404 when getting menu item count with non-existent ObjectId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Generate a valid but non-existent ObjectId
          const nonExistentId = new mongoose.Types.ObjectId();
          
          // Verify the ID doesn't exist
          const exists = await Category.findById(nonExistentId);
          expect(exists).toBeNull();
          
          // Attempt to get menu item count with non-existent ID
          const response = await request(app)
            .get(`/api/categories/${nonExistentId}/menu-items-count`)
            .set('Authorization', `Bearer ${adminToken}`);
          
          // Should return 404
          expect(response.status).toBe(404);
          expect(response.body.message).toBe('Category not found');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 404 for update even after category is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (originalName, newName) => {
          const trimmedOriginalName = originalName.trim();
          const trimmedNewName = newName.trim();
          
          // Create a category
          const category = await Category.create({ name: trimmedOriginalName });
          const categoryId = category._id;
          
          // Delete the category
          await Category.findByIdAndDelete(categoryId);
          
          // Verify it's deleted
          const exists = await Category.findById(categoryId);
          expect(exists).toBeNull();
          
          // Attempt to update the deleted category
          const response = await request(app)
            .put(`/api/categories/${categoryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: trimmedNewName });
          
          // Should return 404
          expect(response.status).toBe(404);
          expect(response.body.message).toBe('Category not found');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 404 for delete even after category is already deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const trimmedName = categoryName.trim();
          
          // Create a category
          const category = await Category.create({ name: trimmedName });
          const categoryId = category._id;
          
          // Delete the category
          await Category.findByIdAndDelete(categoryId);
          
          // Verify it's deleted
          const exists = await Category.findById(categoryId);
          expect(exists).toBeNull();
          
          // Attempt to delete the already deleted category
          const response = await request(app)
            .delete(`/api/categories/${categoryId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          
          // Should return 404
          expect(response.status).toBe(404);
          expect(response.body.message).toBe('Category not found');
        }
      ),
      { numRuns: 100 }
    );
  });
});
