import os from 'node:os';
import multer from 'multer';
import { MAX_NOTE_BYTES, MAX_VIDEO_BYTES } from '../services/fileCheck.js';

// Small files (avatars) are held in memory and checked by their bytes.
export const uploadOne = (field, maxBytes = MAX_NOTE_BYTES) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } }).single(field);

// Notes can be videos up to 100 MB, so they go to a temp file instead of RAM.
// The controller checks the real type and per-type size, then deletes the temp file.
export const uploadNoteFile = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
}).single('file');
