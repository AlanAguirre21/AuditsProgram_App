export const NOTIFICATION_TYPE = Object.freeze({
  REMINDER: 'REMINDER',
  DUE_TODAY: 'DUE_TODAY',
  OVERDUE: 'OVERDUE',
  ESCALATION: 'ESCALATION',
  DIGEST: 'DIGEST',
  VALIDATION_REQUEST: 'VALIDATION_REQUEST',
  VALIDATION_RESULT: 'VALIDATION_RESULT',
  RESCHEDULE_REQUEST: 'RESCHEDULE_REQUEST',
  RESCHEDULE_RESULT: 'RESCHEDULE_RESULT',
  REASSIGNED: 'REASSIGNED',
  TEST: 'TEST',
});
export const NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE);

/**
 * Delivery channels. All go through the Teams notifications workflow:
 *  TEAMS_CHAT    — 1:1 chat with the Workflows/Flow bot (main channel, always on)
 *  TEAMS_CHANNEL — Adaptive Card in the Quality channel (escalations N2/N3 and the digest)
 *  EMAIL         — optional copy sent by the workflow's Outlook step
 */
export const CHANNEL = Object.freeze({ TEAMS_CHAT: 'TEAMS_CHAT', TEAMS_CHANNEL: 'TEAMS_CHANNEL', EMAIL: 'EMAIL' });
export const CHANNELS = Object.values(CHANNEL);

export const ESCALATION_TARGETS = ['MANAGER', 'QUALITY_SUPERVISOR', 'PLANT_QUALITY_MANAGER'];

export const DEFAULT_RULE = Object.freeze({
  name: 'Regla general',
  isDefault: true,
  reminderOffsetsDays: [14, 7, 3, 1],
  sendOnDueDate: true,
  overdueRepeatEveryDays: 1,
  escalationLevels: [
    { level: 1, afterDaysOverdue: 3, target: 'MANAGER' },
    { level: 2, afterDaysOverdue: 7, target: 'QUALITY_SUPERVISOR' },
    { level: 3, afterDaysOverdue: 15, target: 'PLANT_QUALITY_MANAGER' },
  ],
  includeGroupMembers: false,
  channels: ['TEAMS_CHAT', 'TEAMS_CHANNEL'],
  active: true,
});

/** Address stored in the log for channel posts (there is no personal recipient). */
export const QUALITY_CHANNEL_ADDRESS = 'teams:quality-channel';
