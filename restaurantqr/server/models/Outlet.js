import mongoose from 'mongoose';

const outletSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    outletId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fssaiLicense: {
      type: String,
      required: true,
      trim: true,
    },
    businessType: {
      type: String,
      enum: ['Dine-In', 'Delivery-Only', 'Restaurant', 'Cafe', 'Bakery'],
      required: true,
    },
    contact: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
      },
      phone: {
        type: String,
        required: true,
      },
    },
    location: {
      address: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      zone: {
        type: String,
        enum: ['North Zone', 'South Zone', 'East Zone', 'West Zone'],
        required: true,
      },
      totalOutlets: {
        type: Number,
        default: 1,
      },
    },
    documents: {
      rentAgreement: {
        type: String, // URL or file path
        default: null,
      },
      fssaiLicense: {
        type: String,
        default: null,
      },
      otherDocs: [
        {
          type: String,
        },
      ],
    },
    sales: {
      today: {
        type: Number,
        default: 0,
      },
      monthly: {
        type: Number,
        default: 0,
      },
    },
    commissionRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryZones: [
      {
        type: String,
      },
    ],
    operatingHours: {
      open: {
        type: String,
        default: '09:00',
      },
      close: {
        type: String,
        default: '22:00',
      },
    },
    logo: {
      type: String,
      default: null,
    },
    qrCode: {
      type: String, // QR code URL or data
      default: null,
    },
    qrCodeUrl: {
      type: String, // Public URL for QR code scanning
      default: null,
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

export default mongoose.model('Outlet', outletSchema);
