import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['payout', 'commission', 'overcharge', 'underpayment', 'other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Open', 'Under Review', 'Resolved', 'Rejected'],
      default: 'Open',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    raisedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    vendor:     { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null },
    relatedPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    relatedPayout:  { type: mongoose.Schema.Types.ObjectId, ref: 'Payout',  default: null },
    amount:         { type: Number, default: null },
    resolution:     { type: String, default: null },
    resolvedAt:     { type: Date,   default: null },
    resolvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    comments: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text:   { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

disputeSchema.index({ raisedBy: 1, createdAt: -1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ vendor: 1 });

export default mongoose.model('Dispute', disputeSchema);
