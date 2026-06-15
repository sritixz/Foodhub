import mongoose from 'mongoose';

const franchiseRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'negotiating', 'converted', 'rejected'],
      default: 'new',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

franchiseRequestSchema.index({ status: 1 });
franchiseRequestSchema.index({ createdAt: -1 });

export default mongoose.model('FranchiseRequest', franchiseRequestSchema);
