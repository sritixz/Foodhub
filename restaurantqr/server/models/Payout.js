import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema(
  {
    vendor: {
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
    totalOrders: {
      type: Number,
      required: true,
      default: 0,
    },
    grossRevenue: {
      type: Number,
      required: true,
      default: 0,
    },
    commissionRate: {
      type: Number,
      required: true,
      default: 0,
    },
    commissionAmount: {
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

payoutSchema.index({ vendor: 1, createdAt: -1 });
payoutSchema.index({ status: 1 });
payoutSchema.index({ periodStart: 1, periodEnd: 1 });

export default mongoose.model('Payout', payoutSchema);
