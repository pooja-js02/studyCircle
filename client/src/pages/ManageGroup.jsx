import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Avatar, EmptyState, ErrorNote, Field, Modal, PageLoader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGroups } from '../context/GroupsContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { EXAMS, plural, timeAgo } from '../lib/format.js';
import NotFound from './NotFound.jsx';

function JoinRequests({ groupId }) {
  const toast = useToast();
  const [requests, setRequests] = useState(null);
  const [leaving, setLeaving] = useState({}); // id -> 'approved' | 'rejected'

  const load = useCallback(async () => {
    try {
      setRequests((await api.get(`/groups/${groupId}/requests`)).requests);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // FR-REQ-08: new requests appear live
  useSocketEvent('request:new', (p) => p.groupId === groupId && setRequests((list) => [p.request, ...(list || []).filter((r) => r._id !== p.request._id)]));
  useSocketEvent('request:reviewed', (p) => p.groupId === groupId && p.requestId && !leaving[p.requestId] && setRequests((list) => (list || []).filter((r) => r._id !== p.requestId)));

  async function review(r, action) {
    setLeaving((x) => ({ ...x, [r._id]: action === 'approve' ? 'approved' : 'rejected' }));
    try {
      await api.patch(`/groups/${groupId}/requests/${r._id}`, { action });
      setTimeout(() => setRequests((list) => list.filter((x) => x._id !== r._id)), 700);
    } catch (err) {
      setLeaving(({ [r._id]: _, ...rest }) => rest);
      toast(err.message, { tone: 'error' });
      load();
    }
  }

  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <h2 className="text-xl font-semibold">Join requests</h2>
        {requests?.length > 0 && <span className="chip bg-amber-100 text-amber-800">{requests.length} pending</span>}
      </div>
      {!requests ? (
        <PageLoader />
      ) : requests.length === 0 ? (
        <EmptyState icon="users" title="No pending requests">New requests show up here the moment someone asks to join.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => {
            const state = leaving[r._id];
            return (
              <li
                key={r._id}
                className={`flex flex-wrap items-center gap-4 rounded-2xl p-4 transition-all duration-500 ${
                  state === 'approved' ? 'translate-x-6 border border-emerald-200 bg-emerald-50 opacity-75' : state === 'rejected' ? 'translate-x-6 border border-red-200 bg-red-50 opacity-60' : 'solid card-hover'
                }`}
              >
                <Avatar user={r.user} size={48} />
                <div className="min-w-[200px] flex-1">
                  <div className="font-semibold">
                    {r.user.name} <span className="text-xs font-normal text-ink-faint">· requested {timeAgo(r.createdAt)}</span>
                  </div>
                  {state ? (
                    <div className={`mt-1 text-sm font-medium ${state === 'approved' ? 'text-emerald-700' : 'text-red-700'}`}>{state === 'approved' ? 'Approved' : 'Declined'}</div>
                  ) : r.message ? (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">“{r.message}”</p>
                  ) : (
                    <p className="mt-1 text-sm italic text-ink-faint">No message added</p>
                  )}
                </div>
                {!state && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => review(r, 'reject')} className="btn-danger btn-sm min-h-[44px]">
                      Reject
                    </button>
                    <button type="button" onClick={() => review(r, 'approve')} className="btn-success btn-sm min-h-[44px]">
                      Approve
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Members({ group, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const load = useCallback(async () => setMembers((await api.get(`/groups/${group._id}/members`)).members), [group._id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  useSocketEvent('member:joined', (p) => p.groupId === group._id && load());
  useSocketEvent('member:removed', (p) => p.groupId === group._id && load());

  async function remove(m) {
    if (!window.confirm(`Remove ${m.user.name} from ${group.name}? They lose access to chat and notes immediately.`)) return;
    try {
      await api.delete(`/groups/${group._id}/members/${m.user._id}`);
      toast(`${m.user.name} was removed.`);
      load();
      onChanged();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function transfer(m) {
    if (!window.confirm(`Make ${m.user.name} the admin of ${group.name}? You will become a regular member.`)) return;
    try {
      await api.post(`/groups/${group._id}/transfer-admin`, { userId: m.user._id });
      toast(`${m.user.name} is now the admin.`, { tone: 'success' });
      navigate(`/g/${group._id}`);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Members · {members.length}</h2>
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.user._id} className="flex flex-wrap items-center gap-3 rounded-2xl px-1 py-2">
            <Avatar user={m.user} size={38} />
            <span className="min-w-[120px] flex-1 text-sm font-semibold">
              {m.user.name}
              {m.user._id === user._id && <span className="font-normal text-ink-muted"> (you)</span>}
            </span>
            {m.role === 'admin' ? (
              <span className="chip bg-brand-100 text-brand-800">Admin</span>
            ) : (
              <span className="flex gap-1.5">
                <button type="button" onClick={() => transfer(m)} className="btn-secondary btn-sm">
                  Transfer admin
                </button>
                <button type="button" onClick={() => remove(m)} className="btn-sm btn border border-red-200 bg-white text-red-700 hover:bg-red-50">
                  Remove
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-slate-900/5 pt-3 text-xs leading-relaxed text-ink-muted">Members see only names and avatars. Emails and mobile numbers stay private.</p>
    </section>
  );
}

function Settings({ group, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: group.name, description: group.description, tags: group.tags.join(', '), privacy: group.privacy });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState(group.inviteCode);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inviteLink = `${window.location.origin}/join/${code}`;

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/groups/${group._id}`, { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) });
      toast('Group settings saved.', { tone: 'success' });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied.`, { tone: 'success' });
    } catch {
      toast(`Copy failed. ${what}: ${text}`);
    }
  }

  async function resetCode() {
    if (!window.confirm('Reset the invite code? The old code and link stop working.')) return;
    try {
      setCode((await api.post(`/groups/${group._id}/invite-code`)).inviteCode);
      toast('New invite code created.', { tone: 'success' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <section className="glass flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Group settings</h2>
      <div className="solid space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-1 text-sm font-semibold">Invite code</span>
          <code className="rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-bold tracking-[0.18em] text-brand-800">{code}</code>
          <button type="button" onClick={() => copy(code, 'Invite code')} aria-label="Copy invite code" className="rounded-xl p-2 text-ink-muted hover:bg-slate-100">
            <Icon name="copy" size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(inviteLink, 'Invite link')} className="btn-secondary btn-sm">
            <Icon name="link" size={15} /> Copy invite link
          </button>
          <button type="button" onClick={resetCode} className="btn-ghost btn-sm">
            <Icon name="retry" size={15} /> Reset code
          </button>
        </div>
        <p className="text-xs leading-relaxed text-ink-muted">Anyone with the code joins straight away, even in Approval and Invite-only groups.</p>
      </div>

      <form onSubmit={save} className="space-y-4">
        <Field label="Name">{(p) => <input {...p} className="input" minLength={3} maxLength={80} value={form.name} onChange={set('name')} />}</Field>
        <Field label="Description">{(p) => <textarea {...p} className="input min-h-[80px]" maxLength={500} value={form.description} onChange={set('description')} />}</Field>
        <Field label="Tags" hint={`Comma-separated. Exam tags (${EXAMS.join(', ').toLowerCase()}) power the Discover filters.`}>
          {(p) => <input {...p} className="input" value={form.tags} onChange={set('tags')} />}
        </Field>
        <Field label="Who can join">
          {(p) => (
            <select {...p} className="input" value={form.privacy} onChange={set('privacy')}>
              <option value="approval">Approval required</option>
              <option value="open">Open: anyone joins instantly</option>
              <option value="invite">Invite only: hidden from search</option>
            </select>
          )}
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </section>
  );
}

// FR-GRP-15: delete only after typing the group's name
function DangerZone({ group }) {
  const { refreshGroups } = useGroups();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function destroy(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.delete(`/groups/${group._id}`, { confirmName: typed });
      await refreshGroups();
      toast(`${group.name} was deleted.`);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-red-200 bg-red-50/70 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-red-900">Delete group</h2>
      <p className="mt-1 text-sm leading-relaxed text-red-900/80">Deletes the chat, notes and memberships for everyone. This can’t be undone.</p>
      <button type="button" onClick={() => setOpen(true)} className="btn-danger mt-3 bg-white">
        <Icon name="trash" size={16} /> Delete this group
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete this group?">
        <form onSubmit={destroy} className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-soft">
            Type <strong className="text-ink">{group.name}</strong> to confirm.
          </p>
          <Field label="Group name">{(p) => <input {...p} className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}</Field>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={busy || typed.trim() !== group.name} className="btn bg-red-600 text-white hover:bg-red-700">
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

export default function ManageGroup() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setGroup((await api.get(`/groups/${id}`)).group);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <NotFound title="Group not found" />;
  if (!group) return <PageLoader />;
  if (group.myRole !== 'admin') return <NotFound title="Only the group admin can manage this group" message="Ask the admin if something needs changing." />;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link to={`/g/${id}`} aria-label="Back to group" className="solid flex h-11 w-11 items-center justify-center rounded-xl">
          <Icon name="back" size={18} />
        </Link>
        <div>
          <div className="text-sm text-ink-muted">
            {group.name} · {plural(group.memberCount, 'member')}
          </div>
          <h1 className="text-3xl font-bold">Manage group</h1>
        </div>
      </header>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <JoinRequests groupId={id} />
          <Members group={group} onChanged={load} />
        </div>
        <div className="space-y-5">
          <Settings key={group.inviteCode + group.name} group={group} onSaved={load} />
          <DangerZone group={group} />
        </div>
      </div>
    </div>
  );
}
