import mongoose from 'mongoose';

const dispatchItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  dishName: {
    type: String,
    required: true,
  },
  productionBatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductionBatch',
    required: false,
  },
  batchNumber: {
    type: String,
    default: '',
  },
  dispatchedQty: {
    type: Number,
    required: true,
    min: 1,
  },
  acceptedQty: {
    type: Number,
    default: 0,
    min: 0,
  },
  damagedQty: {
    type: Number,
    default: 0,
    min: 0,
  },
  discrepancyReason: {
    type: String,
    enum: ['', 'Seal Broken', 'Transit Leakage', 'Temperature Abuse', 'Spoilage', 'Short Count', 'Other'],
    default: '',
  },
  unitCostPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalItemCost: {
    type: Number,
    required: true,
    min: 0,
  },
});

const dispatchOrderSchema = new mongoose.Schema(
  {
    dispatchNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    sourceKitchen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    targetOutlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    dispatchDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },

    // Dispatched Items List
    items: [dispatchItemSchema],

    // Aggregates
    totalDispatchedUnits: {
      type: Number,
      default: 0,
    },
    totalAcceptedUnits: {
      type: Number,
      default: 0,
    },
    totalDamagedUnits: {
      type: Number,
      default: 0,
    },
    totalTransferValue: {
      type: Number,
      default: 0,
    },
    totalAcceptedValue: {
      type: Number,
      default: 0,
    },

    // Transit & Dispatch Status
    transitStatus: {
      type: String,
      enum: ['Draft', 'Manifested', 'In-Transit', 'Delivered', 'Reconciled'],
      default: 'Draft',
    },

    // Gate Pass & Logistics Details
    runnerName: {
      type: String,
      default: '',
    },
    vehicleNumber: {
      type: String,
      default: '',
    },
    departureTime: {
      type: Date,
      default: null,
    },
    temperatureAtDeparture: {
      type: Number, // e.g. 4.2 °C
      default: null,
    },

    // Receiving (Goods Receipt Note - GRN)
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    grnPhotoUrl: {
      type: String,
      default: '',
    },
    receiverNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Method to recalculate aggregates
dispatchOrderSchema.methods.recalculateAggregates = function () {
  let dispUnits = 0;
  let accUnits = 0;
  let damUnits = 0;
  let totalVal = 0;
  let accVal = 0;

  (this.items || []).forEach((item) => {
    item.totalItemCost = parseFloat(((item.dispatchedQty || 0) * (item.unitCostPrice || 0)).toFixed(2));
    dispUnits += item.dispatchedQty || 0;
    accUnits += item.acceptedQty || 0;
    damUnits += item.damagedQty || 0;
    totalVal += item.totalItemCost;
    accVal += (item.acceptedQty || 0) * (item.unitCostPrice || 0);
  });

  this.totalDispatchedUnits = dispUnits;
  this.totalAcceptedUnits = accUnits;
  this.totalDamagedUnits = damUnits;
  this.totalTransferValue = parseFloat(totalVal.toFixed(2));
  this.totalAcceptedValue = parseFloat(accVal.toFixed(2));

  return this;
};

export default mongoose.model('DispatchOrder', dispatchOrderSchema);
