import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { Group, Membership, Note, User } from '../models/index.js';
import { CONTENT_TYPES, detectFileTypeFromPath, isVideo, maxBytesFor } from '../services/fileCheck.js';
import { notify } from '../services/notificationService.js';
import { emitToGroup } from '../services/realtime.js';
import { deleteFile, localFileSize, readFile, readLocalRange, saveFile, signedUrl } from '../services/storageService.js';
import { signFileToken, verifyFileToken } from '../services/tokenService.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/AppError.js';
import { publicUser, PUBLIC_USER_FIELDS } from '../utils/publicUser.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function serializeNote(n, { withContent = false } = {}) {
  return {
    _id: String(n._id),
    group: String(n.group),
    title: n.title,
    type: n.type,
    fileType: n.fileType,
    fileSize: n.fileSize,
    originalName: n.originalName,
    folder: n.folder,
    tags: n.tags,
    uploadedBy: publicUser(n.uploadedBy),
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    ...(withContent && n.type === 'markdown' && { content: n.content }),
  };
}

async function findNote(req) {
  const { noteId } = req.params;
  if (!mongoose.isValidObjectId(noteId)) throw notFound('Note not found.');
  const note = await Note.findOne({ _id: noteId, group: req.group._id }).populate('uploadedBy', PUBLIC_USER_FIELDS);
  if (!note) throw notFound('Note not found.');
  return note;
}

// FR-NOTE-06: search by title and tag, filter by folder
export async function listNotes(req, res) {
  const { search, folder, tag } = req.validQuery;
  const filter = { group: req.group._id };
  if (folder) filter.folder = folder;
  if (tag) filter.tags = tag;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: rx }, { tags: rx }];
  }
  const [notes, folders] = await Promise.all([
    Note.find(filter).sort({ createdAt: -1 }).limit(200).populate('uploadedBy', PUBLIC_USER_FIELDS).lean(),
    Note.distinct('folder', { group: req.group._id }),
  ]);
  res.json({ notes: notes.map((n) => serializeNote(n)), folders: folders.sort() });
}

export async function getNote(req, res) {
  const note = await findNote(req);
  res.json({ note: serializeNote(note, { withContent: true }) });
}

// FR-NOTE-01..04: a file upload (multipart "file") or a Markdown note (JSON "content")
export async function createNote(req, res) {
  const tempPath = req.file?.path;
  try {
    const { title, folder, tags, content } = req.body;
    const base = { group: req.group._id, uploadedBy: req.user.id, title, folder, tags };
    let note;

    if (req.file) {
      // FR-NOTE-02: type and size are checked from the bytes on the server
      const ext = await detectFileTypeFromPath(tempPath);
      if (!ext) throw badRequest('Only PDF, PNG, JPG, DOCX files and MP4, WebM or MOV videos can be uploaded.');
      if (req.file.size > maxBytesFor(ext)) {
        throw badRequest(isVideo(ext) ? 'That video is too large. The limit is 100 MB.' : 'That file is too large. The limit is 10 MB.');
      }
      const storage = await saveFile(tempPath, { folder: `notes/${req.group._id}`, ext });
      note = await Note.create({ ...base, type: 'file', fileType: ext, fileSize: req.file.size, originalName: req.file.originalname.slice(0, 200), storage });
    } else {
      if (!content?.trim()) throw badRequest('Write something in the note, or attach a file.');
      note = await Note.create({ ...base, type: 'markdown', content });
    }

    await Group.updateOne({ _id: req.group._id }, { $inc: { notesCount: 1 } });
    await note.populate('uploadedBy', PUBLIC_USER_FIELDS);
    const payload = serializeNote(note);
    emitToGroup(req.group._id, 'note:new', { groupId: String(req.group._id), note: payload });

    const members = await Membership.find({ group: req.group._id, isMuted: false }).select('user').lean();
    await notify(
      members.map((m) => m.user),
      { type: 'new_note', group: req.group._id, groupName: req.group.name, actor: req.user.id, refId: note._id, text: `New note in ${req.group.name}: ${title}` }
    );
    res.status(201).json({ note: payload });
  } finally {
    if (tempPath) await fs.unlink(tempPath).catch(() => {});
  }
}

// FR-NOTE-07: only the uploader edits
export async function updateNote(req, res) {
  const note = await findNote(req);
  if (String(note.uploadedBy._id) !== req.user.id) throw forbidden('Only the person who added this note can edit it.');
  const { title, folder, tags, content } = req.body;
  if (title !== undefined) note.title = title;
  if (folder !== undefined) note.folder = folder;
  if (tags !== undefined) note.tags = tags;
  if (content !== undefined) {
    if (note.type !== 'markdown') throw badRequest('Only Markdown notes have editable text.');
    note.content = content;
  }
  await note.save();
  emitToGroup(req.group._id, 'note:updated', { groupId: String(req.group._id), noteId: String(note._id) });
  res.json({ note: serializeNote(note, { withContent: true }) });
}

// FR-NOTE-07: the uploader, the group admin or the platform superadmin deletes
export async function deleteNote(req, res) {
  const note = await findNote(req);
  const isUploader = String(note.uploadedBy._id) === req.user.id;
  const isGroupAdmin = req.membership?.role === 'admin';
  const isSuperadmin = req.user.role === 'superadmin';
  if (!isUploader && !isGroupAdmin && !isSuperadmin) {
    throw forbidden('Only the uploader, the group admin or a StudyCircle superadmin can delete this note.');
  }
  await note.deleteOne();
  await Group.updateOne({ _id: req.group._id }, { $inc: { notesCount: -1 } });
  if (note.type === 'file') await deleteFile(note.storage);
  emitToGroup(req.group._id, 'note:deleted', { groupId: String(req.group._id), noteId: String(note._id) });
  res.status(204).end();
}

function sendHeaders(res, note, download) {
  const filename = (note.originalName || `${note.title}.${note.fileType}`).replace(/["\r\n]/g, '');
  res.setHeader('Content-Type', CONTENT_TYPES[note.fileType]);
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
}

// FR-NOTE-05: files stream only to members, for the in-app viewer and download
export async function streamNoteFile(req, res) {
  const note = await findNote(req);
  if (note.type !== 'file') throw notFound('This note has no file.');
  const stream = await readFile(note.storage, note.fileType);
  sendHeaders(res, note, req.query.download);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

// A short-lived URL for <video src> and direct downloads
export async function fileLink(req, res) {
  const note = await findNote(req);
  if (note.type !== 'file') throw notFound('This note has no file.');
  const token = signFileToken({ userId: req.user.id, noteId: note._id });
  res.json({ url: `/api/files/${token}`, expiresIn: 900 });
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m) return null;
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] === '' || m[2] === '' ? size - 1 : Number(m[2]);
  end = Math.min(end, size - 1);
  if (Number.isNaN(start) || start < 0 || start > end) return 'invalid';
  return { start, end };
}

export async function serveFileByToken(req, res) {
  let payload;
  try {
    payload = verifyFileToken(req.params.token);
  } catch {
    throw new AppError(401, 'link_expired', 'This file link has expired. Open the note again.');
  }
  const note = await Note.findById(payload.nid);
  if (!note || note.type !== 'file') throw notFound('Note not found.');
  // Access is re-checked now: a member removed after the link was made loses it
  const [member, user] = await Promise.all([
    Membership.exists({ group: note.group, user: payload.sub }),
    User.findById(payload.sub).select('platformRole isBanned').lean(),
  ]);
  if (!user || user.isBanned || (!member && user.platformRole !== 'superadmin')) throw forbidden();

  if (note.storage.provider === 'cloudinary') {
    // Cloudinary serves ranges itself; the signed URL is only valid for this file
    return res.redirect(302, signedUrl(note.storage, note.fileType, { download: Boolean(req.query.download) }));
  }

  sendHeaders(res, note, req.query.download);
  res.setHeader('Accept-Ranges', 'bytes');
  const size = await localFileSize(note.storage);
  const range = req.headers.range ? parseRange(req.headers.range, size) : null;
  if (range === 'invalid') {
    res.setHeader('Content-Range', `bytes */${size}`);
    return res.status(416).end();
  }
  const stream = readLocalRange(note.storage, range);
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
  } else {
    res.setHeader('Content-Length', size);
  }
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
