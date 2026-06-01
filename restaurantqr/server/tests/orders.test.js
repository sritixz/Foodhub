import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import Order from '../models/Order.js';
import Outlet from '../models/Outlet.js';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import orderRoutes from '../routes/orders.js';

// Create test app (similar to server.js but without DB connection)
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/orders', orderRoutes);

describe('Order API Tests', () => {
  jest.setTimeout(30000);
  let authToken;
  let vendorToken;
  let testOutlet;
  let testMenuItem;
  let testCategory;
  let testUser;
  let testVendor;
  let mongoServer;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    // Start in-memory MongoDB server for tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { dbName: 'foodhub-test' });
  });

  afterAll(async () => {
    // Clean up test data
    await Order.deleteMany({});
    await Outlet.deleteMany({});
    await MenuItem.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      Order.deleteMany({}),
      Outlet.deleteMany({}),
      MenuItem.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
    ]);

    // Create test category
    testCategory = await Category.create({
      name: 'Main Course',
      description: 'Main course items',
    });

    // Create test outlet
    testOutlet = await Outlet.create({
      name: 'Test Restaurant',
      outletId: `TEST${Date.now()}`,
      businessType: 'Dine-In',
      fssaiLicense: 'TEST123',
      contact: {
        name: 'Test Owner',
        email: 'owner@test.com',
        phone: '1234567890',
      },
      location: {
        address: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zone: 'North Zone',
      },
    });

    // Create test menu item
    testMenuItem = await MenuItem.create({
      name: 'Test Burger',
      category: testCategory._id,
      description: 'A test burger',
      foodType: 'Non-Veg',
      status: 'Available',
      basePrice: 150,
      vendor: testOutlet._id,
    });

    // Create test admin user
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      phone: '9999999999',
      password: hashedPassword,
      role: 'Admin',
      status: 'Active',
    });

    // Create test vendor user
    testVendor = await User.create({
      name: 'Test Vendor',
      email: 'vendor@test.com',
      phone: '8888888888',
      password: hashedPassword,
      role: 'Vendor',
      status: 'Active',
      outlet: testOutlet._id,
    });

    // Generate tokens
    authToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET || 'test-secret');
    vendorToken = jwt.sign({ userId: testVendor._id }, process.env.JWT_SECRET || 'test-secret');
  });

  describe('POST /api/orders', () => {
    it('should create a regular order with authentication', async () => {
      const orderData = {
        vendor: testOutlet._id.toString(),
        items: [
          {
            menuItem: testMenuItem._id.toString(),
            quantity: 2,
            price: 150,
          },
        ],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        deliveryAddress: '123 Test Street',
        customer: {
          name: 'Test Customer',
          email: 'customer@test.com',
          phone: '9876543210',
        },
        amount: 300,
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.orderId).toMatch(/^ORD-\d{4}\d{4}$/);
      expect(response.body.status).toBe('New');
      expect(response.body.amount).toBe(300);
      expect(response.body.items).toHaveLength(1);
    });

    it('should create a QR order without authentication', async () => {
      const orderData = {
        vendor: testOutlet._id.toString(),
        items: [
          {
            menuItem: testMenuItem._id.toString(),
            quantity: 1,
            price: 150,
          },
        ],
        orderType: 'QR',
        deliveryMode: 'Dine-in',
        customer: {
          name: 'Guest',
          email: null,
          phone: null,
        },
        amount: 150,
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.orderType).toBe('QR');
      expect(response.body.status).toBe('New');
    });

    it('should reject order creation without required fields', async () => {
      const orderData = {
        vendor: testOutlet._id.toString(),
        items: [],
        orderType: 'Retail',
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication for non-QR orders', async () => {
      const orderData = {
        vendor: testOutlet._id.toString(),
        items: [
          {
            menuItem: testMenuItem._id.toString(),
            quantity: 1,
            price: 150,
          },
        ],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        customer: {
          name: 'Test Customer',
        },
        amount: 150,
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      // Create test orders
      await Order.create({
        orderId: 'ORD-20240001',
        vendor: testOutlet._id,
        items: [{ menuItem: testMenuItem._id, quantity: 1, price: 150 }],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        customer: { name: 'Customer 1' },
        amount: 150,
        status: 'New',
      });

      await Order.create({
        orderId: 'ORD-20240002',
        vendor: testOutlet._id,
        items: [{ menuItem: testMenuItem._id, quantity: 2, price: 150 }],
        orderType: 'QR',
        deliveryMode: 'Dine-in',
        customer: { name: 'Customer 2' },
        amount: 300,
        status: 'Preparing',
      });
    });

    it('should get all orders with authentication', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=New')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.forEach(order => {
        expect(order.status).toBe('New');
      });
    });

    it('should filter orders by orderType', async () => {
      const response = await request(app)
        .get('/api/orders?orderType=QR')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.forEach(order => {
        expect(order.orderType).toBe('QR');
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/orders')
        .expect(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        orderId: 'ORD-20240003',
        vendor: testOutlet._id,
        items: [{ menuItem: testMenuItem._id, quantity: 1, price: 150 }],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        customer: { name: 'Test Customer' },
        amount: 150,
        status: 'New',
      });
    });

    it('should get single order by ID', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body._id).toBe(testOrder._id.toString());
      expect(response.body.orderId).toBe('ORD-20240003');
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/orders/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        orderId: 'ORD-20240004',
        vendor: testOutlet._id,
        items: [{ menuItem: testMenuItem._id, quantity: 1, price: 150 }],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        customer: { name: 'Test Customer' },
        amount: 150,
        status: 'New',
      });
    });

    it('should update order status', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'Preparing' })
        .expect(200);

      expect(response.body.status).toBe('Preparing');
    });

    it('should reject invalid status', async () => {
      await request(app)
        .patch(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'InvalidStatus' })
        .expect(400);
    });
  });

  describe('PATCH /api/orders/:id/cancel', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        orderId: 'ORD-20240005',
        vendor: testOutlet._id,
        items: [{ menuItem: testMenuItem._id, quantity: 1, price: 150 }],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        customer: { name: 'Test Customer', email: 'customer@test.com' },
        amount: 150,
        status: 'New',
      });
    });

    it('should cancel order by customer', async () => {
      // Create customer user with matching email
      const customerUser = await User.create({
        name: 'Test Customer',
        email: 'customer@test.com',
        phone: '7777777777',
        password: await bcrypt.hash('password123', 10),
        role: 'Employee',
        status: 'Active',
      });

      const customerToken = jwt.sign({ userId: customerUser._id }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .patch(`/api/orders/${testOrder._id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.status).toBe('Cancelled');
    });

    it('should cancel order by vendor', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrder._id}/cancel`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.status).toBe('Cancelled');
    });

    it('should not allow cancelling delivered order', async () => {
      testOrder.status = 'Delivered';
      await testOrder.save();

      await request(app)
        .patch(`/api/orders/${testOrder._id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/orders/:id/accept', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        orderId: 'ORD-20240006',
        vendor: testOutlet._id,
        items: [{ menuItem: testMenuItem._id, quantity: 1, price: 150 }],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        customer: { name: 'Test Customer' },
        amount: 150,
        status: 'New',
      });
    });

    it('should accept order by vendor', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrder._id}/accept`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.status).toBe('Preparing');
    });

    it('should not allow accepting order in wrong status', async () => {
      testOrder.status = 'Preparing';
      await testOrder.save();

      await request(app)
        .patch(`/api/orders/${testOrder._id}/accept`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/orders/:id/reject', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        orderId: 'ORD-20240007',
        vendor: testOutlet._id,
        items: [{ menuItem: testMenuItem._id, quantity: 1, price: 150 }],
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        customer: { name: 'Test Customer' },
        amount: 150,
        status: 'New',
      });
    });

    it('should reject order by vendor', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrder._id}/reject`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.status).toBe('Cancelled');
    });
  });

  describe('GET /api/orders/stream', () => {
    it('should establish SSE connection', async () => {
      const response = await request(app)
        .get('/api/orders/stream')
        .buffer(false)
        .parse((res, cb) => {
          res.on('data', () => {
            res.destroy();
            cb(null, res);
          });
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });
});
