import mongoose from 'mongoose';

/** Lock so only one worker runs a job at a time (spec 11.2). Expires after 30 min. */
const jobLockSchema = new mongoose.Schema(
  {
    _id: { type: String },
    owner: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'jobLocks', versionKey: false },
);
jobLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const JobLock = mongoose.model('JobLock', jobLockSchema);

/** One document per job execution; /health reads the last successful daily run. */
const jobRunSchema = new mongoose.Schema(
  {
    job: { type: String, required: true },
    /** Business date the run is for (YYYY-MM-DD) or the year for yearClose. */
    runKey: { type: String, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    status: { type: String, enum: ['RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED'], required: true },
    processed: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    details: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
  },
  { collection: 'jobRuns', versionKey: false },
);
jobRunSchema.index({ job: 1, runKey: 1, status: 1 });
jobRunSchema.index({ job: 1, startedAt: -1 });
export const JobRun = mongoose.model('JobRun', jobRunSchema);
