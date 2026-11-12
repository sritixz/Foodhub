import mongoose from 'mongoose';

const kitchenIndentSchema = new mongoose.Schema(
  {
    indentNumber: {
      type: String,
      required: true,
      unique: true,
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    itemName: {
      type: String,
      required: true,
    },
    requestedQty: {
      type: Number,
      required: true,
      min: 1,
    },
    urgency: {
      type: String,
      enum: ['Normal', 'High', 'Critical'],
      default: 'Normal',
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Raised', 'Acknowledged', 'Dispatched', 'Cancelled'],
      default: 'Raised',
    },
  },
  { timestamps: true }
);

export default mongoose.model('KitchenIndent', kitchenIndentSchema);
