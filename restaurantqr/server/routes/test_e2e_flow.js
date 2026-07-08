import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Outlet from '../models/Outlet.js';
import Inventory from '../models/Inventory.js';
import MakerCheckerRequest from '../models/MakerCheckerRequest.js';
import connectDB from '../config/database.js';

// Import routers and middleware to construct the app
import inventoryRoutes from './inventory.js';
import makerCheckerRoutes from './makerCheckerRoutes.js';
import makerChecker from '../middleware/makerChecker.js';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleAuth.js';

dotenv.config();

const app = express();
app.use(express.json());

// Set up routes with the MakerChecker interceptor middleware integrated exactly as planned!
// In inventory, PATCH /:id/quantity requires MakerChecker interception:
app.use('/api/inventory', inventoryRoutes);

// Also register the Maker-Checker management routes:
app.use('/api/maker-checker', makerCheckerRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

async function runE2E() {
  let mockItem = null;
  let mcRequest = null;
  try {
    await connectDB();
    console.log('Connected to MongoDB for E2E Flow validation.');

    // Fetch seeded users
    const owner = await User.findOne({ email: 'admin@foodhub.com' });
    const salesRep = await User.findOne({ email: 'staff@foodhub.com' });
    const defaultOutlet = await Outlet.findOne();

    if (!owner || !salesRep || !defaultOutlet) {
      throw new Error('Required seeded data not found. Run node scripts/seedUsers.js first.');
    }

    const ownerToken = jwt.sign({ userId: owner._id }, JWT_SECRET, { expiresIn: '1h' });
    const salesRepToken = jwt.sign({ userId: salesRep._id }, JWT_SECRET, { expiresIn: '1h' });

    // Create a mock inventory item
    console.log('Creating mock inventory item...');
    mockItem = await Inventory.create({
      name: 'E2E Test Flour',
      sku: `FLOUR-${Date.now()}`,
      quantity: 10,
      threshold: 5,
      branch: defaultOutlet._id,
      category: 'Ingredients',
    });
    console.log(`Mock item created: ${mockItem.name}, initial qty: ${mockItem.quantity}`);

    // Integrate the Maker-Checker interceptor on the quantity adjust route temporarily for this test
    // PATCH /api/inventory/:id/quantity
    app.patch('/api/inventory/:id/quantity', authenticate, authorize('Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative'), makerChecker('ADJUST_INVENTORY_QUANTITY', 'Inventory'), async (req, res) => {
      // This is a mockup of what the router would execute upon next()
      res.json({ message: 'Success' });
    });

    // 1. Sales Rep adjusts inventory quantity (should be intercepted)
    console.log('\n--- Step 1: Outlet Sales Rep adjusts inventory quantity ---');
    let res = await request(app)
      .patch(`/api/inventory/${mockItem._id}/quantity`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ quantity: 5, operation: 'add' });

    console.log(`Status: ${res.status}`);
    if (res.status !== 202) {
      console.error(res.body);
      throw new Error(`Expected 202 Intercepted, got status ${res.status}`);
    }
    const requestId = res.body.requestId;
    console.log(`✓ Request intercepted successfully. Request ID: ${requestId}`);

    // 2. Verify inventory was NOT updated in DB
    console.log('\n--- Step 2: Verify inventory is unchanged ---');
    let dbItem = await Inventory.findById(mockItem._id);
    console.log(`Inventory Qty in DB: ${dbItem.quantity} (Expected: 10)`);
    if (dbItem.quantity !== 10) {
      throw new Error(`Inventory was prematurely updated! Quantity is ${dbItem.quantity}`);
    }
    console.log('✓ Verified inventory quantity remains unchanged.');

    // 3. Owner approves request
    console.log('\n--- Step 3: Owner approves request ---');
    res = await request(app)
      .post(`/api/maker-checker/${requestId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ comments: 'Looks good, approving.' });

    console.log(`Status: ${res.status}`);
    if (res.status !== 200) {
      console.error(res.body);
      throw new Error(`Expected 200 OK approval, got status ${res.status}`);
    }
    console.log('✓ Request approved successfully.');

    // 4. Verify inventory WAS updated in DB
    console.log('\n--- Step 4: Verify inventory quantity is updated ---');
    dbItem = await Inventory.findById(mockItem._id);
    console.log(`Inventory Qty in DB: ${dbItem.quantity} (Expected: 15)`);
    if (dbItem.quantity !== 15) {
      throw new Error(`Inventory was not updated upon approval! Quantity is ${dbItem.quantity}`);
    }
    console.log('✓ Verified inventory quantity is now updated to 15!');

    // Cleanup
    await Inventory.findByIdAndDelete(mockItem._id);
    await MakerCheckerRequest.findByIdAndDelete(requestId);
    console.log('\n✓ Cleaned up test database records.');

    console.log('✓ E2E Flow validation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Flow validation FAILED:', error);
    // Cleanup on failure
    if (mockItem) await Inventory.findByIdAndDelete(mockItem._id);
    if (mcRequest) await MakerCheckerRequest.findByIdAndDelete(mcRequest._id);
    process.exit(1);
  }
}

runE2E();
