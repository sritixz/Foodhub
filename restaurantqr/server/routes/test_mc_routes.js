import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import MakerCheckerRequest from '../models/MakerCheckerRequest.js';
import connectDB from '../config/database.js';
import makerCheckerRoutes from './makerCheckerRoutes.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/maker-checker', makerCheckerRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

async function runTests() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for Maker-Checker endpoints testing.');

    // Fetch seeded users
    const owner = await User.findOne({ email: 'admin@foodhub.com' });
    const management = await User.findOne({ email: 'companyadmin@foodhub.com' });
    const salesRep = await User.findOne({ email: 'staff@foodhub.com' });

    if (!owner || !management || !salesRep) {
      throw new Error('Seed users not found. Run node scripts/seedUsers.js first.');
    }

    const managementToken = jwt.sign({ userId: management._id }, JWT_SECRET, { expiresIn: '1h' });

    // Clean any prior leftovers
    await User.deleteMany({ email: /@mockmcroutes\.com$/ });

    // 1. Create a pending CREATE_USER request
    const uniqueEmail = `test-${Date.now()}@mockmcroutes.com`;
    console.log(`Creating pending CREATE_USER request for email: ${uniqueEmail}`);
    const pendingRequest = await MakerCheckerRequest.create({
      actionType: 'CREATE_USER',
      targetModel: 'User',
      targetId: null,
      proposedData: {
        body: {
          name: 'Approve Test User',
          email: uniqueEmail,
          phone: '9999999999',
          password: 'password123',
          role: 'Customer',
          status: 'Active',
        }
      },
      maker: salesRep._id,
      status: 'Pending',
    });

    // 2. Retrieve pending requests as Management
    console.log('\n--- Test 1: List pending requests as Management ---');
    let res = await request(app)
      .get('/api/maker-checker/pending')
      .set('Authorization', `Bearer ${managementToken}`);
    
    console.log(`Status: ${res.status}`);
    if (res.status !== 200 || !Array.isArray(res.body)) {
      throw new Error(`Expected list of pending requests, got status ${res.status}`);
    }
    const found = res.body.some(r => r._id.toString() === pendingRequest._id.toString());
    if (!found) {
      throw new Error('The created pending request was not found in the pending list');
    }
    console.log('✓ Successfully retrieved request in the pending list.');

    // 3. Approve request as Management
    console.log('\n--- Test 2: Approve pending request as Management ---');
    res = await request(app)
      .post(`/api/maker-checker/${pendingRequest._id}/approve`)
      .set('Authorization', `Bearer ${managementToken}`)
      .send({ comments: 'Approved by Management' });
    
    console.log(`Status: ${res.status}`);
    if (res.status !== 200) {
      console.error(res.body);
      throw new Error(`Expected 200 OK approval, got status ${res.status}`);
    }
    console.log('✓ Request approved successfully.');

    // 4. Verify user was actually created in DB
    const createdUser = await User.findOne({ email: uniqueEmail });
    if (!createdUser) {
      throw new Error('User was not created in the database upon approval');
    }
    console.log(`✓ Verified user ${createdUser.name} successfully exists in DB.`);

    // 5. Reject a new request
    console.log('\n--- Test 3: Reject pending request as Management ---');
    const rejectEmail = `reject-${Date.now()}@mockmcroutes.com`;
    const rejectRequest = await MakerCheckerRequest.create({
      actionType: 'CREATE_USER',
      targetModel: 'User',
      targetId: null,
      proposedData: {
        body: {
          name: 'Reject Test User',
          email: rejectEmail,
          phone: '9999999999',
          password: 'password123',
          role: 'Customer',
          status: 'Active',
        }
      },
      maker: salesRep._id,
      status: 'Pending',
    });

    res = await request(app)
      .post(`/api/maker-checker/${rejectRequest._id}/reject`)
      .set('Authorization', `Bearer ${managementToken}`)
      .send({ comments: 'Rejected due to duplicate' });

    console.log(`Status: ${res.status}`);
    if (res.status !== 200) {
      throw new Error(`Expected 200 OK rejection, got status ${res.status}`);
    }

    const checkRejected = await MakerCheckerRequest.findById(rejectRequest._id);
    if (checkRejected.status !== 'Rejected') {
      throw new Error(`Expected status to be Rejected, got ${checkRejected.status}`);
    }

    // Verify user was NOT created in DB
    const notCreatedUser = await User.findOne({ email: rejectEmail });
    if (notCreatedUser) {
      throw new Error('User was incorrectly created in DB even though request was rejected');
    }
    console.log('✓ Verified user was NOT created in DB and request status is "Rejected".');

    // Clean up
    await User.deleteMany({ email: /@mockmcroutes\.com$/ });
    await MakerCheckerRequest.findByIdAndDelete(pendingRequest._id);
    await MakerCheckerRequest.findByIdAndDelete(rejectRequest._id);
    console.log('\n✓ Cleaned up test database records.');

    console.log('✓ Checkpoint 9 endpoints integration tests PASSED successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Integration tests FAILED:', error);
    process.exit(1);
  }
}

runTests();
