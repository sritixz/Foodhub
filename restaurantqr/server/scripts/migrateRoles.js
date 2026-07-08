import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';

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

async function migrateRoles() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for role migration.');

    // Count how many users match each legacy role
    console.log('Analyzing users before migration...');
    for (const mapping of roleMapping) {
      // We search raw or bypass mongoose schema validation query filter since legacy roles are not in the enum
      const count = await User.countDocuments({ role: mapping.old });
      console.log(`- Legacy role "${mapping.old}": ${count} users found`);
    }

    console.log('\nRunning migration updates...');
    for (const mapping of roleMapping) {
      const result = await User.updateMany(
        { role: mapping.old },
        { $set: { role: mapping.new } }
      );
      console.log(`✓ Migrated "${mapping.old}" -> "${mapping.new}": modified ${result.modifiedCount} users`);
    }

    console.log('\nVerification post-migration:');
    // Ensure no users have legacy roles left
    let legacyLeftCount = 0;
    for (const mapping of roleMapping) {
      const count = await User.countDocuments({ role: mapping.old });
      legacyLeftCount += count;
      if (count > 0) {
        console.error(`❌ ERROR: ${count} users still remain with legacy role "${mapping.old}"`);
      }
    }

    if (legacyLeftCount === 0) {
      console.log('✓ SUCCESS: All legacy roles migrated and verified!');
      process.exit(0);
    } else {
      console.error('❌ FAILURE: Some users could not be migrated.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateRoles();
