import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscount: {
      type: Number,
      default: null,
    },
    applicableOutlets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Outlet',
      },
    ],
    applyToAllOutlets: {
      type: Boolean,
      default: true,
    },
    applicableCustomerType: {
      type: String,
      enum: ['Corporate', 'Retail', 'All'],
      default: 'All',
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    badge: {
      type: String,
      default: 'HOT OFFER',
    },
    bgGradient: {
      type: [String],
      default: ['#E31B23', '#991B1B'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

promotionSchema.index({ code: 1 });
promotionSchema.index({ isActive: 1 });

export default mongoose.model('Promotion', promotionSchema);
