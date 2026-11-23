import mongoose from 'mongoose';
import { RESCHEDULE_STATUS, STATUS, STATUSES } from '../../constants/statuses.js';

const { ObjectId } = mongoose.Schema.Types;

const rejectionSchema = new mongoose.Schema({ by: { type: ObjectId, ref: 'User' }, at: Date, comment: String }, { _id: false });

const rescheduleRequestSchema = new mongoose.Schema(
  {
    requestedDate: Date,
    reason: String,
    requestedBy: { type: ObjectId, ref: 'User' },
    requestedAt: Date,
    status: { type: String, enum: Object.values(RESCHEDULE_STATUS) },
    resolvedBy: { type: ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolutionComment: String,
  },
  { _id: false },
);

const rescheduleHistorySchema = new mongoose.Schema(
  {
    from: Date,
    to: Date,
    reason: String,
    requestedBy: { type: ObjectId, ref: 'User' },
    approvedBy: { type: ObjectId, ref: 'User' },
    at: Date,
    /** Approved after the due date it replaced (BR-33). */
    afterDue: Boolean,
  },
  { _id: false },
);

const occurrenceSchema = new mongoose.Schema(
  {
    definitionId: { type: ObjectId, ref: 'AuditDefinition', required: true },
    year: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    originalDueDate: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: STATUS.PROGRAMADA, required: true },
    ownerUserId: { type: ObjectId, ref: 'User', required: true },
    ownerGroupId: { type: ObjectId, ref: 'Group', required: true },

    completion: {
      performedAt: Date,
      submittedAt: Date,
      submittedBy: { type: ObjectId, ref: 'User' },
      findingsSummary: { type: String, maxlength: 2000 },
      findings: {
        major: { type: Number, min: 0 },
        minor: { type: Number, min: 0 },
        observations: { type: Number, min: 0 },
      },
      externalRef: String,
      importedCompletion: Boolean,
    },
    validation: {
      validatedBy: { type: ObjectId, ref: 'User' },
      validatedAt: Date,
      selfValidated: Boolean,
      rejections: { type: [rejectionSchema], default: [] },
    },
    evidenceIds: { type: [{ type: ObjectId, ref: 'Evidence' }], default: [] },
    rescheduleRequest: { type: rescheduleRequestSchema, default: undefined },
    rescheduleHistory: { type: [rescheduleHistorySchema], default: [] },
    /** BR-33: KPI and final status are evaluated against originalDueDate. */
    evaluateAgainstOriginal: { type: Boolean, default: false },
    closure: {
      reason: String,
      closedBy: { type: ObjectId, ref: 'User' },
      closedAt: Date,
    },
    lastEscalationLevel: { type: Number, min: 0, max: 3, default: 0 },
  },
  { timestamps: true, collection: 'auditOccurrences', optimisticConcurrency: true },
);

occurrenceSchema.index({ year: 1, dueDate: 1 });
occurrenceSchema.index({ status: 1, dueDate: 1 });
occurrenceSchema.index({ ownerUserId: 1, status: 1 });
occurrenceSchema.index({ ownerGroupId: 1, status: 1 });
occurrenceSchema.index({ definitionId: 1, dueDate: 1 });
occurrenceSchema.index({ 'rescheduleRequest.status': 1 });

export const Occurrence = mongoose.model('Occurrence', occurrenceSchema);
