import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
      unique: true, // one budget config per outlet
    },
    period: {
      type: String,
      enum: ['monthly', 'weekly'],
      default: 'monthly',
    },
    procurementLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    perOrderLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    salesTarget: {
      type: Number,
      required: true,
      min: 1,
    },
    alertThreshold: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      default: 80,
    },
    blockOnExceed: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

budgetSchema.index({ outletId: 1 });

export default mongoose.model('Budget', budgetSchema);
