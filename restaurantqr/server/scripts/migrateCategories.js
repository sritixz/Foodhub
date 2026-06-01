import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import connectDB from '../config/database.js';

dotenv.config();

const migrateCategories = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Define hardcoded categories array
    const hardcodedCategories = ['Main Course', 'Appetizers', 'Beverages', 'Desserts'];
    
    console.log('\n=== Starting Category Migration ===\n');

    // Step 1: Create category documents for each hardcoded category
    console.log('Step 1: Creating category documents...');
    const categoryMapping = {};
    let categoriesCreated = 0;

    for (const categoryName of hardcodedCategories) {
      // Check if category already exists
      let category = await Category.findOne({ name: categoryName });
      
      if (!category) {
        category = await Category.create({
          name: categoryName,
          description: `${categoryName} items`,
        });
        categoriesCreated++;
        console.log(`✓ Created category: ${categoryName}`);
      } else {
        console.log(`  Category already exists: ${categoryName}`);
      }
      
      // Build mapping object
      categoryMapping[categoryName] = category._id;
    }

    console.log(`\nCategories created: ${categoriesCreated}`);
    console.log('Category mapping:', categoryMapping);

    // Step 2: Query all menu items using lean() to get raw values before schema casting
    console.log('\nStep 2: Querying menu items...');
    const menuItems = await MenuItem.find({}).lean();
    console.log(`Found ${menuItems.length} menu items`);

    // Step 3: Update each menu item's category field from string to ObjectId
    console.log('\nStep 3: Updating menu items...');
    let menuItemsUpdated = 0;
    let menuItemsSkipped = 0;
    const errors = [];

    for (const menuItem of menuItems) {
      try {
        // Check if category is already an ObjectId (already migrated)
        if (menuItem.category instanceof mongoose.Types.ObjectId || 
            (menuItem.category && mongoose.Types.ObjectId.isValid(menuItem.category) && 
             String(menuItem.category).length === 24)) {
          console.log(`  Skipping menu item "${menuItem.name}" - already migrated`);
          menuItemsSkipped++;
          continue;
        }

        // Get the category string value
        const categoryString = String(menuItem.category);
        
        // Find the corresponding category ID from mapping
        const categoryId = categoryMapping[categoryString];
        
        if (!categoryId) {
          const errorMsg = `No mapping found for category "${categoryString}" in menu item "${menuItem.name}"`;
          console.error(`✗ ${errorMsg}`);
          errors.push(errorMsg);
          continue;
        }

        // Update the menu item with the category ObjectId
        await MenuItem.updateOne({ _id: menuItem._id }, { $set: { category: categoryId } });
        
        menuItemsUpdated++;
        console.log(`✓ Updated menu item: ${menuItem.name} (${categoryString} -> ${categoryId})`);
      } catch (error) {
        const errorMsg = `Error updating menu item "${menuItem.name}": ${error.message}`;
        console.error(`✗ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Step 4: Verify all menu items have valid category references
    console.log('\nStep 4: Verifying menu items...');
    const invalidMenuItems = [];
    const updatedMenuItems = await MenuItem.find({}).lean();
    
    for (const menuItem of updatedMenuItems) {
      const category = await Category.findById(menuItem.category);
      if (!category) {
        invalidMenuItems.push(menuItem.name);
      }
    }

    // Final summary
    console.log('\n=== Migration Summary ===\n');
    console.log(`Categories created: ${categoriesCreated}`);
    console.log(`Menu items updated: ${menuItemsUpdated}`);
    console.log(`Menu items skipped (already migrated): ${menuItemsSkipped}`);
    console.log(`Invalid menu items: ${invalidMenuItems.length}`);
    
    if (errors.length > 0) {
      console.log(`\nErrors encountered: ${errors.length}`);
      errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error}`);
      });
    }
    
    if (invalidMenuItems.length > 0) {
      console.log('\nMenu items with invalid category references:');
      invalidMenuItems.forEach((name) => {
        console.error(`  - ${name}`);
      });
    }

    if (errors.length === 0 && invalidMenuItems.length === 0) {
      console.log('\n✓ Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠ Migration completed with errors. Please review the log above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
};

migrateCategories();
