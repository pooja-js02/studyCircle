import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocketEvent } from '../../context/SocketContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { fileSize, timeAgo } from '../../lib/format.js';
import { Icon } from '../Icon.jsx';
import { EmptyState, ErrorNote, Spinner } from '../ui.jsx';
import NoteEditor from './NoteEditor.jsx';
import NoteViewer from './NoteViewer.jsx';

const TYPE_BADGE = {
  pdf: ['PDF', 'bg-red-50 text-red-700'],
  png: ['IMG', 'bg-violet-50 text-violet-700'],
  jpg: ['IMG', 'bg-violet-50 text-violet-700'],
  docx: ['DOC', 'bg-sky-50 text-sky-700'],
  mp4: ['VID', 'bg-amber-50 text-amber-700'],
  webm: ['VID', 'bg-amber-50 text-amber-700'],
  mov: ['VID', 'bg-amber-50 text-amber-700'],
  markdown: ['MD', 'bg-emerald-50 text-emerald-700'],
};

export default function NotesPanel({ group }) {
  const { user } = useAuth();
  const isMember = group.myState === 'joined';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const openNoteId = params.get('note');
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); // null | { note? }
  const [viewerVersion, setViewerVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (folder) qs.set('folder', folder);
      const res = await api.get(`/groups/${group._id}/notes?${qs}`);
      setNotes(res.notes);
      setFolders(res.folders);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [group._id, search, folder]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const isThis = (p) => p?.groupId === group._id;
  useSocketEvent('note:new', (p) => isThis(p) && load());
  useSocketEvent('note:updated', (p) => isThis(p) && load());
  useSocketEvent('note:deleted', (p) => isThis(p) && load());

  const openNote = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('note', id);
    else next.delete('note');
    setParams(next, { replace: !id });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-900/5 px-4 py-3 sm:px-6">
        <label className="solid flex min-w-[200px] flex-1 items-center gap-2 rounded-2xl px-3.5 text-ink-faint">
          <Icon name="search" size={16} />
          <span className="sr-only">Search notes</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or tag" className="min-h-[42px] w-full bg-transparent text-sm text-ink outline-none" />
        </label>
        <label className="sr-only" htmlFor="folder-filter">
          Folder
        </label>
        <select id="folder-filter" value={folder} onChange={(e) => setFolder(e.target.value)} className="solid min-h-[44px] rounded-2xl px-3 text-sm">
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        {isMember && (
          <button type="button" onClick={() => setEditor({})} className="btn-primary min-h-[44px] shadow-none">
            <Icon name="plus" size={18} /> Add note
          </button>
        )}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <ErrorNote>{error}</ErrorNote>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner label="Loading notes" />
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            icon="notes"
            title={search || folder ? 'No matching notes' : 'No notes yet'}
            action={isMember && !search && !folder && <button type="button" className="btn-primary mt-2" onClick={() => setEditor({})}>Add the first note</button>}
          >
            {search || folder ? 'Try another word or folder.' : 'Upload PDFs, images or Word files up to 10 MB, explanation videos up to 100 MB, or write a note in Markdown.'}
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {notes.map((n) => {
              const [badge, tone] = TYPE_BADGE[n.type === 'markdown' ? 'markdown' : n.fileType];
              return (
                <li key={n._id}>
                  <button type="button" onClick={() => openNote(n._id)} className="solid card-hover flex w-full items-start gap-3 rounded-2xl p-4 text-left">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tone}`}>{badge}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{n.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                        <Icon name="folder" size={13} /> {n.folder}
                        {n.type === 'file' && <span>· {fileSize(n.fileSize)}</span>}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-faint">
                        {n.uploadedBy?._id === user._id ? 'You' : n.uploadedBy?.name || 'Former member'} · {timeAgo(n.createdAt)}
                      </span>
                      {n.tags.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {n.tags.slice(0, 3).map((t) => (
                            <span key={t} className="chip bg-slate-100 py-0.5 text-ink-soft">
                              #{t}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {openNoteId && (
        <NoteViewer
          key={`${openNoteId}-${viewerVersion}`}
          groupId={group._id}
          noteId={openNoteId}
          canAdmin={group.myRole === 'admin'}
          onClose={() => openNote(null)}
          onEdit={(note) => setEditor({ note })}
          onDeleted={() => {
            openNote(null);
            load();
          }}
        />
      )}
      {editor && (
        <NoteEditor
          groupId={group._id}
          folders={folders}
          note={editor.note}
          onClose={() => setEditor(null)}
          onSaved={(note) => {
            const wasEdit = Boolean(editor.note);
            setEditor(null);
            load();
            if (wasEdit) {
              // Refresh the note that is already open with the saved changes
              setViewerVersion((v) => v + 1);
            } else {
              // A new note just joins the list; it opens only when someone clicks it
              toast(`“${note.title}” added to ${note.folder}.`, { tone: 'success' });
            }
          }}
        />
      )}
    </div>
  );
}
