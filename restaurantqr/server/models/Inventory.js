import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      enum: ['Kg', 'L', 'g', 'ml', 'pcs'],
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    threshold: {
      type: Number,
      required: true,
      default: 10,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    category: {
      type: String,
      enum: ['Vegetables', 'Meat', 'Oils', 'Grains', 'Spices', 'Other'],
      default: 'Other',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

inventorySchema.index({ branch: 1, sku: 1 });

export default mongoose.model('Inventory', inventorySchema);
