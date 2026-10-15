import { useState } from 'react';
import { useGroups } from '../context/GroupsContext.jsx';
import { api } from '../lib/api.js';
import { EXAMS } from '../lib/format.js';
import { ErrorNote, Field, Modal } from './ui.jsx';

const PRIVACY_OPTIONS = [
  { value: 'approval', title: 'Approval', body: 'Anyone can find it; you approve who joins.' },
  { value: 'open', title: 'Open', body: 'Anyone can find it and join instantly.' },
  { value: 'invite', title: 'Invite only', body: 'Hidden from search; join with the invite code.' },
];

// FR-GRP-01: name, description, subject tags and privacy mode
export default function CreateGroupModal({ open, onClose, onCreated }) {
  const { refreshGroups } = useGroups();
  const [form, setForm] = useState({ name: '', description: '', tags: '', privacy: 'approval' });
  const [exam, setExam] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleExam = (x) => setExam((list) => (list.includes(x) ? list.filter((e) => e !== x) : [...list, x]));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const tags = [...exam, ...form.tags.split(',')].map((t) => t.trim().toLowerCase()).filter(Boolean);
      const res = await api.post('/groups', { ...form, tags });
      await refreshGroups();
      setForm({ name: '', description: '', tags: '', privacy: 'approval' });
      setExam([]);
      onCreated(res.group);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a study group">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Group name">{(p) => <input {...p} className="input" required minLength={3} maxLength={80} value={form.name} onChange={set('name')} placeholder="JEE Physics ’26" />}</Field>
        <Field label="Description" hint="What will the group study, and who is it for?">
          {(p) => <textarea {...p} className="input min-h-[84px] resize-y" maxLength={500} value={form.description} onChange={set('description')} placeholder="Daily PYQ grind for mechanics and electrostatics." />}
        </Field>
        <fieldset>
          <legend className="label">Exam</legend>
          <div className="flex flex-wrap gap-2">
            {EXAMS.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={exam.includes(x.toLowerCase())}
                onClick={() => toggleExam(x.toLowerCase())}
                className={`min-h-[36px] rounded-full px-4 text-sm font-semibold transition ${exam.includes(x.toLowerCase()) ? 'bg-brand-600 text-white' : 'solid text-ink-soft hover:bg-white'}`}
              >
                {x}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Subject tags" hint="Comma-separated, e.g. physics, mechanics">
          {(p) => <input {...p} className="input" value={form.tags} onChange={set('tags')} placeholder="physics, mechanics" />}
        </Field>
        <fieldset>
          <legend className="label">Who can join</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRIVACY_OPTIONS.map((o) => (
              <label key={o.value} className={`cursor-pointer rounded-2xl border p-3 text-sm transition ${form.privacy === o.value ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-200'}`}>
                <input type="radio" name="privacy" value={o.value} checked={form.privacy === o.value} onChange={set('privacy')} className="sr-only" />
                <span className="block font-semibold">{o.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{o.body}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
