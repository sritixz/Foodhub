import mongoose from 'mongoose';

const consumedIngredientSchema = new mongoose.Schema({
  rawMaterial: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
  requiredQty: {
    type: Number,
    required: true,
  },
  actualUsedQty: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
  unitCost: {
    type: Number,
    default: 0,
  },
  costDeducted: {
    type: Number,
    default: 0,
  },
});

const productionBatchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe',
      required: true,
    },
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    centralKitchen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },

    // Yield & Scaling
    scalingFactor: {
      type: Number,
      default: 1.0,
      min: 0.1,
    },
    plannedYield: {
      type: Number,
      required: true,
      min: 1,
    },
    actualYield: {
      type: Number,
      default: 0,
    },
    yieldUnit: {
      type: String,
      default: 'Plates',
    },

    // Raw Material Depletion Log
    consumedIngredients: [consumedIngredientSchema],
    totalRawMaterialCost: {
      type: Number,
      default: 0,
    },

    // Allocated Prep Expenses
    allocatedPrepExpenses: {
      packagingCost: { type: Number, default: 0 },
      laborCost: { type: Number, default: 0 },
      utilitiesCost: { type: Number, default: 0 },
      overheadCost: { type: Number, default: 0 },
      totalPrepExpenses: { type: Number, default: 0 },
    },

    // Costing Results
    actualBatchCost: {
      type: Number,
      default: 0,
    },
    actualCostPerPlate: {
      type: Number,
      default: 0,
    },

    // Dispatch Tracking
    dispatchedQty: {
      type: Number,
      default: 0,
    },
    remainingStagedQty: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['Planned', 'In-Production', 'Completed', 'Dispatched', 'Cancelled'],
      default: 'Planned',
    },

    prepDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    qualityApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    qualityNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Helper to auto-calculate batch totals
productionBatchSchema.methods.calculateTotals = function () {
  this.totalRawMaterialCost = (this.consumedIngredients || []).reduce((sum, item) => {
    item.costDeducted = parseFloat(((item.actualUsedQty || 0) * (item.unitCost || 0)).toFixed(2));
    return sum + item.costDeducted;
  }, 0);
  this.totalRawMaterialCost = parseFloat(this.totalRawMaterialCost.toFixed(2));

  const prep = this.allocatedPrepExpenses || {};
  prep.totalPrepExpenses = parseFloat(
    (
      (prep.packagingCost || 0) +
      (prep.laborCost || 0) +
      (prep.utilitiesCost || 0) +
      (prep.overheadCost || 0)
    ).toFixed(2)
  );

  this.actualBatchCost = parseFloat((this.totalRawMaterialCost + prep.totalPrepExpenses).toFixed(2));
  const effectiveYield = (this.actualYield > 0 ? this.actualYield : this.plannedYield) || 1;
  this.actualCostPerPlate = parseFloat((this.actualBatchCost / effectiveYield).toFixed(2));
  this.remainingStagedQty = Math.max(0, effectiveYield - (this.dispatchedQty || 0));

  return this;
};

export default mongoose.model('ProductionBatch', productionBatchSchema);
