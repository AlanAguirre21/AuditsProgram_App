import mongoose from 'mongoose';
import { ROLE, ROLES } from '../../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    employeeNumber: { type: String, trim: true },
    department: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    roles: { type: [{ type: String, enum: ROLES }], default: [ROLE.VIEWER] },
    isQualitySupervisor: { type: Boolean, default: false },
    notificationPrefs: {
      /** Optional email copy (only when the global email switch is on). Teams chat is always on. */
      email: { type: Boolean, default: false },
      teams: { type: Boolean, default: true },
    },
    passwordHash: { type: String, select: false },
    passwordChangedAt: { type: Date },
    /** Incremented on password change/reset: tokens carrying an older version are revoked. */
    sessionVersion: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ roles: 1, active: 1 });
userSchema.index({ name: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);

/** Public projection for embedding users in other payloads. */
export const USER_PUBLIC_FIELDS = 'name email department jobTitle active';
