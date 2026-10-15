import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

// Cloudinary in production (CLOUDINARY_URL set), local disk otherwise (Docker volume).
// Files are never served publicly: the API streams them to group members only.
const useCloudinary = Boolean(env.cloudinaryUrl);
if (useCloudinary) {
  // Configure explicitly: the SDK only reads CLOUDINARY_URL when it is first imported,
  // which happens before dotenv has loaded server/.env
  const u = new URL(env.cloudinaryUrl.trim());
  cloudinary.config({
    cloud_name: u.hostname,
    api_key: decodeURIComponent(u.username),
    api_secret: decodeURIComponent(u.password),
    secure: true,
  });
}

const localRoot = path.resolve(env.uploadDir);

export const storageProvider = useCloudinary ? 'cloudinary' : 'local';

const resourceTypeFor = (ext) => (['png', 'jpg'].includes(ext) ? 'image' : ['mp4', 'webm', 'mov'].includes(ext) ? 'video' : 'raw');

function localPath(storage) {
  const full = path.join(localRoot, storage.key);
  if (!full.startsWith(localRoot)) throw new Error('Invalid storage key');
  return full;
}

/**
 * Stores a file given as a Buffer or as a temp-file path (large uploads).
 * @returns {Promise<{provider, key, resourceType}>}
 */
export async function saveFile(source, { folder, ext }) {
  const id = crypto.randomUUID();
  const fromPath = typeof source === 'string';
  if (useCloudinary) {
    const resourceType = resourceTypeFor(ext);
    const options = {
      folder: `studycircle/${folder}`,
      public_id: resourceType === 'raw' ? `${id}.${ext}` : id,
      resource_type: resourceType,
      type: 'authenticated', // not reachable without a signed URL
    };
    const result = fromPath
      ? await cloudinary.uploader.upload(source, options)
      : await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(options, (err, res) => (err ? reject(err) : resolve(res)));
          Readable.from(source).pipe(stream);
        });
    return { provider: 'cloudinary', key: result.public_id, resourceType };
  }
  await fs.mkdir(path.join(localRoot, folder), { recursive: true });
  const key = path.join(folder, `${id}.${ext}`);
  if (fromPath) await fs.copyFile(source, path.join(localRoot, key));
  else await fs.writeFile(path.join(localRoot, key), source);
  return { provider: 'local', key, resourceType: null };
}

/**
 * Signed Cloudinary download URL that expires in an hour. It goes through Cloudinary's
 * API rather than its CDN, so it also works for PDFs (which new free accounts block on
 * the CDN) and it supports range requests for video seeking.
 */
export function signedUrl(storage, ext, { download = false } = {}) {
  return cloudinary.utils.private_download_url(storage.key, storage.resourceType === 'raw' ? '' : ext, {
    resource_type: storage.resourceType,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    attachment: download || undefined,
  });
}

/** Returns a readable stream of the stored file. */
export async function readFile(storage, ext) {
  if (storage.provider === 'cloudinary') {
    const res = await fetch(signedUrl(storage, ext));
    if (!res.ok) throw new Error(`Storage fetch failed: ${res.status}`);
    return Readable.fromWeb(res.body);
  }
  const handle = await fs.open(localPath(storage));
  return handle.createReadStream();
}

/** Local files only: byte size, for range responses (video seeking). */
export async function localFileSize(storage) {
  return (await fs.stat(localPath(storage))).size;
}

/** Local files only: a stream of the whole file or of { start, end } bytes. */
export function readLocalRange(storage, range) {
  return createReadStream(localPath(storage), range || undefined);
}

export async function deleteFile(storage) {
  if (!storage?.key) return;
  try {
    if (storage.provider === 'cloudinary') {
      await cloudinary.uploader.destroy(storage.key, { resource_type: storage.resourceType, type: 'authenticated', invalidate: true });
    } else {
      await fs.unlink(localPath(storage));
    }
  } catch (err) {
    console.warn('File delete failed', storage.key, err.message);
  }
}
