import mongoose from 'mongoose';

export const FILE_TYPES = ['pdf', 'png', 'jpg', 'docx', 'mp4', 'webm', 'mov'];

const noteSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['file', 'markdown'], required: true },
    // file notes
    fileType: { type: String, enum: [...FILE_TYPES, null], default: null },
    fileSize: { type: Number, default: 0 },
    originalName: { type: String, default: null },
    storage: {
      provider: { type: String, enum: ['local', 'cloudinary', null], default: null },
      key: { type: String, default: null },
      resourceType: { type: String, default: null },
    },
    // markdown notes
    content: { type: String, default: '', maxlength: 50000 },
    folder: { type: String, default: 'General', trim: true, maxlength: 60 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

noteSchema.index({ title: 'text', tags: 'text' });
noteSchema.index({ group: 1, createdAt: -1 });

export const Note = mongoose.model('Note', noteSchema);
