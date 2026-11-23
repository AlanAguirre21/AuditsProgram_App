import mongoose from 'mongoose';
import * as changelog from '../changelog/changelog.service.js';
import { SETTINGS_ID, Settings } from './settings.model.js';

/** changeLog.entityId must be an ObjectId; the single settings document uses this fixed id there. */
export const SETTINGS_ENTITY_ID = new mongoose.Types.ObjectId('000000000000000000000001');

export async function getSettings() {
  const doc = await Settings.findById(SETTINGS_ID).lean();
  if (doc) return doc;
  return Settings.findOneAndUpdate({ _id: SETTINGS_ID }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
}

const EDITABLE = [
  'plantQualityManagerId',
  'dailyJobTime',
  'digestDayOfWeek',
  'digestTime',
  'appBaseUrl',
  'lateCompletionCountsAsCompliant',
  'rescheduleAfterDueCountsAsLate',
];

export async function updateSettings(patch, user) {
  const current = await getSettings();
  const update = Object.fromEntries(Object.entries(patch).filter(([k]) => EDITABLE.includes(k)));
  const d = changelog.diff(current, update, Object.keys(update));
  if (!d.changed) return current;
  const updated = await Settings.findByIdAndUpdate(SETTINGS_ID, { $set: update }, { new: true }).lean();
  await changelog.record({ entity: 'Settings', entityId: SETTINGS_ENTITY_ID, action: 'UPDATE', before: d.before, after: d.after, user });
  return updated;
}
