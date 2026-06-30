import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.js';

const MONGO_URI = 'mongodb://pincodex6_db_user:w5ROzfRIuxlOfWJe@ac-wxfpv22-shard-00-00.qtrpun6.mongodb.net:27017,ac-wxfpv22-shard-00-01.qtrpun6.mongodb.net:27017,ac-wxfpv22-shard-00-02.qtrpun6.mongodb.net:27017/foodhub?ssl=true&authSource=admin&retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: 'foodhub' });
  console.log('Connected');

  const items = await MenuItem.find({ status: 'Available' });
  console.log('Available Menu Items in DB:');
  for (const item of items) {
    console.log(`- Name: "${item.name}", CP: ${item.costPrice}, SP: ${item.basePrice}`);
  }

  mongoose.connection.close();
}

run().catch(console.error);
