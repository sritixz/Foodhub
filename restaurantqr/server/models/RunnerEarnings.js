import mongoose from 'mongoose';

const runnerEarningsSchema = new mongoose.Schema(
  {
    runner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryShift',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    deliveriesCount: {
      type: Number,
      default: 0,
    },
    baseShiftPay: {
      type: Number,
      default: 350.0,
    },
    perOrderPay: {
      type: Number,
      default: 30.0,
    },
    batchBonus: {
      type: Number,
      default: 0.0,
    },
    tips: {
      type: Number,
      default: 0.0,
    },
    penalties: {
      type: Number,
      default: 0.0,
    },
    netEarnings: {
      type: Number,
      default: 350.0,
    },
    settlementStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Settled', 'Disputed'],
      default: 'Pending',
    },
    disputeReason: {
      type: String,
      default: '',
    },
    disputeNotes: {
      type: String,
      default: '',
    },
    settledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

runnerEarningsSchema.index({ runner: 1, date: -1 });

const RunnerEarnings = mongoose.model('RunnerEarnings', runnerEarningsSchema);
export default RunnerEarnings;
