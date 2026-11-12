import mongoose from 'mongoose';

const ledgerItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  costPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  sellingPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  sentQty: {
    type: Number,
    required: true,
    default: 0,
  },
  digitalSoldQty: {
    type: Number,
    required: true,
    default: 0,
  },
  counterSoldQty: {
    type: Number,
    required: true,
    default: 0,
  },
  totalSoldQty: {
    type: Number,
    required: true,
    default: 0,
  },
  wastageQty: {
    type: Number,
    required: true,
    default: 0,
  },
  revenue: {
    type: Number,
    required: true,
    default: 0,
  },
  costing: {
    type: Number,
    required: true,
    default: 0,
  },
  grossProfit: {
    type: Number,
    required: true,
    default: 0,
  },
  closingStock: {
    type: Number,
    default: 0,
  },
});

const dailyLedgerSchema = new mongoose.Schema(
  {
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    items: [ledgerItemSchema],
    collections: {
      expectedCash: { type: Number, default: 0 },
      actualCash: { type: Number, default: 0 },
      expectedGpay: { type: Number, default: 0 },
      actualGpay: { type: Number, default: 0 },
    },
    expenses: {
      salary: { type: Number, default: 0 },
      transport: { type: Number, default: 0 },
      corp: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    financials: {
      totalRevenue: { type: Number, default: 0 },
      totalCosting: { type: Number, default: 0 },
      grossProfit: { type: Number, default: 0 },
      indirectExpenses: { type: Number, default: 0 },
      netProfit: { type: Number, default: 0 },
    },
    receiptConfirmation: {
      confirmedBy: { type: String },
      confirmedAt: { type: Date },
      comments: { type: String },
      items: [{ type: mongoose.Schema.Types.Mixed }],
    },
    settlement: {
      openingCash: { type: Number, default: 0 },
      cashSales: { type: Number, default: 0 },
      cashRefunds: { type: Number, default: 0 },
      pettyCashExpenses: { type: Number, default: 0 },
      countedPhysicalCash: { type: Number, default: 0 },
      expectedCash: { type: Number, default: 0 },
      variance: { type: Number, default: 0 },
      digitalPaymentsTotal: { type: Number, default: 0 },
      manualCounterSalesTotal: { type: Number, default: 0 },
      discrepancyNotes: { type: String, default: '' },
      denominations: [{ type: mongoose.Schema.Types.Mixed }],
      submittedBy: { type: String },
      submittedAt: { type: Date },
      status: { type: String, default: 'Pending' },
    },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved'],
      default: 'Draft',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one ledger per outlet per day
dailyLedgerSchema.index({ date: 1, outlet: 1 }, { unique: true });

export default mongoose.model('DailyLedger', dailyLedgerSchema);
