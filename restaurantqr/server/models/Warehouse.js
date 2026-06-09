import mongoose from 'mongoose';

const warehouseItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  sku: {
    type: String,
    trim: true,
    default: null,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  unit: {
    type: String,
    default: 'pcs',
  },
  threshold: {
    type: Number,
    default: 10,
    min: 0,
  },
});

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zone: {
      type: String,
      required: true,
    },
    contactName: {
      type: String,
      default: null,
    },
    contactPhone: {
      type: String,
      default: null,
    },
    linkedOutlets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Outlet',
      },
    ],
    inventoryItems: [warehouseItemSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    isCentralKitchen: {
      type: Boolean,
      default: false,
    },
    linkedKitchen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null,
    },
    syncLog: [
      {
        syncedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        syncedAt: { type: Date, default: Date.now },
        note: { type: String, default: null },
        itemsSynced: { type: Number, default: 0 },
        itemsAdded: { type: Number, default: 0 },
        itemsUpdated: { type: Number, default: 0 },
        sourceKitchen: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
        sourceKitchenName: { type: String, default: null },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Warehouse', warehouseSchema);
