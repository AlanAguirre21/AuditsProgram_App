import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    occurrenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Occurrence', required: true },
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
  },
  { timestamps: true, collection: 'evidence' },
);

evidenceSchema.index({ occurrenceId: 1 });

export const Evidence = mongoose.model('Evidence', evidenceSchema);
