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
 
    // Create a default outlet if none exists (for users that need outlet assignment)
    let defaultOutlet = await Outlet.findOne();
    if (!defaultOutlet) {
      defaultOutlet = await Outlet.create({
        name: 'Main Restaurant',
        outletId: 'OUT001',
        businessType: 'Restaurant',
        fssaiLicense: 'FSSAI123456',
        contact: {
          name: 'Restaurant Owner',
          email: 'owner@restaurant.com',
          phone: '1234567890',
        },
        location: {
          address: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zone: 'North Zone',
        },
      });
      console.log('Created default outlet:', defaultOutlet.name);
    }

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
        name: 'Customer User',
        email: 'employee@foodhub.com',
        phone: '4444444444',
        password: 'employee123',
        role: 'Customer',
        outlet: null,
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
