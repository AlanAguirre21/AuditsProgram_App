import mongoose from 'mongoose';

export const CHANGE_ENTITIES = [
  'AuditDefinition',
  'AuditOccurrence',
  'Evidence',
  'User',
  'Group',
  'NotificationRule',
  'Settings',
  'NonWorkingDay',
  'Import',
];

export const CHANGE_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'COMPLETE',
  'VALIDATE',
  'REJECT',
  'RESCHEDULE_REQUEST',
  'RESCHEDULE_APPROVE',
  'RESCHEDULE_REJECT',
  'RESCHEDULE',
  'CANCEL',
  'CLOSE_NOT_DONE',
  'REOPEN',
  'REASSIGN',
  'IMPORT',
  'ROLLOVER',
  'REGISTER',
  'LOGIN',
  'PASSWORD_RESET',
];

const changeLogSchema = new mongoose.Schema(
  {
    entity: { type: String, enum: CHANGE_ENTITIES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, enum: CHANGE_ACTIONS, required: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String },
    /** Free-form context (e.g. selfValidated, imported revision number). */
    meta: { type: mongoose.Schema.Types.Mixed },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    system: { type: Boolean, default: false },
    at: { type: Date, default: Date.now, required: true },
  },
  { collection: 'changeLog', versionKey: false },
);

changeLogSchema.index({ entity: 1, entityId: 1, at: -1 });
changeLogSchema.index({ userId: 1, at: -1 });
changeLogSchema.index({ at: -1 });

// Append-only: block updates and deletes at the model level.
const blocked = function () {
  throw new Error('changeLog is append-only');
};
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'replaceOne']) {
  changeLogSchema.pre(op, blocked);
}

export const ChangeLog = mongoose.model('ChangeLog', changeLogSchema);
