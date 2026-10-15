import { useState } from 'react';
import { api } from '../../lib/api.js';
import { fileSize } from '../../lib/format.js';
import { Icon } from '../Icon.jsx';
import { ErrorNote, Field, Modal } from '../ui.jsx';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_EXT = ['mp4', 'webm', 'mov'];
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'docx', ...VIDEO_EXT];
const ACCEPT = `${ALLOWED_EXT.map((e) => `.${e}`).join(',')},application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/webm,video/quicktime`;

// FR-NOTE-01..04 create, and FR-NOTE-07 edit (uploader only)
export default function NoteEditor({ groupId, folders, note, onClose, onSaved }) {
  const editing = Boolean(note);
  const [mode, setMode] = useState(note?.type === 'markdown' ? 'markdown' : 'file');
  const [form, setForm] = useState({
    title: note?.title || '',
    folder: note?.folder || '',
    tags: note?.tags?.join(', ') || '',
    content: note?.content || '',
  });
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function pick(e) {
    const f = e.target.files?.[0];
    setFileError('');
    if (!f) return setFile(null);
    const ext = f.name.split('.').pop().toLowerCase();
    // Quick feedback only; the server checks the real bytes (FR-NOTE-02)
    if (!ALLOWED_EXT.includes(ext)) {
      setFile(null);
      return setFileError('Only PDF, PNG, JPG, DOCX files or MP4, WebM, MOV videos can be uploaded.');
    }
    const video = VIDEO_EXT.includes(ext);
    if (f.size > (video ? MAX_VIDEO_BYTES : MAX_BYTES)) {
      setFile(null);
      return setFileError(`That file is ${fileSize(f.size)}. The limit is ${video ? '100 MB for videos' : '10 MB'}.`);
    }
    setFile(f);
    if (!form.title) setForm((x) => ({ ...x, title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Give the note a title.');
    if (!editing && mode === 'file' && !file) return setError('Choose a file to upload.');
    if (mode === 'markdown' && !form.content.trim()) return setError('Write something in the note.');
    setSaving(true);
    try {
      let res;
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (editing) {
        res = await api.patch(`/groups/${groupId}/notes/${note._id}`, {
          title: form.title,
          folder: form.folder || 'General',
          tags,
          ...(note.type === 'markdown' && { content: form.content }),
        });
      } else if (mode === 'file') {
        const data = new FormData();
        data.append('title', form.title);
        data.append('folder', form.folder || 'General');
        data.append('tags', tags.join(','));
        data.append('file', file);
        res = await api.upload(`/groups/${groupId}/notes`, data);
      } else {
        res = await api.post(`/groups/${groupId}/notes`, { title: form.title, folder: form.folder || 'General', tags, content: form.content });
      }
      onSaved(res.note);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit note' : 'Add a note'} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        {!editing && (
          <div role="tablist" aria-label="Note type" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
            {[
              ['file', 'upload', 'Upload a file'],
              ['markdown', 'edit', 'Write in Markdown'],
            ].map(([key, icon, label]) => (
              <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)} className={`flex min-h-[40px] items-center justify-center gap-2 rounded-xl text-sm font-semibold ${mode === key ? 'bg-white shadow-sm' : 'text-ink-muted'}`}>
                <Icon name={icon} size={16} /> {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'file' && !editing && (
          <div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-8 text-center hover:border-brand-500">
              <Icon name="upload" size={26} className="text-brand-600" />
              <span className="text-sm font-semibold">{file ? file.name : 'Choose a file'}</span>
              <span className="text-xs text-ink-muted">{file ? fileSize(file.size) : 'PDF, PNG, JPG, DOCX up to 10 MB · explanation videos (MP4, WebM, MOV) up to 100 MB'}</span>
              <input type="file" accept={ACCEPT} onChange={pick} className="sr-only" />
            </label>
            {fileError && <p className="mt-1.5 text-xs font-medium text-red-700">{fileError}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title">{(p) => <input {...p} className="input" maxLength={120} value={form.title} onChange={set('title')} placeholder="Rotational motion PYQs" />}</Field>
          </div>
          <Field label="Folder or chapter" hint="Pick one or type a new name">
            {(p) => (
              <>
                <input {...p} className="input" list="note-folders" maxLength={60} value={form.folder} onChange={set('folder')} placeholder="Mechanics" />
                <datalist id="note-folders">
                  {folders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Tags" hint="Comma-separated">
            {(p) => <input {...p} className="input" value={form.tags} onChange={set('tags')} placeholder="pyq, rotation" />}
          </Field>
        </div>

        {mode === 'markdown' && (
          <Field label="Note" hint="Markdown: # headings, **bold**, - lists, | tables |">
            {(p) => <textarea {...p} className="input min-h-[220px] font-mono text-[13px] leading-relaxed" maxLength={50000} value={form.content} onChange={set('content')} placeholder={'# Torque\n\n- τ = r × F\n- L = Iω'} />}
          </Field>
        )}

        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (mode === 'file' && !editing ? 'Uploading…' : 'Saving…') : editing ? 'Save changes' : 'Add note'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
