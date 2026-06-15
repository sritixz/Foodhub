import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: null,
      trim: true,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    type: {
      type: String,
      enum: ['menu_download', 'newsletter_subscribe'],
      default: 'menu_download',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'dropped'],
      default: 'new',
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

leadSchema.index({ type: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });

export default mongoose.model('Lead', leadSchema);
