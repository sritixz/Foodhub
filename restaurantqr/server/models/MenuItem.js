import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
});

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      validate: {
        validator: async function(value) {
          // Check if the category exists in the database
          try {
            const category = await mongoose.model('Category').findById(value);
            return category !== null;
          } catch (error) {
            return false;
          }
        },
        message: 'Invalid category ID - category does not exist'
      }
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    foodType: {
      type: String,
      enum: ['Veg', 'Non-Veg', 'Egg', 'Jain'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Available', 'Paused', 'Draft'],
      default: 'Available',
    },
    availabilityType: {
      type: String,
      enum: ['All Day', 'Custom Time Slots'],
      default: 'All Day',
    },
    days: [
      {
        type: String,
        enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
    ],
    timeSlots: [
      {
        start: { type: String }, // 'HH:MM'
        end: { type: String },   // 'HH:MM'
      },
    ],
    stockType: {
      type: String,
      enum: ['Unlimited', 'Limited per day'],
      default: 'Unlimited',
    },
    costPrice: {
      type: Number,
      default: 0,
    },
    basePrice: {
      type: Number,
      required: true,
      default: 0,
    },
    variants: [variantSchema],
    promotions: {
      enabled: {
        type: Boolean,
        default: false,
      },
      discount: {
        type: Number,
        default: 0,
      },
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    applyToAll: {
      type: Boolean,
      default: true,
    },
    outlets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Outlet',
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('MenuItem', menuItemSchema);
