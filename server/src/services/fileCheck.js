import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';

export const MAX_NOTE_BYTES = 10 * 1024 * 1024; // FR-NOTE-01: documents and images
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // explanation videos (Cloudinary free-tier upload limit)
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export const VIDEO_TYPES = ['mp4', 'webm', 'mov'];
export const isVideo = (ext) => VIDEO_TYPES.includes(ext);
export const maxBytesFor = (ext) => (isVideo(ext) ? MAX_VIDEO_BYTES : MAX_NOTE_BYTES);

const pick = (detected, allowed) => {
  const ext = detected && MIME_TO_EXT[detected.mime];
  return ext && allowed.includes(ext) ? ext : null;
};

/**
 * FR-NOTE-02 / NFR-SEC-08: decide the type from the file's bytes, never from
 * its name or the browser's claimed MIME type.
 * @returns {Promise<string|null>} pdf | png | jpg | docx | mp4 | webm | mov, or null when not allowed
 */
export async function detectFileType(buffer, allowed = Object.values(MIME_TO_EXT)) {
  return pick(await fileTypeFromBuffer(buffer), allowed);
}

export async function detectFileTypeFromPath(path, allowed = Object.values(MIME_TO_EXT)) {
  return pick(await fileTypeFromFile(path), allowed);
}

export const CONTENT_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};
