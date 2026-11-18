import Warehouse from '../models/Warehouse.js';
import Recipe from '../models/Recipe.js';
import MenuItem from '../models/MenuItem.js';
import Outlet from '../models/Outlet.js';
import { calculateRecipeFullCost } from '../services/foodCostEngine.js';

export async function seedCentralKitchenAndRecipes() {
  try {
    // 1. Ensure Central Kitchen Warehouse exists
    let kitchen = await Warehouse.findOne({ isCentralKitchen: true });
    if (!kitchen) {
      kitchen = new Warehouse({
        name: 'MOPY Central Commissary & Kitchen Hub',
        address: 'Plot 42, Food Tech Park, Industrial Corridor',
        city: 'Mumbai',
        state: 'Maharashtra',
        zone: 'West Zone',
        contactName: 'Executive Chef Anand',
        contactPhone: '+91 98765 43210',
        isCentralKitchen: true,
        isActive: true,
      });
      await kitchen.save();
      console.log('✓ Seeded Central Kitchen Warehouse:', kitchen.name);
    }

    // 2. Ensure Default Central Recipes exist
    const recipeCount = await Recipe.countDocuments();
    if (recipeCount === 0) {
      console.log('Seeding default Central Recipes...');

      // Find outlets to build transfer rules
      const allOutlets = await Outlet.find({}).limit(5);

      // Find a paneer or meal item
      let paneerItem = await MenuItem.findOne({
        name: { $regex: /paneer/i },
      }) || await MenuItem.findOne({});

      if (paneerItem) {
        const outletRules = allOutlets.map((out, idx) => ({
          outlet: out._id,
          freightCost: idx === 0 ? 4.5 : 8.5,
          handlingFee: 2.0,
          finalCostPrice: parseFloat((111.77 + (idx === 0 ? 6.5 : 10.5)).toFixed(2)),
          targetSellingPrice: 220 + idx * 20,
          marginPercent: 46.2,
          manualOverride: false,
        }));

        const recipe1Data = await calculateRecipeFullCost({
          recipeCode: 'RCP-PBMM-001',
          menuItem: paneerItem._id,
          title: 'Paneer Butter Masala Meal Tray',
          category: 'Full Meal',
          standardYield: 100,
          yieldUnit: 'Plates',
          defaultValuationMode: 'WAC',
          ingredients: [
            { name: 'Fresh Malai Paneer', quantity: 15, unit: 'kg', wastagePercent: 2, valuationMode: 'WAC', unitCostSnapshot: 340, calculatedCost: 5202 },
            { name: 'Amul Table Butter', quantity: 3.5, unit: 'kg', wastagePercent: 0, valuationMode: 'WAC', unitCostSnapshot: 480, calculatedCost: 1680 },
            { name: 'Fresh Cream', quantity: 2, unit: 'L', wastagePercent: 1, valuationMode: 'WAC', unitCostSnapshot: 210, calculatedCost: 424.2 },
            { name: 'Tomato Makhani Gravy', quantity: 12, unit: 'kg', wastagePercent: 5, valuationMode: 'WAC', unitCostSnapshot: 65, calculatedCost: 819 },
            { name: 'Steamed Basmati Rice', quantity: 20, unit: 'kg', wastagePercent: 3, valuationMode: 'WAC', unitCostSnapshot: 75, calculatedCost: 1545 },
          ],
          prepExpenses: {
            presetName: 'Standard Meal Tray (100 Plates)',
            packagingCost: 450,
            directLaborHours: 2.5,
            laborHourlyRate: 180,
            utilitiesCost: 220,
            overheadPercent: 4,
          },
          outletTransferRules: outletRules,
          instructions: [
            { stepNumber: 1, title: 'Base Gravy Simmer', description: 'Simmer Makhani gravy at 90°C.', timeMinutes: 25 },
            { stepNumber: 2, title: 'Dairy Addition', description: 'Gently fold in diced paneer and butter.', timeMinutes: 8 },
            { stepNumber: 3, title: 'Portioning & Heat-Sealing', description: 'Portion into trays and seal.', timeMinutes: 30 },
          ],
          allergens: ['Dairy'],
        });

        const r1 = new Recipe(recipe1Data);
        await r1.save();
        paneerItem.recipe = r1._id;
        paneerItem.costPrice = r1.perPlateCost;
        await paneerItem.save();
        console.log('✓ Seeded Recipe:', r1.title);
      }

      // Seed Recipe 2: Rajma Chawal
      let secondItem = await MenuItem.findOne({ _id: { $ne: paneerItem?._id } }) || paneerItem;
      if (secondItem) {
        const recipe2Data = await calculateRecipeFullCost({
          recipeCode: 'RCP-RCHB-002',
          menuItem: secondItem._id,
          title: 'Rajma Chawal Homestyle Bowl',
          category: 'Full Meal',
          standardYield: 80,
          yieldUnit: 'Plates',
          defaultValuationMode: 'WAC',
          ingredients: [
            { name: 'Kashmiri Rajma', quantity: 10, unit: 'kg', wastagePercent: 2, valuationMode: 'WAC', unitCostSnapshot: 120, calculatedCost: 1224 },
            { name: 'Steamed Basmati Rice', quantity: 18, unit: 'kg', wastagePercent: 3, valuationMode: 'WAC', unitCostSnapshot: 75, calculatedCost: 1390.5 },
            { name: 'Onion Tomato Masala', quantity: 8, unit: 'kg', wastagePercent: 5, valuationMode: 'WAC', unitCostSnapshot: 60, calculatedCost: 504 },
            { name: 'Pure Desi Ghee', quantity: 1.5, unit: 'kg', wastagePercent: 0, valuationMode: 'WAC', unitCostSnapshot: 600, calculatedCost: 900 },
          ],
          prepExpenses: {
            presetName: 'Standard Meal Tray (100 Plates)',
            packagingCost: 360,
            directLaborHours: 2.0,
            laborHourlyRate: 180,
            utilitiesCost: 180,
            overheadPercent: 4,
          },
          outletTransferRules: allOutlets.map((out, idx) => ({
            outlet: out._id,
            freightCost: 4.5,
            handlingFee: 2.0,
            finalCostPrice: 71.0,
            targetSellingPrice: 160,
            marginPercent: 55.6,
            manualOverride: false,
          })),
        });

        const r2 = new Recipe(recipe2Data);
        await r2.save();
        console.log('✓ Seeded Recipe:', r2.title);
      }
    }
  } catch (err) {
    console.warn('Seed central hub warning (non-fatal):', err.message);
  }
}
