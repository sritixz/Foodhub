import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import User from '../models/User.js';
import MakerCheckerRequest from '../models/MakerCheckerRequest.js';
import makerChecker from '../middleware/makerChecker.js';

dotenv.config();

function mockRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
}

async function runTests() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for Maker-Checker middleware tests.');

    // Fetch seeded users
    const owner = await User.findOne({ email: 'admin@foodhub.com' });
    const management = await User.findOne({ email: 'companyadmin@foodhub.com' });

    if (!owner || !management) {
      throw new Error('Seed users not found. Make sure to run node scripts/seedUsers.js first.');
    }

    const middleware = makerChecker('UPDATE_MENU_ITEM', 'MenuItem');

    // Test 1: Owner bypasses middleware
    console.log('Test 1: Testing Owner bypass...');
    const reqOwner = {
      user: owner,
      body: { name: 'New Fries', basePrice: 60 },
      params: { id: '507f1f77bcf86cd799439011' },
      query: {}
    };
    const resOwner = mockRes();
    let calledNext = false;
    await middleware(reqOwner, resOwner, () => { calledNext = true; });
    if (!calledNext) {
      throw new Error('Owner was blocked by middleware, expected bypass');
    }
    console.log('✓ Owner bypassed middleware successfully.');

    // Test 2: Non-Owner (Management) is intercepted
    console.log('Test 2: Testing Non-Owner interception...');
    const reqMgmt = {
      user: management,
      body: { name: 'Spicy Burger', basePrice: 120 },
      params: { id: '507f1f77bcf86cd799439012' },
      query: {}
    };
    const resMgmt = mockRes();
    calledNext = false;
    await middleware(reqMgmt, resMgmt, () => { calledNext = true; });
    if (calledNext) {
      throw new Error('Management was NOT blocked by middleware, expected interception');
    }
    if (resMgmt.statusCode !== 202) {
      throw new Error(`Expected 202 Accepted, got ${resMgmt.statusCode}`);
    }
    if (!resMgmt.jsonData.requestId) {
      throw new Error('No requestId returned in response payload');
    }
    console.log(`✓ Management was correctly intercepted. Request ID: ${resMgmt.jsonData.requestId}`);

    // Verify it was saved in DB
    const savedRequest = await MakerCheckerRequest.findById(resMgmt.jsonData.requestId);
    if (!savedRequest) {
      throw new Error('MakerCheckerRequest was not saved to DB');
    }
    if (savedRequest.proposedData.body.name !== 'Spicy Burger') {
      throw new Error('Saved proposedData body is incorrect');
    }
    console.log('✓ Confirmed request was correctly saved in DB.');

    // Cleanup
    await MakerCheckerRequest.findByIdAndDelete(savedRequest._id);
    console.log('✓ Cleaned up test database records.');

    console.log('\n✓ Checkpoint 8 middleware tests PASSED successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Middleware tests FAILED:', error);
    process.exit(1);
  }
}

runTests();
