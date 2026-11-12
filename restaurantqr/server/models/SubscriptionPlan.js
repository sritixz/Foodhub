import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: String,
      required: true, // e.g. '5-Day Pass', '20-Day Pass'
    },
    daysCount: {
      type: Number,
      required: true, // 5 or 20
    },
    price: {
      type: Number,
      required: true,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    savings: {
      type: String,
      default: '',
    },
    badge: {
      type: String,
      default: 'POPULAR',
    },
    badgeColor: {
      type: String,
      default: 'gold',
    },
    features: [
      {
        type: String,
      },
    ],
    applicableOutlets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Outlet',
      },
    ],
    applyToAll: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
