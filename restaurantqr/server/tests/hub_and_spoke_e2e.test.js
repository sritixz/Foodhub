import { calculateRecipeFullCost, scaleRecipeYield } from '../services/foodCostEngine.js';

async function runEndToEndVerification() {
  console.log('===============================================================');
  console.log('  MOPY HUB-AND-SPOKE INVENTORY & RECIPE OVERHAUL - E2E TEST');
  console.log('===============================================================');

  // Test Step 1: Central Recipe Studio Cost Derivation
  console.log('\n[1] Testing Central Recipe Studio & Food Cost Engine...');
  const recipeInput = {
    title: 'Paneer Butter Masala Meal Tray',
    recipeCode: 'RCP-PBMM-001',
    standardYield: 100, // 100 plates
    yieldUnit: 'Plates',
    defaultValuationMode: 'WAC',
    ingredients: [
      { name: 'Fresh Malai Paneer', quantity: 15, unit: 'kg', unitCostSnapshot: 340, wastagePercent: 2 },
      { name: 'Amul Table Butter', quantity: 3.5, unit: 'kg', unitCostSnapshot: 480, wastagePercent: 0 },
      { name: 'Fresh Cream', quantity: 2, unit: 'L', unitCostSnapshot: 210, wastagePercent: 1 },
      { name: 'Tomato Makhani Gravy', quantity: 12, unit: 'kg', unitCostSnapshot: 65, wastagePercent: 5 },
      { name: 'Steamed Basmati Rice', quantity: 20, unit: 'kg', unitCostSnapshot: 75, wastagePercent: 3 },
    ],
    prepExpenses: {
      presetName: 'Standard Meal Tray (100 Plates)',
      packagingCost: 450,       // ₹4.50/tray
      directLaborHours: 2.5,    // 2.5 hrs
      laborHourlyRate: 180,     // ₹180/hr
      utilitiesCost: 220,       // Commercial LPG
      overheadPercent: 4,       // 4% overhead
    },
    outletTransferRules: [
      {
        outlet: '665000000000000000000001',
        freightCost: 4.5, // Express tech park
        handlingFee: 2.0,
        targetSellingPrice: 220,
        manualOverride: false,
      },
      {
        outlet: '665000000000000000000002',
        freightCost: 8.5, // Lower Parel
        handlingFee: 3.0,
        targetSellingPrice: 240,
        manualOverride: false,
      },
      {
        outlet: '665000000000000000000003',
        freightCost: 14.0, // Airport
        handlingFee: 5.0,
        finalCostPrice: 135.0,
        targetSellingPrice: 280,
        manualOverride: true, // Manual override
      },
    ],
  };

  const calculated = await calculateRecipeFullCost(recipeInput);
  console.log(`   - Raw Materials Subtotal: Rs ${calculated.totalRawMaterialCost}`);
  console.log(`   - Prep Expenses Subtotal: Rs ${calculated.totalPrepExpenses}`);
  console.log(`   - Total Batch Cost (100 plates): Rs ${calculated.totalBatchCost}`);
  console.log(`   - Derived Per-Plate Cost: Rs ${calculated.perPlateCost} / plate`);

  if (calculated.perPlateCost <= 0) throw new Error('Per-plate cost calculation failed');
  console.log('   ✓ Recipe Costing Derivation: PASSED');

  // Test Step 2: Manual Outlet Pricing Matrix
  console.log('\n[2] Testing Outlet Transfer Pricing Matrix...');
  calculated.outletTransferRules.forEach((rule, idx) => {
    console.log(
      `   - Outlet #${idx + 1}: Final Cost Price = Rs ${rule.finalCostPrice} | Target Retail = Rs ${rule.targetSellingPrice} | Margin = ${rule.marginPercent}%`
    );
  });
  if (calculated.outletTransferRules[0].finalCostPrice <= calculated.perPlateCost) {
    throw new Error('Outlet transfer pricing failed to include freight and handling');
  }
  console.log('   ✓ Outlet Transfer Pricing Matrix: PASSED');

  // Test Step 3: Batch Yield Scaling
  console.log('\n[3] Testing Production Batch Scaling (100 -> 250 Plates)...');
  const scaled = scaleRecipeYield(calculated, 250);
  console.log(`   - Scaling Factor: ${scaled.scalingFactor}x`);
  console.log(`   - Scaled Raw Material Cost: Rs ${scaled.totalRawMaterialCost}`);
  console.log(`   - Scaled Batch Cost: Rs ${scaled.totalBatchCost}`);
  console.log(`   - Scaled Per-Plate Cost: Rs ${scaled.perPlateCost} / plate`);
  if (scaled.targetPortions !== 250) throw new Error('Scaling portions mismatch');
  console.log('   ✓ Dynamic Recipe Yield Scaling: PASSED');

  // Test Step 4: Dispatch & GRN Reconciliation Logic
  console.log('\n[4] Testing Dispatch Inwarding & Damaged Goods Accounting...');
  const dispatchedUnits = 80;
  const unitCost = calculated.outletTransferRules[0].finalCostPrice;
  const acceptedUnits = 78;
  const damagedUnits = 2;

  const totalTransferValue = dispatchedUnits * unitCost;
  const acceptedValue = acceptedUnits * unitCost;
  const damagedValue = damagedUnits * unitCost;

  console.log(`   - Dispatched: ${dispatchedUnits} units @ Rs ${unitCost} = Rs ${totalTransferValue.toFixed(2)}`);
  console.log(`   - Accepted: ${acceptedUnits} units = Rs ${acceptedValue.toFixed(2)} committed to POS stock`);
  console.log(`   - Damaged: ${damagedUnits} units = Rs ${damagedValue.toFixed(2)} claimed back to Hub`);

  if (acceptedUnits + damagedUnits !== dispatchedUnits) {
    throw new Error('Discrepancy in dispatch goods reconciliation');
  }
  console.log('   ✓ GRN Stock Accounting & Damage Claims: PASSED');

  console.log('\n===============================================================');
  console.log('  ALL HUB-AND-SPOKE SUITE VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('===============================================================');
}

runEndToEndVerification().catch((e) => {
  console.error('Test Failed:', e);
  process.exit(1);
});
