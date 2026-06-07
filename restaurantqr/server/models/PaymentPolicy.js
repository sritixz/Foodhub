import mongoose from 'mongoose';

const paymentPolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    organization: { type: String, default: null }, // Company Admin scope
    monthlyLimit:       { type: Number, default: null }, // per employee, null = unlimited
    singleTxLimit:      { type: Number, default: null }, // max single transaction
    requiresApproval:   { type: Boolean, default: true },
    approvalThreshold:  { type: Number, default: 0 },   // auto-approve below this amount
    allowedCategories: {
      type: [String],
      default: ['Food', 'Travel', 'Office', 'Utilities', 'Salary', 'Bonus', 'Other'],
    },
    autoPayoutEnabled:  { type: Boolean, default: false },
    autoPayoutDay:      { type: Number, default: 1, min: 1, max: 28 }, // day of month
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('PaymentPolicy', paymentPolicySchema);
