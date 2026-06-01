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
 * Property 5: Authorization enforcement for category management
 * 
 * For any category management operation (create, update, delete), when the request is made
 * by a user without the "Admin" role, the system should reject the request with a 403 Forbidden
 * status code. When the request lacks authentication credentials, the system should return a
 * 401 Unauthorized status code.
 * 
 * Validates: Requirements 2.5, 4.4, 5.4, 11.1, 11.2, 11.3
 */
describe('Feature: category-management, Property 5: Authorization enforcement for category management', () => {
  let mongoServer;
  let app;
  
  // JWT secret for testing
  const JWT_SECRET = 'test-secret-key';
  process.env.JWT_SECRET = JWT_SECRET;

  beforeAll(async () => {
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'category-auth-test' });
    
    // Set up Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/categories', categoryRoutes);
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
    await User.deleteMany({});
  });

  // Helper function to create a user and generate token
  const createUserAndToken = async (role) => {
    const user = await User.create({
      name: 'Test User',
      email: `test-${role.toLowerCase().replace(' ', '-')}-${Date.now()}@example.com`,
      phone: '1234567890',
      role: role,
      password: 'password123',
      status: 'Active'
    });
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    return { user, token };
  };

  // Generator for non-admin roles
  const nonAdminRoleArb = fc.constantFrom(
    'Company Admin',
    'Staff',
    'Delivery Staff',
    'Vendor',
    'Employee'
  );

  it('should reject POST /api/categories without authentication token (401)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const response = await request(app)
            .post('/api/categories')
            .send({ name: categoryName.trim() });
          
          expect(response.status).toBe(401);
          expect(response.body.message).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject POST /api/categories with non-admin role (403)', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAdminRoleArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (role, categoryName) => {
          const { token } = await createUserAndToken(role);
          
          const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: categoryName.trim() });
          
          expect(response.status).toBe(403);
          expect(response.body.message).toContain('Access denied');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow POST /api/categories with admin role (201 or 400)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const { token } = await createUserAndToken('Admin');
          
          const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: categoryName.trim() });
          
          // Should either succeed (201) or fail with validation error (400), but not auth error
          expect([201, 400]).toContain(response.status);
          if (response.status === 403 || response.status === 401) {
            throw new Error('Admin should not receive auth errors');
          }
          
          // Cleanup if created
          if (response.status === 201) {
            await Category.deleteOne({ _id: response.body._id });
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject PUT /api/categories/:id without authentication token (401)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (originalName, newName) => {
          // Create a category first (directly in DB)
          const category = await Category.create({ name: originalName.trim() });
          
          const response = await request(app)
            .put(`/api/categories/${category._id}`)
            .send({ name: newName.trim() });
          
          expect(response.status).toBe(401);
          expect(response.body.message).toBeDefined();
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject PUT /api/categories/:id with non-admin role (403)', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAdminRoleArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (role, originalName, newName) => {
          const { token } = await createUserAndToken(role);
          
          // Create a category first (directly in DB)
          const category = await Category.create({ name: originalName.trim() });
          
          const response = await request(app)
            .put(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: newName.trim() });
          
          expect(response.status).toBe(403);
          expect(response.body.message).toContain('Access denied');
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow PUT /api/categories/:id with admin role (200, 400, or 404)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (originalName, newName) => {
          const { token } = await createUserAndToken('Admin');
          
          // Create a category first (directly in DB)
          const category = await Category.create({ name: originalName.trim() });
          
          const response = await request(app)
            .put(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: newName.trim() });
          
          // Should either succeed (200), fail with validation (400), or not found (404)
          // but not auth error
          expect([200, 400, 404]).toContain(response.status);
          if (response.status === 403 || response.status === 401) {
            throw new Error('Admin should not receive auth errors');
          }
          
          // Cleanup
          await Category.deleteMany({ name: { $in: [originalName.trim(), newName.trim()] } });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject DELETE /api/categories/:id without authentication token (401)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          // Create a category first (directly in DB)
          const category = await Category.create({ name: categoryName.trim() });
          
          const response = await request(app)
            .delete(`/api/categories/${category._id}`);
          
          expect(response.status).toBe(401);
          expect(response.body.message).toBeDefined();
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject DELETE /api/categories/:id with non-admin role (403)', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAdminRoleArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (role, categoryName) => {
          const { token } = await createUserAndToken(role);
          
          // Create a category first (directly in DB)
          const category = await Category.create({ name: categoryName.trim() });
          
          const response = await request(app)
            .delete(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${token}`);
          
          expect(response.status).toBe(403);
          expect(response.body.message).toContain('Access denied');
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow DELETE /api/categories/:id with admin role (200, 400, or 404)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (categoryName) => {
          const { token } = await createUserAndToken('Admin');
          
          // Create a category first (directly in DB)
          const category = await Category.create({ name: categoryName.trim() });
          
          const response = await request(app)
            .delete(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${token}`);
          
          // Should either succeed (200), fail with validation (400), or not found (404)
          // but not auth error
          expect([200, 400, 404]).toContain(response.status);
          if (response.status === 403 || response.status === 401) {
            throw new Error('Admin should not receive auth errors');
          }
          
          // Cleanup (if not already deleted)
          await Category.deleteMany({ name: categoryName.trim() });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow GET /api/categories with any authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Admin', 'Company Admin', 'Staff', 'Delivery Staff', 'Vendor', 'Employee'),
        async (role) => {
          const { token } = await createUserAndToken(role);
          
          const response = await request(app)
            .get('/api/categories')
            .set('Authorization', `Bearer ${token}`);
          
          // Any authenticated user should be able to list categories
          expect(response.status).toBe(200);
          expect(Array.isArray(response.body)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject GET /api/categories without authentication token (401)', async () => {
    const response = await request(app)
      .get('/api/categories');
    
    expect(response.status).toBe(401);
    expect(response.body.message).toBeDefined();
  });

  it('should enforce authorization consistently across all admin-only operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAdminRoleArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (role, categoryName) => {
          const { token } = await createUserAndToken(role);
          
          // Create a category for update/delete tests
          const category = await Category.create({ name: categoryName.trim() });
          
          // Test all admin-only operations
          const postResponse = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: `${categoryName.trim()}-new` });
          
          const putResponse = await request(app)
            .put(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: `${categoryName.trim()}-updated` });
          
          const deleteResponse = await request(app)
            .delete(`/api/categories/${category._id}`)
            .set('Authorization', `Bearer ${token}`);
          
          // All should return 403 for non-admin users
          expect(postResponse.status).toBe(403);
          expect(putResponse.status).toBe(403);
          expect(deleteResponse.status).toBe(403);
          
          // Cleanup
          await Category.deleteOne({ _id: category._id });
        }
      ),
      { numRuns: 50 }
    );
  });
});
