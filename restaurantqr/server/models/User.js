import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    organization: {
      type: String,
      default: null,
      trim: true,
    },
    role: {
      type: String,
      enum: ['Admin', 'Company Admin', 'Staff', 'Delivery Staff', 'Vendor', 'Employee', 'Investor'],
      required: true,
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      default: null,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    defaultDeliveryLocation: {
      type: String,
      default: null,
    },
    deliveryNotes: {
      type: String,
      default: null,
    },
    investmentAmount: {
      type: Number,
      default: 0,
    },
    assuredReturnRate: {
      type: Number,
      default: 18, // percentage (e.g. 18 = 18%)
    },
    profitSharePercentage: {
      type: Number,
      default: 50, // percentage (e.g. 50 = 50%)
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 });
userSchema.index({ outlet: 1 });

export default mongoose.model('User', userSchema);
