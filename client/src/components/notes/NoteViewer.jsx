import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api, API_URL } from '../../lib/api.js';
import { fileSize, timeAgo } from '../../lib/format.js';
import { Icon } from '../Icon.jsx';
import { Avatar, ErrorNote, Modal, Spinner } from '../ui.jsx';

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const VIDEO = ['mp4', 'webm', 'mov'];

// A short-lived personal link, because <video> can't send the session header
async function fileLink(groupId, noteId) {
  const { url } = await api.get(`/groups/${groupId}/notes/${noteId}/file-link`);
  return `${API_URL}${url}`;
}

// FR-NOTE-05: PDFs, images and videos open in the app; every file can be downloaded
export default function NoteViewer({ groupId, noteId, canAdmin, onClose, onEdit, onDeleted }) {
  const { user } = useAuth();
  const toast = useToast();
  const [note, setNote] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url;
    let cancelled = false;
    setNote(null);
    setFileUrl(null);
    setError('');
    (async () => {
      try {
        const res = await api.get(`/groups/${groupId}/notes/${noteId}`);
        if (cancelled) return;
        setNote(res.note);
        if (res.note.type === 'file' && VIDEO.includes(res.note.fileType)) {
          // Videos stream (with seeking) instead of downloading whole first
          const link = await fileLink(groupId, noteId);
          if (!cancelled) setFileUrl(link);
        } else if (res.note.type === 'file') {
          // Files are fetched with the session token, never through a public URL
          const b = await api.blob(`/groups/${groupId}/notes/${noteId}/file`);
          if (cancelled) return;
          setBlob(b);
          if (res.note.fileType !== 'docx') {
            url = URL.createObjectURL(b);
            setFileUrl(url);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [groupId, noteId]);

  const isUploader = note?.uploadedBy?._id === user._id;
  const isSuperadmin = user.platformRole === 'superadmin';
  // FR-NOTE-07: the uploader, the group admin or the platform superadmin
  const canDelete = isUploader || canAdmin || isSuperadmin;
  const isVideo = note?.type === 'file' && VIDEO.includes(note.fileType);
  const downloadName = note && (note.originalName || `${note.title}.${note.fileType}`);

  async function remove() {
    const who = isUploader ? '' : isSuperadmin && !canAdmin ? ' as StudyCircle superadmin' : ' as group admin';
    if (!window.confirm(`Delete “${note.title}”${who}? It is removed for everyone in the group.`)) return;
    setBusy(true);
    try {
      await api.delete(`/groups/${groupId}/notes/${noteId}`);
      toast('Note deleted.', { tone: 'success' });
      onDeleted();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={note?.title || 'Note'} width="max-w-4xl">
      <ErrorNote>{error}</ErrorNote>
      {!note && !error && (
        <div className="flex justify-center py-16">
          <Spinner label="Opening note" />
        </div>
      )}
      {note && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
            <span className="flex items-center gap-2">
              <Avatar user={note.uploadedBy || { name: '?' }} size={28} />
              {isUploader ? 'You' : note.uploadedBy?.name || 'Former member'} · {timeAgo(note.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="folder" size={15} /> {note.folder}
            </span>
            {note.type === 'file' && <span>{fileSize(note.fileSize)}</span>}
            {note.tags.map((t) => (
              <span key={t} className="chip bg-slate-100 text-ink-soft">
                #{t}
              </span>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
            {note.type === 'markdown' && (
              <div className="prose-note p-5 sm:p-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                  {note.content}
                </ReactMarkdown>
              </div>
            )}
            {note.type === 'file' && note.fileType === 'pdf' && (fileUrl ? <iframe title={note.title} src={fileUrl} className="h-[65vh] w-full" /> : <div className="flex justify-center py-16"><Spinner label="Loading PDF" /></div>)}
            {note.type === 'file' && ['png', 'jpg'].includes(note.fileType) && (fileUrl ? <img src={fileUrl} alt={note.title} className="mx-auto max-h-[65vh] object-contain" /> : <div className="flex justify-center py-16"><Spinner label="Loading image" /></div>)}
            {isVideo &&
              (fileUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={fileUrl} controls preload="metadata" playsInline className="max-h-[65vh] w-full bg-black" />
              ) : (
                <div className="flex justify-center py-16">
                  <Spinner label="Loading video" />
                </div>
              ))}
            {note.type === 'file' && note.fileType === 'docx' && (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Icon name="file" size={26} />
                </span>
                <p className="font-semibold">Word document</p>
                <p className="max-w-sm text-sm text-ink-muted">Word files can’t be previewed in the browser. Download it to open in Word or Google Docs.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {canDelete && (
              <button type="button" onClick={remove} disabled={busy} className="btn-danger mr-auto">
                <Icon name="trash" size={16} /> Delete
              </button>
            )}
            {isUploader && (
              <button type="button" onClick={() => onEdit(note)} className="btn-secondary">
                <Icon name="edit" size={16} /> Edit
              </button>
            )}
            {isVideo && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    window.location.assign(`${await fileLink(groupId, noteId)}?download=1`);
                  } catch (err) {
                    toast(err.message, { tone: 'error' });
                  }
                }}
                className="btn-primary"
              >
                <Icon name="download" size={16} /> Download
              </button>
            )}
            {note.type === 'file' && !isVideo && (
              <button type="button" disabled={!blob} onClick={() => saveBlob(blob, downloadName)} className="btn-primary">
                <Icon name="download" size={16} /> Download
              </button>
            )}
            {note.type === 'markdown' && (
              <button type="button" onClick={() => saveBlob(new Blob([note.content], { type: 'text/markdown' }), `${note.title}.md`)} className="btn-secondary">
                <Icon name="download" size={16} /> Download .md
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
