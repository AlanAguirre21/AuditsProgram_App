import mongoose from 'mongoose';

const importSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    year: { type: Number, required: true },
    status: { type: String, enum: ['PREVIEW', 'CONFIRMED', 'DISCARDED'], default: 'PREVIEW' },
    /** { definitions, changeHistory, fileCounts, detectedYear } — see imports.service. */
    parsed: { type: mongoose.Schema.Types.Mixed, required: true },
    confirmedAt: { type: Date },
    /** TTL: previews are deleted after 24 h. Cleared once confirmed. */
    expiresAt: { type: Date },
  },
  { timestamps: true, collection: 'imports', minimize: false },
);

importSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Import = mongoose.model('Import', importSchema);
