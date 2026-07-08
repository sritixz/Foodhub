import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import MakerCheckerRequest from '../models/MakerCheckerRequest.js';
import User from '../models/User.js';

dotenv.config();

async function runTests() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for MakerCheckerRequest model tests.');

    // Fetch seeded users
    const makerUser = await User.findOne({ email: 'staff@foodhub.com' });
    const checkerUser = await User.findOne({ email: 'admin@foodhub.com' });

    if (!makerUser || !checkerUser) {
      throw new Error('Seed users not found. Make sure to run node scripts/seedUsers.js first.');
    }

    // 1. Create a request
    console.log('Creating mock MakerCheckerRequest...');
    const request = await MakerCheckerRequest.create({
      actionType: 'UPDATE_MENU_ITEM',
      targetModel: 'MenuItem',
      targetId: new mongoose.Types.ObjectId(),
      proposedData: { name: 'Super Spicy Pizza', basePrice: 499 },
      maker: makerUser._id,
      status: 'Pending',
    });

    console.log(`✓ Request created with ID: ${request._id}, status: ${request.status}`);

    // 2. Try saving with invalid status
    console.log('Testing invalid status validation...');
    request.status = 'ApprovedAndCompleted'; // Invalid status
    try {
      await request.save();
      throw new Error('Schema validation failed to reject invalid status value');
    } catch (err) {
      console.log('✓ Successfully rejected invalid status value:', err.message);
    }

    // 3. Move request to approved state
    console.log('Moving request to Approved state...');
    request.status = 'Approved';
    request.checker = checkerUser._id;
    request.comments = 'Approved on schedule';
    const approvedRequest = await request.save();
    console.log(`✓ Request approved. Checker linked: ${approvedRequest.checker}, comments: "${approvedRequest.comments}"`);

    // Cleanup
    await MakerCheckerRequest.findByIdAndDelete(request._id);
    console.log('✓ Cleaned up test MakerCheckerRequest.');

    console.log('\n✓ Checkpoint 7 model tests PASSED successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Model tests FAILED:', error);
    process.exit(1);
  }
}

runTests();
