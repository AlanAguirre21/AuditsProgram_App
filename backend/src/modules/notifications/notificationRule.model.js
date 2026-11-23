import mongoose from 'mongoose';
import { CHANNELS, ESCALATION_TARGETS } from '../../constants/notifications.js';

const levelSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, min: 1, max: 3 },
    afterDaysOverdue: { type: Number, required: true, min: 0 },
    target: { type: String, enum: ESCALATION_TARGETS, required: true },
  },
  { _id: false },
);

const ruleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
    reminderOffsetsDays: { type: [Number], default: [14, 7, 3, 1] },
    sendOnDueDate: { type: Boolean, default: true },
    overdueRepeatEveryDays: { type: Number, default: 1, min: 1 },
    escalationLevels: { type: [levelSchema], default: [] },
    includeGroupMembers: { type: Boolean, default: false },
    channels: { type: [{ type: String, enum: CHANNELS }], default: ['TEAMS_CHAT'] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'notificationRules' },
);

// Exactly one default rule.
ruleSchema.index({ isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export const NotificationRule = mongoose.model('NotificationRule', ruleSchema);
