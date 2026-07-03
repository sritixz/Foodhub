import mongoose from 'mongoose';

const investorPayoutSchema = new mongoose.Schema(
  {
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    totalOutletProfit: {
      type: Number,
      required: true,
      default: 0,
    },
    profitShareAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    assuredReturnAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    netPayout: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Paid', 'Failed'],
      default: 'Pending',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

investorPayoutSchema.index({ investor: 1, createdAt: -1 });
investorPayoutSchema.index({ status: 1 });
investorPayoutSchema.index({ periodStart: 1, periodEnd: 1 });

export default mongoose.model('InvestorPayout', investorPayoutSchema);
