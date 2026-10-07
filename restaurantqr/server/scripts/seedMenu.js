import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/database.js';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import Outlet from '../models/Outlet.js';

dotenv.config();

const seedMenuData = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB for Menu Seeding');

    // Find or create default outlets
    let mainOutlet = await Outlet.findOne({ outletId: 'OUT001' });
    if (!mainOutlet) {
      mainOutlet = await Outlet.create({
        name: 'Main Restaurant',
        outletId: 'OUT001',
        businessType: 'Restaurant',
        fssaiLicense: 'FSSAI123456',
        contact: { name: 'Owner', email: 'admin@foodhub.com', phone: '9999999999' },
        location: { address: '123 Main Street', city: 'Mumbai', state: 'Maharashtra', zone: 'North Zone' },
      });
      console.log('Created OUT001 Main Restaurant');
    }

    let tataOutlet = await Outlet.findOne({ outletId: 'OUT002' });
    if (!tataOutlet) {
      tataOutlet = await Outlet.create({
        name: 'Tata Motors Kiosk',
        outletId: 'OUT002',
        businessType: 'Corporate Kiosk',
        fssaiLicense: 'FSSAI987654',
        contact: { name: 'Pantry Manager', email: 'tata.pantry@mopy.co.in', phone: '8888888888' },
        location: { address: 'Tata Motors Tech Park', city: 'Mumbai', state: 'Maharashtra', zone: 'Tech Park' },
      });
      console.log('Created OUT002 Tata Motors Kiosk');
    }

    // Seed Categories
    const categoriesData = [
      { name: 'Starters & Snacks', description: 'Crispy rolls, samosas & fries' },
      { name: 'Burgers & Wraps', description: 'Gourmet burgers and kathi wraps' },
      { name: 'Woodfired Pizzas', description: '10-inch artisan pizzas' },
      { name: 'Pantry Thalis & Bowls', description: 'Royal thalis and rice bowls' },
      { name: 'Sweets & Desserts', description: 'Belgian lava cakes & gulab jamun' },
      { name: 'Coffee, Tea & Shakes', description: 'Cold brews, teas & smoothies' },
    ];

    const categoryDocs = {};
    for (let cat of categoriesData) {
      let existing = await Category.findOne({ name: cat.name });
      if (!existing) {
        existing = await Category.create(cat);
        console.log(`✓ Created Category: ${cat.name}`);
      }
      categoryDocs[cat.name] = existing._id;
    }

    // Seed Menu Items
    const menuItemsData = [
      {
        name: 'Executive Royal North Indian Thali',
        categoryName: 'Pantry Thalis & Bowls',
        description: 'Paneer Butter Masala, Dal Tadka, Jeera Rice, 2 Butter Phulkas, Gulab Jamun & Salad.',
        foodType: 'Veg',
        basePrice: 249,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'Classic Butter Chicken Rice Bowl',
        categoryName: 'Pantry Thalis & Bowls',
        description: 'Tender chicken simmered in butter gravy over jeera basmati rice.',
        foodType: 'Non-Veg',
        basePrice: 349,
        image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'Truffle Mushroom Swiss Burger',
        categoryName: 'Burgers & Wraps',
        description: 'Grilled portobello mushroom, caramelized onions & black truffle aioli.',
        foodType: 'Veg',
        basePrice: 299,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'Iced Vietnamese Cold Brew Coffee',
        categoryName: 'Coffee, Tea & Shakes',
        description: 'Dark roast cold brew poured over sweetened condensed milk & ice.',
        foodType: 'Veg',
        basePrice: 169,
        image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'Belgian Chocolate Lava Cake',
        categoryName: 'Sweets & Desserts',
        description: 'Dark chocolate cake with molten chocolate core & vanilla ice cream.',
        foodType: 'Veg',
        basePrice: 179,
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'Paneer Tikka Kathi Roll',
        categoryName: 'Starters & Snacks',
        description: 'Char-grilled paneer wrapped in laccha paratha with mint chutney.',
        foodType: 'Veg',
        basePrice: 199,
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
      },
      {
        name: 'Classic Margherita Woodfired Pizza (10")',
        categoryName: 'Woodfired Pizzas',
        description: 'San Marzano tomato sauce, double mozzarella & fresh basil.',
        foodType: 'Veg',
        basePrice: 349,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      }
    ];

    for (let item of menuItemsData) {
      const existing = await MenuItem.findOne({ name: item.name });
      if (!existing) {
        await MenuItem.create({
          name: item.name,
          category: categoryDocs[item.categoryName],
          description: item.description,
          foodType: item.foodType,
          basePrice: item.basePrice,
          image: item.image,
          status: 'Available',
          vendor: mainOutlet._id,
          applyToAll: true,
          outlets: [mainOutlet._id, tataOutlet._id],
        });
        console.log(`✓ Created Menu Item: ${item.name}`);
      }
    }

    console.log('\n✓ Menu seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding menu:', err);
    process.exit(1);
  }
};

seedMenuData();
