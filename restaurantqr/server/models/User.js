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
    companyCategory: {
      type: String,
      enum: ['Corporate Client', 'Commercial/Office Complex'],
      default: 'Corporate Client',
    },
    assignedCompany: {
      type: String,
      default: null,
      trim: true,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    walletTransactions: [
      {
        amount: { type: Number, required: true },
        type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
        description: { type: String, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
    offers: [
      {
        code: { type: String, required: true },
        title: { type: String, required: true },
        discountPercent: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        isUsed: { type: Boolean, default: false },
        validUntil: { type: Date },
      },
    ],
    role: {
      type: String,
      enum: ['Owner', 'Management', 'Central Kitchen Manager', 'Outlet Sales Representative', 'Driver', 'Investment Partner', 'Non-Core Staff', 'Customer'],
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
