import mongoose from 'mongoose';

const deliveryBatchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
    },
    runner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
    ],
    building: {
      type: String,
      default: 'Tower B',
    },
    floors: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['Formed', 'In Transit', 'Delivered'],
      default: 'Formed',
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

deliveryBatchSchema.index({ runner: 1, createdAt: -1 });
deliveryBatchSchema.index({ status: 1 });

export default mongoose.model('DeliveryBatch', deliveryBatchSchema);
