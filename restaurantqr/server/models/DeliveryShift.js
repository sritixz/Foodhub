import mongoose from 'mongoose';

const deliveryShiftSchema = new mongoose.Schema(
  {
    runner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dutyDate: {
      type: Date,
      default: Date.now,
    },
    clockInTime: {
      type: Date,
      default: Date.now,
    },
    clockOutTime: {
      type: Date,
    },
    totalOnlineMinutes: {
      type: Number,
      default: 0,
    },
    onBreakMinutes: {
      type: Number,
      default: 0,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    onTimeDeliveries: {
      type: Number,
      default: 0,
    },
    slaRate: {
      type: Number,
      default: 100.0,
    },
    campus: {
      type: String,
      default: 'Embassy TechVillage',
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Abandoned'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

deliveryShiftSchema.index({ runner: 1, dutyDate: -1 });

const DeliveryShift = mongoose.model('DeliveryShift', deliveryShiftSchema);
export default DeliveryShift;
