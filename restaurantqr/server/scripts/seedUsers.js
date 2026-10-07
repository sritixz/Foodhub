import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Outlet from '../models/Outlet.js';
import connectDB from '../config/database.js';

dotenv.config();

const seedUsers = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');
 
    // Ensure official 11 outlets exist first
    const { seedOfficialOutlets } = await import('./seedOutlets.js');
    await seedOfficialOutlets();

    // Fetch official default outlet (Deepak Nitrite Limited)
    let defaultOutlet = await Outlet.findOne({ outletId: 'CORP001' }) || await Outlet.findOne();
    console.log('Using default outlet for staff:', defaultOutlet.name, `(${defaultOutlet.outletId})`);

    // Define users to seed
    const users = [
      {
        name: 'Owner User',
        email: 'admin@foodhub.com',
        phone: '9999999999',
        password: 'admin123',
        role: 'Owner',
        outlet: null,
        status: 'Active',
      },
      {
        name: 'Management User',
        email: 'companyadmin@foodhub.com',
        phone: '8888888888',
        password: 'company123',
        role: 'Management',
        outlet: null,
        status: 'Active',
      },
      {
        name: 'Central Kitchen Manager',
        email: 'ckm@foodhub.com',
        phone: '7777777778',
        password: 'ckm123',
        role: 'Central Kitchen Manager',
        outlet: defaultOutlet._id,
        status: 'Active',
      },
      {
        name: 'Outlet Sales Rep 1',
        email: 'staff@foodhub.com',
        phone: '7777777777',
        password: 'staff123',
        role: 'Outlet Sales Representative',
        outlet: defaultOutlet._id,
        status: 'Active',
      },
      {
        name: 'Outlet Sales Rep 2',
        email: 'vendor@foodhub.com',
        phone: '5555555555',
        password: 'vendor123',
        role: 'Outlet Sales Representative',
        outlet: defaultOutlet._id,
        status: 'Active',
      },
      {
        name: 'Driver User',
        email: 'delivery@foodhub.com',
        phone: '6666666666',
        password: 'delivery123',
        role: 'Driver',
        outlet: defaultOutlet._id,
        status: 'Active',
      },
      {
        name: 'Corporate Customer User',
        email: 'customer@foodhub.com',
        phone: '4444444444',
        password: 'customer123',
        role: 'Customer',
        organization: 'Deepak Nitrite Limited',
        companyCategory: 'Corporate Client',
        assignedCompany: 'Deepak Nitrite Limited',
        outlet: defaultOutlet._id,
        status: 'Active',
      },
      {
        name: 'Commercial Customer User',
        email: 'commercial.customer@foodhub.com',
        phone: '4444444445',
        password: 'customer123',
        role: 'Customer',
        organization: 'Panorama Complex- Alkapuri',
        companyCategory: 'Commercial/Office Complex',
        assignedCompany: 'Panorama Complex- Alkapuri',
        outlet: (await Outlet.findOne({ outletId: 'COMM001' }))?._id || defaultOutlet._id,
        status: 'Active',
      },
      {
        name: 'Investor User',
        email: 'investor@foodhub.com',
        phone: '3333333333',
        password: 'investor123',
        role: 'Investment Partner',
        outlet: defaultOutlet._id,
        status: 'Active',
      },
    ];

    // Create users
    const createdUsers = [];
    for (const userData of users) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create user
      const user = await User.create({
        ...userData,
        password: hashedPassword,
      });

      createdUsers.push({
        name: user.name,
        email: user.email,
        role: user.role,
        password: userData.password, // Store plain password for reference
      });

      console.log(`✓ Created ${user.role}: ${user.email}`);
    }

    console.log('\n=== USER CREDENTIALS ===\n');
    createdUsers.forEach((user) => {
      console.log(`Role: ${user.role}`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log('---');
    });

    console.log('\n✓ User seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();
