import mongoose from 'mongoose';
import { CATEGORIES, EXECUTOR_TYPES } from '../../constants/auditCategories.js';

const auditDefinitionSchema = new mongoose.Schema(
  {
    code: { type: Number, required: true, min: 1 },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    category: { type: String, enum: CATEGORIES, required: true },
    name: { type: String, required: true, trim: true },
    standard: { type: String, required: true, trim: true },
    requiredBy: {
      type: [{ type: String, trim: true }],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'requiredBy necesita al menos un valor' },
    },
    ownerGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    defaultOwnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    executor: {
      type: { type: String, enum: EXECUTOR_TYPES, required: true, default: 'INTERNAL' },
      name: { type: String, required: true, trim: true },
    },
    evidenceRequired: { type: Boolean, default: true },
    requiresValidation: { type: Boolean, default: true },
    notificationRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationRule' },
    /** Network folder where the audit documents are kept ("Ruta" column in the Excel). */
    folderPath: { type: String, trim: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'auditDefinitions' },
);

auditDefinitionSchema.index({ year: 1, code: 1 }, { unique: true });
auditDefinitionSchema.index({ year: 1, category: 1 });
auditDefinitionSchema.index({ ownerGroupId: 1 });
auditDefinitionSchema.index({ requiredBy: 1 });

export const AuditDefinition = mongoose.model('AuditDefinition', auditDefinitionSchema);
