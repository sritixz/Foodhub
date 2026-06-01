import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Office', 'Delivery Zone'],
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zoneName: {
      type: String,
      default: null,
    },
    floorDetails: [
      {
        floor: String,
        notes: String,
      },
    ],
    receptionPoints: [
      {
        name: String,
        notes: String,
      },
    ],
    deliveryFee: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Location', locationSchema);
