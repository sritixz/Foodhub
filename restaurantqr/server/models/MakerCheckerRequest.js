import mongoose from 'mongoose';

const makerCheckerRequestSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      required: true,
      trim: true,
    },
    targetModel: {
      type: String,
      required: true,
      trim: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    proposedData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    maker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      required: true,
    },
    comments: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

makerCheckerRequestSchema.index({ status: 1 });
makerCheckerRequestSchema.index({ maker: 1 });

export default mongoose.model('MakerCheckerRequest', makerCheckerRequestSchema);
