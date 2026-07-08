import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Outlet from '../models/Outlet.js';
import connectDB from '../config/database.js';
import menuRoutes from './menuItems.js';
import inventoryRoutes from './inventory.js';
import ledgerRoutes from './ledger.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/menu-items', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/ledger', ledgerRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

async function runTests() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for operational routes testing.');

    // Fetch seeded users
    const owner = await User.findOne({ email: 'admin@foodhub.com' });
    const management = await User.findOne({ email: 'companyadmin@foodhub.com' });
    const ckm = await User.findOne({ email: 'ckm@foodhub.com' });
    const salesRep = await User.findOne({ email: 'staff@foodhub.com' });
    const customer = await User.findOne({ email: 'employee@foodhub.com' });

    if (!owner || !management || !ckm || !salesRep || !customer) {
      throw new Error('Seed users not found. Make sure to run node scripts/seedUsers.js first.');
    }

    const ownerToken = jwt.sign({ userId: owner._id }, JWT_SECRET, { expiresIn: '1h' });
    const ckmToken = jwt.sign({ userId: ckm._id }, JWT_SECRET, { expiresIn: '1h' });
    const salesRepToken = jwt.sign({ userId: salesRep._id }, JWT_SECRET, { expiresIn: '1h' });
    const customerToken = jwt.sign({ userId: customer._id }, JWT_SECRET, { expiresIn: '1h' });

    console.log('\n--- Test 1: Customer creates menu item (should be forbidden) ---');
    let res = await request(app)
      .post('/api/menu-items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Illegal Burger', basePrice: 100 });
    console.log(`Status: ${res.status}`);
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    }
    console.log('✓ Customer correctly forbidden from creating menu items.');

    console.log('\n--- Test 2: Outlet Sales Rep creates menu item (should be allowed, validation/missing fields return 400, NOT 403) ---');
    res = await request(app)
      .post('/api/menu-items')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ name: 'Valid Fries', basePrice: 50 });
    console.log(`Status: ${res.status}`);
    // Should be 400 (due to validation errors/missing fields like category) but NOT 403 (access denied)
    if (res.status === 403) {
      throw new Error('Expected 400 Bad Request or 201 Created, got 403 Forbidden');
    }
    console.log('✓ Outlet Sales Rep is authorized to create menu items.');

    console.log('\n--- Test 3: Customer dispatches ledger (should be forbidden) ---');
    res = await request(app)
      .post('/api/ledger/dispatch')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});
    console.log(`Status: ${res.status}`);
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    }
    console.log('✓ Customer correctly forbidden from dispatching ledgers.');

    console.log('\n--- Test 4: Central Kitchen Manager dispatches ledger (should be allowed, missing fields return 400, NOT 403) ---');
    res = await request(app)
      .post('/api/ledger/dispatch')
      .set('Authorization', `Bearer ${ckmToken}`)
      .send({});
    console.log(`Status: ${res.status}`);
    if (res.status === 403) {
      throw new Error('Expected 400 Bad Request or 200 OK, got 403 Forbidden');
    }
    console.log('✓ Central Kitchen Manager is authorized to dispatch ledgers.');

    console.log('\n--- Test 5: Customer deletes inventory item (should be forbidden) ---');
    res = await request(app)
      .delete('/api/inventory/123456789012345678901234')
      .set('Authorization', `Bearer ${customerToken}`);
    console.log(`Status: ${res.status}`);
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    }
    console.log('✓ Customer correctly forbidden from deleting inventory.');

    console.log('\n✓ Checkpoint 6 integration tests PASSED successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Integration tests FAILED:', error);
    process.exit(1);
  }
}

runTests();
