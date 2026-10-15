import fs from 'node:fs';
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

export function notFoundRoute(_req, _res, next) {
  next(new AppError(404, 'not_found', 'This route does not exist.'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // A large upload is parked in a temp file; never leave it behind on an error
  if (req.file?.path) fs.unlink(req.file.path, () => {});
  if (err instanceof multer.MulterError) {
    const tooLarge = err.field === 'avatar' ? 'That image is too large. Avatars can be at most 2 MB.' : 'That file is too large. Videos can be up to 100 MB, other files up to 10 MB.';
    const message = err.code === 'LIMIT_FILE_SIZE' ? tooLarge : err.message;
    return res.status(400).json({ error: { code: 'invalid_file', message } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { code: 'conflict', message: 'That already exists.' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'invalid_input', message: 'The request body is not valid JSON.' } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) } });
  }
  // NFR-PRIV-02: never echo internals (which could hold personal data) to the client
  console.error(err);
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
}
