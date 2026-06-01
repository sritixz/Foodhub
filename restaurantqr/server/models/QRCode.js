import mongoose from 'mongoose';

const qrCodeSchema = new mongoose.Schema(
  {
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    tableNumber: {
      type: String,
      default: null, // For dine-in QR codes
    },
    qrCodeData: {
      type: String,
      required: true,
      unique: true,
    },
    qrCodeImage: {
      type: String, // URL to QR code image
      default: null,
    },
    publicUrl: {
      type: String,
      required: true,
      unique: true,
    },
    s3Url: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    scanCount: {
      type: Number,
      default: 0,
    },
    lastScanned: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

qrCodeSchema.index({ outlet: 1 });
qrCodeSchema.index({ qrCodeData: 1 });

export default mongoose.model('QRCode', qrCodeSchema);
