import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import User from '../models/User.js';
import Outlet from '../models/Outlet.js';
import categoryRoutes from '../routes/categories.js';

/**
 * Integration Tests: Dynamic Category Management
 *
 * Tests the complete category lifecycle, authorization flows, and error scenarios
 * across the full API stack.
 *
 * Validates: All requirements
 */

const JWT_SECRET = 'integration-test-secret';
process.env.JWT_SECRET = JWT_SECRET;

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoryRoutes);
  return app;
};

const createUser = async (role) => {
  const user = await User.create({
    name: `${role} User`,
    email: `${role.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@test.com`,
    phone: '9999999999',
    role,
    password: 'password123',
    status: 'Active',
  });
  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
};

const createOutlet = async () =>
  Outlet.create({
    name: 'Test Outlet',
    outletId: `outlet-${Date.now()}`,
    fssaiLicense: 'FSSAI123456',
    businessType: 'Restaurant',
    contact: { name: 'Owner', email: 'owner@test.com', phone: '9999999999' },
    location: { address: '123 Main St', state: 'MH', city: 'Mumbai', zone: 'North Zone' },
  });

const createMenuItem = async (categoryId, outletId) =>
  MenuItem.create({
    name: `Item-${Date.now()}`,
    category: categoryId,
    foodType: 'Veg',
    basePrice: 100,
    vendor: outletId,
  });

// ─── Suite Setup ─────────────────────────────────────────────────────────────

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'category-integration-test' });
  app = makeApp();
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Category.deleteMany({});
  await MenuItem.deleteMany({});
  await User.deleteMany({});
  await Outlet.deleteMany({});
});

// ─── 1. Complete Category Lifecycle ──────────────────────────────────────────

describe('Category lifecycle: create → use in menu item → update → delete', () => {
  it('should complete the full lifecycle successfully', async () => {
    const { token } = await createUser('Admin');
    const outlet = await createOutlet();

    // 1. Create category
    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Starters', description: 'Appetizers and starters' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Starters');
    const categoryId = createRes.body._id;

    // 2. Use category in a menu item
    const menuItem = await createMenuItem(categoryId, outlet._id);
    expect(menuItem.category.toString()).toBe(categoryId);

    // 3. Verify category list shows correct menu item count
    const listRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const cat = listRes.body.find((c) => c._id === categoryId);
    expect(cat).toBeDefined();
    expect(cat.menuItemCount).toBe(1);

    // 4. Update category name
    const updateRes = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Appetizers', description: 'Updated description' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Appetizers');

    // 5. Attempt to delete category with menu item — must fail
    const deleteBlockedRes = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteBlockedRes.status).toBe(400);
    expect(deleteBlockedRes.body.menuItemCount).toBe(1);

    // 6. Remove menu item, then delete category
    await MenuItem.findByIdAndDelete(menuItem._id);

    const deleteRes = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);

    // 7. Verify category is gone
    const getRes = await request(app)
      .get(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });

  it('should reflect updated category name in subsequent GET requests', async () => {
    const { token } = await createUser('Admin');

    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'OldName' });

    expect(createRes.status).toBe(201);
    const id = createRes.body._id;

    await request(app)
      .put(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'NewName' });

    const getRes = await request(app)
      .get(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('NewName');
  });
});

// ─── 2. Authorization Flow ────────────────────────────────────────────────────

describe('Authorization flow: admin vs non-admin', () => {
  const nonAdminRoles = ['Company Admin', 'Staff', 'Delivery Staff', 'Vendor', 'Employee'];

  it('should allow admin to perform all CRUD operations', async () => {
    const { token } = await createUser('Admin');

    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'AdminCategory' });
    expect(createRes.status).toBe(201);
    const id = createRes.body._id;

    const updateRes = await request(app)
      .put(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'AdminCategoryUpdated' });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
  });

  it.each(nonAdminRoles)(
    'should block %s from creating, updating, or deleting categories',
    async (role) => {
      const { token } = await createUser(role);
      const category = await Category.create({ name: `Cat-${role}-${Date.now()}` });

      const postRes = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ShouldFail' });
      expect(postRes.status).toBe(403);

      const putRes = await request(app)
        .put(`/api/categories/${category._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ShouldFail' });
      expect(putRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/categories/${category._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(403);
    }
  );

  it.each(['Admin', ...nonAdminRoles])(
    'should allow %s to read categories',
    async (role) => {
      const { token } = await createUser(role);

      const listRes = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
    }
  );

  it('should return 401 for unauthenticated requests to write endpoints', async () => {
    const category = await Category.create({ name: 'AuthTestCat' });

    expect((await request(app).post('/api/categories').send({ name: 'X' })).status).toBe(401);
    expect((await request(app).put(`/api/categories/${category._id}`).send({ name: 'X' })).status).toBe(401);
    expect((await request(app).delete(`/api/categories/${category._id}`)).status).toBe(401);
    expect((await request(app).get('/api/categories')).status).toBe(401);
  });
});

// ─── 3. Error Scenarios ───────────────────────────────────────────────────────

describe('Error scenarios', () => {
  it('should reject duplicate category names (case-insensitive check via API)', async () => {
    const { token } = await createUser('Admin');

    const first = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Beverages' });
    expect(first.status).toBe(201);

    // Exact duplicate
    const dup = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Beverages' });
    expect(dup.status).toBe(400);
    expect(dup.body.message).toMatch(/already exists/i);

    // Case-insensitive duplicate
    const dupUpper = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'BEVERAGES' });
    expect(dupUpper.status).toBe(400);
  });

  it('should reject update that causes a name collision with another category', async () => {
    const { token } = await createUser('Admin');

    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Desserts' });

    const second = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Drinks' });
    expect(second.status).toBe(201);

    const updateRes = await request(app)
      .put(`/api/categories/${second.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Desserts' });
    expect(updateRes.status).toBe(400);
    expect(updateRes.body.message).toMatch(/already exists/i);
  });

  it('should return 404 for operations on non-existent category IDs', async () => {
    const { token } = await createUser('Admin');
    const fakeId = new mongoose.Types.ObjectId().toString();

    expect((await request(app).get(`/api/categories/${fakeId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).put(`/api/categories/${fakeId}`).set('Authorization', `Bearer ${token}`).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/categories/${fakeId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('should return 404 for malformed (invalid ObjectId) category IDs', async () => {
    const { token } = await createUser('Admin');
    const badId = 'not-a-valid-id';

    expect((await request(app).get(`/api/categories/${badId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).put(`/api/categories/${badId}`).set('Authorization', `Bearer ${token}`).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/categories/${badId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('should prevent deletion of a category that has associated menu items', async () => {
    const { token } = await createUser('Admin');
    const outlet = await createOutlet();

    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MainCourse' });
    expect(createRes.status).toBe(201);
    const categoryId = createRes.body._id;

    // Attach two menu items
    await createMenuItem(categoryId, outlet._id);
    await createMenuItem(categoryId, outlet._id);

    const deleteRes = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.menuItemCount).toBe(2);
    expect(deleteRes.body.message).toMatch(/2/);

    // Category must still exist
    const getRes = await request(app)
      .get(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
  });

  it('should reject empty or whitespace-only category names', async () => {
    const { token } = await createUser('Admin');

    const emptyRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(emptyRes.status).toBe(400);

    const whitespaceRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });
    expect(whitespaceRes.status).toBe(400);
  });

  it('should reject category names exceeding 50 characters', async () => {
    const { token } = await createUser('Admin');
    const longName = 'A'.repeat(51);

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: longName });
    expect(res.status).toBe(400);
  });

  it('should reject descriptions exceeding 200 characters', async () => {
    const { token } = await createUser('Admin');
    const longDesc = 'D'.repeat(201);

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ValidName', description: longDesc });
    expect(res.status).toBe(400);
  });
});

// ─── 4. Category List & Ordering ─────────────────────────────────────────────

describe('Category list retrieval and ordering', () => {
  it('should return categories sorted alphabetically by name', async () => {
    const { token } = await createUser('Admin');

    for (const name of ['Zebra', 'Apple', 'Mango']) {
      await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name });
    }

    const listRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const names = listRes.body.map((c) => c.name);
    expect(names).toEqual([...names].sort());
  });

  it('should include menuItemCount in list response', async () => {
    const { token } = await createUser('Admin');
    const outlet = await createOutlet();

    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CountTest' });
    const categoryId = createRes.body._id;

    await createMenuItem(categoryId, outlet._id);
    await createMenuItem(categoryId, outlet._id);
    await createMenuItem(categoryId, outlet._id);

    const listRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);

    const cat = listRes.body.find((c) => c._id === categoryId);
    expect(cat.menuItemCount).toBe(3);
  });
});
