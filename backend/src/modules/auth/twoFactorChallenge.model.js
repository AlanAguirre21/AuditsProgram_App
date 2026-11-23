import mongoose from 'mongoose';

/** One-time codes delivered through the Teams workflow (login 2FA and password reset). */
const challengeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: ['LOGIN', 'PASSWORD_RESET'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
    ip: { type: String },
  },
  { timestamps: true, collection: 'twoFactorChallenges' },
);

// Documents are removed one hour after expiring.
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
challengeSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

export const TwoFactorChallenge = mongoose.model('TwoFactorChallenge', challengeSchema);
