import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const roleMapping = [
  { old: 'Admin', new: 'Owner' },
  { old: 'Company Admin', new: 'Management' },
  { old: 'Vendor', new: 'Outlet Sales Representative' },
  { old: 'Staff', new: 'Outlet Sales Representative' },
  { old: 'Delivery Staff', new: 'Driver' },
  { old: 'Investor', new: 'Investment Partner' },
  { old: 'Employee', new: 'Customer' }
];

async function runTest() {
  try {
    await connectDB();
    console.log('Connected to DB for migration testing.');

    // Clear existing mock users
    await User.deleteMany({ email: /@mockmigrate\.com$/ });

    const salt = await bcrypt.genSalt(5);
    const password = await bcrypt.hash('pass123', salt);

    const legacyMockUsers = [
      { name: 'Mock Admin', email: 'admin@mockmigrate.com', phone: '1', role: 'Admin', password },
      { name: 'Mock CoAdmin', email: 'coadmin@mockmigrate.com', phone: '2', role: 'Company Admin', password },
      { name: 'Mock Vendor', email: 'vendor@mockmigrate.com', phone: '3', role: 'Vendor', password },
      { name: 'Mock Staff', email: 'staff@mockmigrate.com', phone: '4', role: 'Staff', password },
      { name: 'Mock Delivery', email: 'delivery@mockmigrate.com', phone: '5', role: 'Delivery Staff', password },
      { name: 'Mock Investor', email: 'investor@mockmigrate.com', phone: '6', role: 'Investor', password },
      { name: 'Mock Employee', email: 'employee@mockmigrate.com', phone: '7', role: 'Employee', password },
    ];

    console.log('Inserting users with legacy roles (bypassing validation)...');
    // Using raw collection to bypass Mongoose enum checks for legacy roles
    await User.collection.insertMany(legacyMockUsers);
    console.log('Mock legacy users inserted successfully.');

    // Count before
    for (const mapping of roleMapping) {
      const count = await User.countDocuments({ role: mapping.old, email: /@mockmigrate\.com$/ });
      console.log(`- Legacy "${mapping.old}" count in DB: ${count}`);
      if (count !== 1) {
        throw new Error(`Expected 1 user for legacy role "${mapping.old}", got ${count}`);
      }
    }

    console.log('\nRunning migration updates for mock users...');
    for (const mapping of roleMapping) {
      await User.updateMany(
        { role: mapping.old, email: /@mockmigrate\.com$/ },
        { $set: { role: mapping.new } }
      );
    }
    console.log('Migration finished.');

    console.log('\nAsserting role conversions...');
    for (const mapping of roleMapping) {
      const oldCount = await User.countDocuments({ role: mapping.old, email: /@mockmigrate\.com$/ });
      const newCount = await User.countDocuments({ role: mapping.new, email: /@mockmigrate\.com$/ });
      
      console.log(`- Role "${mapping.old}" count: ${oldCount} (expected 0)`);
      console.log(`- Role "${mapping.new}" count: ${newCount} (expected >= 1)`);
      
      if (oldCount !== 0) {
        throw new Error(`Assertion failed: Legacy role "${mapping.old}" still exists!`);
      }
      if (newCount < 1) {
        throw new Error(`Assertion failed: New role "${mapping.new}" count is ${newCount}, expected >= 1`);
      }
    }

    // Clean up mock users
    await User.deleteMany({ email: /@mockmigrate\.com$/ });
    console.log('\nCleaned up mock users.');

    console.log('✓ Migration test PASSED successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration test FAILED:', error);
    process.exit(1);
  }
}

runTest();
