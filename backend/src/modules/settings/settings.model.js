import mongoose from 'mongoose';

export const SETTINGS_ID = 'global';

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: SETTINGS_ID },
    plantQualityManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** AES-256-GCM encrypted (Phase 4). */
    teamsWebhookUrl: { type: String },
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
