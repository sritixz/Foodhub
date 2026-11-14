import mongoose from 'mongoose';

const recipeIngredientSchema = new mongoose.Schema({
  rawMaterial: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unit: {
    type: String,
    enum: ['kg', 'g', 'L', 'ml', 'pcs'],
    default: 'g',
  },
  wastagePercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  valuationMode: {
    type: String,
    enum: ['WAC', 'PO', 'LiveMarket'],
    default: 'WAC',
  },
  unitCostSnapshot: {
    type: Number,
    default: 0,
  },
  calculatedCost: {
    type: Number,
    default: 0,
  },
});

const prepExpensesSchema = new mongoose.Schema({
  presetName: {
    type: String,
    default: 'Custom',
  },
  packagingCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  directLaborHours: {
    type: Number,
    default: 0,
    min: 0,
  },
  laborHourlyRate: {
    type: Number,
    default: 180,
    min: 0,
  },
  directLaborCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  utilitiesCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  overheadPercent: {
    type: Number,
    default: 0,
    min: 0,
  },
  overheadCost: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const outletTransferRuleSchema = new mongoose.Schema({
  outlet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Outlet',
    required: true,
  },
  freightCost: {
    type: Number,
    default: 0,
    min: 0,
  },
  handlingFee: {
    type: Number,
    default: 0,
    min: 0,
  },
  finalCostPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  targetSellingPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  marginPercent: {
    type: Number,
    default: 0,
  },
  manualOverride: {
    type: Boolean,
    default: false,
  },
});

const cookingStepSchema = new mongoose.Schema({
  stepNumber: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  timeMinutes: {
    type: Number,
    default: 0,
  },
  criticalControlPoint: {
    type: String,
    default: '', // e.g. "Ensure internal temperature reaches 75°C for 2 minutes"
  },
});

const recipeSchema = new mongoose.Schema(
  {
    recipeCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'Full Meal',
    },
    standardYield: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
    },
    yieldUnit: {
      type: String,
      default: 'Plates',
    },
    defaultValuationMode: {
      type: String,
      enum: ['WAC', 'PO', 'LiveMarket'],
      default: 'WAC',
    },

    // Raw Materials / BOM
    ingredients: [recipeIngredientSchema],
    totalRawMaterialCost: {
      type: Number,
      default: 0,
    },

    // Preparation Expenses
    prepExpenses: {
      type: prepExpensesSchema,
      default: () => ({}),
    },
    totalPrepExpenses: {
      type: Number,
      default: 0,
    },

    // Derived Cost Totals
    totalBatchCost: {
      type: Number,
      default: 0,
    },
    perPlateCost: {
      type: Number,
      default: 0,
    },

    // Manual per-outlet transfer matrix
    outletTransferRules: [outletTransferRuleSchema],

    // Central Recipe Reuse Data (SOP, QC, Nutrition, Allergens)
    instructions: [cookingStepSchema],
    allergens: [
      {
        type: String,
        enum: ['Dairy', 'Nuts', 'Gluten', 'Soy', 'Eggs', 'Peanuts', 'Sesame', 'None'],
      },
    ],
    dietaryFlags: {
      isVeg: { type: Boolean, default: true },
      isVegan: { type: Boolean, default: false },
      isJain: { type: Boolean, default: false },
    },
    storageSpecs: {
      shelfLifeHours: { type: Number, default: 24 },
      storageTempMin: { type: Number, default: 2 },
      storageTempMax: { type: Number, default: 5 },
      reheatingInstructions: { type: String, default: 'Microwave 800W for 2 mins or heat in pan until piping hot.' },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastCostedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Method to recalculate derived costs
recipeSchema.methods.recalculateCosts = function () {
  // 1. Raw Materials Total
  this.totalRawMaterialCost = (this.ingredients || []).reduce((sum, ing) => {
    const rawCost = (ing.quantity || 0) * (ing.unitCostSnapshot || 0);
    const wastage = 1 + (ing.wastagePercent || 0) / 100;
    ing.calculatedCost = parseFloat((rawCost * wastage).toFixed(2));
    return sum + ing.calculatedCost;
  }, 0);
  this.totalRawMaterialCost = parseFloat(this.totalRawMaterialCost.toFixed(2));

  // 2. Prep Expenses Total
  const p = this.prepExpenses || {};
  const laborCost = (p.directLaborHours || 0) * (p.laborHourlyRate || 180);
  p.directLaborCost = parseFloat(laborCost.toFixed(2));
  const overheadCost = p.overheadPercent
    ? parseFloat(((this.totalRawMaterialCost * p.overheadPercent) / 100).toFixed(2))
    : (p.overheadCost || 0);
  p.overheadCost = overheadCost;

  this.totalPrepExpenses = parseFloat(
    (
      (p.packagingCost || 0) +
      (p.directLaborCost || 0) +
      (p.utilitiesCost || 0) +
      (p.overheadCost || 0)
    ).toFixed(2)
  );

  // 3. Batch Total & Per-Plate Cost
  this.totalBatchCost = parseFloat((this.totalRawMaterialCost + this.totalPrepExpenses).toFixed(2));
  const yieldCount = this.standardYield > 0 ? this.standardYield : 1;
  this.perPlateCost = parseFloat((this.totalBatchCost / yieldCount).toFixed(2));

  // 4. Update Outlet Transfer Prices if not manually overridden
  if (this.outletTransferRules && this.outletTransferRules.length > 0) {
    this.outletTransferRules.forEach((rule) => {
      if (!rule.manualOverride) {
        rule.finalCostPrice = parseFloat(
          (this.perPlateCost + (rule.freightCost || 0) + (rule.handlingFee || 0)).toFixed(2)
        );
      }
      if (rule.targetSellingPrice > 0) {
        rule.marginPercent = parseFloat(
          (
            ((rule.targetSellingPrice - rule.finalCostPrice) / rule.targetSellingPrice) *
            100
          ).toFixed(1)
        );
      }
    });
  }

  this.lastCostedAt = new Date();
  return this;
};

export default mongoose.model('Recipe', recipeSchema);
