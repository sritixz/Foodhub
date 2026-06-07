import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['employee_expense', 'vendor_payout', 'commission', 'refund', 'advance'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    description: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Processing', 'Paid', 'Rejected', 'Disputed'],
      default: 'Pending',
    },
    // Payer / payee
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    vendor:      { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null },
    outlet:      { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', default: null },
    // Reference links
    relatedOrder:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    relatedPayout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout', default: null },
    // Employee payment fields
    category: {
      type: String,
      enum: ['Food', 'Travel', 'Office', 'Utilities', 'Salary', 'Bonus', 'Other'],
      default: 'Other',
    },
    receiptUrl: { type: String, default: null },
    // Tracking
    paidAt:    { type: Date, default: null },
    rejectedAt:{ type: Date, default: null },
    notes:     { type: String, default: null },
    // Dispute
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute', default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ requestedBy: 1, createdAt: -1 });
paymentSchema.index({ vendor: 1, status: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
