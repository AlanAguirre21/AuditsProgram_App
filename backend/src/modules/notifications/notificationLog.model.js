import mongoose from 'mongoose';
import { CHANNELS, NOTIFICATION_TYPES } from '../../constants/notifications.js';

export const MAX_ATTEMPTS = 3;

const logSchema = new mongoose.Schema(
  {
    occurrenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Occurrence', default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    level: { type: Number, default: 0 },
    channel: { type: String, enum: CHANNELS, required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recipientAddress: { type: String, required: true },
    /** YYYY-MM-DD (Mexico City) for scheduled sends; event timestamp for event sends. */
    dateKey: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    error: { type: String },
    sentAt: { type: Date },
    dryRun: { type: Boolean, default: false },
    /** Email copy requested in the same workflow call. */
    emailCopy: { type: Boolean, default: false },
    subject: { type: String },
    /** Exact workflow payload, kept for retries. */
    payload: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  { timestamps: true, collection: 'notificationLog' },
);

// Idempotency: the same notification can't be logged (and therefore sent) twice.
logSchema.index({ occurrenceId: 1, type: 1, level: 1, channel: 1, recipientAddress: 1, dateKey: 1 }, { unique: true });
logSchema.index({ status: 1, attempts: 1 });
logSchema.index({ createdAt: -1 });

export const NotificationLog = mongoose.model('NotificationLog', logSchema);
