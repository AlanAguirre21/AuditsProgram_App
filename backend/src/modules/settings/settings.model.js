import mongoose from 'mongoose';

export const SETTINGS_ID = 'global';

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: SETTINGS_ID },
    plantQualityManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Global switch for the optional email copy (sent by the Teams workflow's Outlook step). */
    emailEnabled: { type: Boolean, default: false },
    /** Post N2/N3 escalations and the weekly digest as cards in the Quality Teams channel. */
    qualityChannelEnabled: { type: Boolean, default: true },
    dailyJobTime: { type: String, default: '07:00' },
    digestDayOfWeek: { type: Number, default: 1, min: 0, max: 6 },
    digestTime: { type: String, default: '08:00' },
    appBaseUrl: { type: String },
    lateCompletionCountsAsCompliant: { type: Boolean, default: false },
    rescheduleAfterDueCountsAsLate: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'settings' },
);

export const Settings = mongoose.model('Settings', settingsSchema);
