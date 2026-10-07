import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Outlet from '../models/Outlet.js';
import connectDB from '../config/database.js';

dotenv.config();

export const OFFICIAL_OUTLETS = [
  // Corporate Clients (Private In-house Foodcourts)
  {
    name: 'Deepak Nitrite Limited',
    outletId: 'CORP001',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP001',
    businessType: 'Restaurant',
    contact: {
      name: 'Deepak Nitrite Admin',
      email: 'foodcourt@deepaknitrite.com',
      phone: '+91 98765 00001',
    },
    location: {
      address: 'Deepak Nitrite Campus, Nandesari',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Air Products',
    outletId: 'CORP002',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP002',
    businessType: 'Restaurant',
    contact: {
      name: 'Air Products Admin',
      email: 'cafeteria@airproducts.com',
      phone: '+91 98765 00002',
    },
    location: {
      address: 'Air Products Office Park, Sayajigunj',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Tata Consulting Engineers',
    outletId: 'CORP003',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP003',
    businessType: 'Restaurant',
    contact: {
      name: 'TCE Cafeteria Manager',
      email: 'foodcourt@tce.co.in',
      phone: '+91 98765 00003',
    },
    location: {
      address: 'TCE Tower, Akota',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Kotak Mahindra Bank',
    outletId: 'CORP004',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP004',
    businessType: 'Restaurant',
    contact: {
      name: 'Kotak Admin',
      email: 'cafeteria@kotak.com',
      phone: '+91 98765 00004',
    },
    location: {
      address: 'Kotak Financial Hub, Alkapuri',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Xylem Water Solutions India Pvt Ltd',
    outletId: 'CORP005',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP005',
    businessType: 'Restaurant',
    contact: {
      name: 'Xylem Admin',
      email: 'foodcourt@xylem.com',
      phone: '+91 98765 00005',
    },
    location: {
      address: 'Xylem Campus, Savli GIDC',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Collabera',
    outletId: 'CORP006',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP006',
    businessType: 'Restaurant',
    contact: {
      name: 'Collabera Cafeteria Team',
      email: 'foodcourt@collabera.com',
      phone: '+91 98765 00006',
    },
    location: {
      address: 'Collabera House, Gotri Road',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Kent PLC',
    outletId: 'CORP007',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP007',
    businessType: 'Restaurant',
    contact: {
      name: 'Kent PLC Admin',
      email: 'cafeteria@kentplc.com',
      phone: '+91 98765 00007',
    },
    location: {
      address: 'Kent Engineering Complex, Subhanpura',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },

  // Commercial / Office Complexes (Public Outlets)
  {
    name: 'Panorama Complex- Alkapuri',
    outletId: 'COMM001',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM001',
    businessType: 'Restaurant',
    contact: {
      name: 'Panorama MOPY Outlet',
      email: 'panorama@mopy.co.in',
      phone: '+91 98765 00008',
    },
    location: {
      address: 'Panorama Complex, RC Dutt Road, Alkapuri',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Nilamber Triumph- Gotri Vasna Road',
    outletId: 'COMM002',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM002',
    businessType: 'Restaurant',
    contact: {
      name: 'Nilamber MOPY Outlet',
      email: 'nilamber@mopy.co.in',
      phone: '+91 98765 00009',
    },
    location: {
      address: 'Nilamber Triumph, Main Gotri Vasna Road',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Neptune Edge - Sarabhai Complex',
    outletId: 'COMM003',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM003',
    businessType: 'Restaurant',
    contact: {
      name: 'Neptune Edge MOPY Outlet',
      email: 'neptune@mopy.co.in',
      phone: '+91 98765 00010',
    },
    location: {
      address: 'Neptune Edge, Sarabhai Campus, Vadiwadi',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
  {
    name: 'Golden Icon - Chakli Circle',
    outletId: 'COMM004',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM004',
    businessType: 'Restaurant',
    contact: {
      name: 'Golden Icon MOPY Outlet',
      email: 'goldenicon@mopy.co.in',
      phone: '+91 98765 00011',
    },
    location: {
      address: 'Golden Icon, Near Chakli Circle, OP Road',
      city: 'Vadodara',
      state: 'Gujarat',
      zone: 'West Zone',
      totalOutlets: 1,
    },
  },
];

export const seedOfficialOutlets = async () => {
  try {
    console.log('Seeding official 11 outlets...');
    const officialNames = OFFICIAL_OUTLETS.map((o) => o.name);
    await Outlet.deleteMany({ name: { $nin: officialNames } });
    for (const data of OFFICIAL_OUTLETS) {
      await Outlet.findOneAndUpdate(
        { name: data.name },
        { $set: data },
        { upsert: true, new: true }
      );
    }
    console.log('✓ All 11 Official Outlets seeded and purged old dummy outlets successfully!');
  } catch (error) {
    console.error('Error seeding outlets:', error);
  }
};

if (process.argv[1]?.endsWith('seedOutlets.js')) {
  (async () => {
    await connectDB();
    await seedOfficialOutlets();
    process.exit(0);
  })();
}
