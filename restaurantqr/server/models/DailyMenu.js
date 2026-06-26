import mongoose from 'mongoose';

const dailyMenuSchema = new mongoose.Schema(
  {
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet',
      required: true,
    },
    meals: {
      breakfast: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
      ],
      lunch: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
      ],
      fullMeal: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
      ],
      snack: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one daily menu per outlet per day
dailyMenuSchema.index({ date: 1, outlet: 1 }, { unique: true });

export default mongoose.model('DailyMenu', dailyMenuSchema);
