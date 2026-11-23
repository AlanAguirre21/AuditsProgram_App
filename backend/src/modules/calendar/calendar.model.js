import mongoose from 'mongoose';

const nonWorkingDaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true },
    description: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
  },
  { timestamps: true, collection: 'nonWorkingDays' },
);

nonWorkingDaySchema.index({ year: 1 });

export const NonWorkingDay = mongoose.model('NonWorkingDay', nonWorkingDaySchema);
