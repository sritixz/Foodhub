import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  variant: {
    type: String,
    default: null,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        default: null,
      },
      phone: {
        type: String,
        default: null,
      },
    },
    orderType: {
      type: String,
      enum: ['Retail', 'Bulk', 'QR'],
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    deliveryMode: {
      type: String,
      enum: ['Delivery', 'Pickup', 'Dine-in'],
      required: true,
    },
    items: [orderItemSchema],
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['New', 'Preparing', 'Ready', 'Picked', 'In Transit', 'Delivered', 'Cancelled'],
      default: 'New',
    },
    deliveryAddress: {
      type: String,
      default: null,
    },
    qrCodeId: {
      type: String, // Reference to QR code if ordered via QR
      default: null,
    },
    scheduledTime: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    estimatedReadyTime: {
      type: Date,
      default: null,
    },
    statusTimeline: [
      {
        status: { type: String },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: null },
        setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ vendor: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ assignedTo: 1 });

export default mongoose.model('Order', orderSchema);
