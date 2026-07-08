import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import connectDB from '../config/database.js';
import userRoutes from './users.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
process.env.JWT_SECRET = JWT_SECRET;

async function runTests() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for user routes testing.');

    // Find seeded Owner, Management, and Customer
    const ownerUser = await User.findOne({ email: 'admin@foodhub.com' });
    const managementUser = await User.findOne({ email: 'companyadmin@foodhub.com' });
    const customerUser = await User.findOne({ email: 'employee@foodhub.com' });

    if (!ownerUser || !managementUser || !customerUser) {
      throw new Error('Seed users not found. Make sure to run node scripts/seedUsers.js first.');
    }

    // Set Management user's organization to ensure scope testing
    managementUser.organization = 'TestCorp';
    await managementUser.save();

    const ownerToken = jwt.sign({ userId: ownerUser._id }, JWT_SECRET, { expiresIn: '1h' });
    const managementToken = jwt.sign({ userId: managementUser._id }, JWT_SECRET, { expiresIn: '1h' });
    const customerToken = jwt.sign({ userId: customerUser._id }, JWT_SECRET, { expiresIn: '1h' });

    // Helper to generate a unique email
    const uniqueEmail = () => `rep-${Date.now()}@test.com`;

    console.log('\n--- Test 1: Get all users as Owner ---');
    let res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${ownerToken}`);
    console.log(`Status: ${res.status}`);
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Expected 200 OK and array of users, got status ${res.status}`);
    }
    console.log(`✓ Owner successfully retrieved ${res.body.length} users.`);

    console.log('\n--- Test 2: Get all users as Customer (should be forbidden) ---');
    res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${customerToken}`);
    console.log(`Status: ${res.status}`);
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    }
    console.log('✓ Customer correctly forbidden from listing users.');

    console.log('\n--- Test 3: Management creates an Outlet Sales Representative ---');
    const emailRep = uniqueEmail();
    res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managementToken}`)
      .send({
        name: 'Mock Sales Rep',
        email: emailRep,
        phone: '1111111111',
        password: 'password123',
        role: 'Outlet Sales Representative',
        organization: 'TestCorp'
      });
    console.log(`Status: ${res.status}`);
    if (res.status !== 201) {
      console.error(res.body);
      throw new Error(`Expected 201 Created, got ${res.status}`);
    }
    console.log('✓ Management successfully created Outlet Sales Representative.');
    const createdRepId = res.body._id;

    console.log('\n--- Test 4: Management tries to create an Owner user (should be forbidden) ---');
    res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managementToken}`)
      .send({
        name: 'Illegal Owner',
        email: uniqueEmail(),
        phone: '1111111111',
        password: 'password123',
        role: 'Owner',
        organization: 'TestCorp'
      });
    console.log(`Status: ${res.status}`);
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    }
    console.log('✓ Management correctly forbidden from creating an Owner user.');

    // Cleanup
    if (createdRepId) {
      await User.findByIdAndDelete(createdRepId);
      console.log('\nCleaned up created test user.');
    }

    console.log('\n✓ Checkpoint 5 integration tests PASSED successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Integration tests FAILED:', error);
    process.exit(1);
  }
}

runTests();
