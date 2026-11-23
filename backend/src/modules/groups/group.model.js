import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    memberIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    escalationContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'groups' },
);

groupSchema.index({ memberIds: 1 });

export const Group = mongoose.model('Group', groupSchema);
