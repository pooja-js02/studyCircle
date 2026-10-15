import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useGroups } from '../context/GroupsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { ErrorNote, Field, Modal } from './ui.jsx';

/**
 * The join action for a group card or preview (FR-REQ-03):
 * Joined → Open, pending → Request pending, open → Join, approval → Request to join.
 */
export default function JoinButton({ group, inviteCode, onChange, size = '', block = false }) {
  const { user } = useAuth();
  const { refreshGroups } = useGroups();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const w = block ? 'w-full' : '';

  if (!user) {
    return (
      <Link to={`/signup?next=${encodeURIComponent(location.pathname)}`} className={`btn-primary ${size} ${w}`}>
        Sign up to join
      </Link>
    );
  }
  if (group.myState === 'joined') {
    return (
      <Link to={`/g/${group._id}`} className={`btn-secondary ${size} ${w}`}>
        Open group
      </Link>
    );
  }

  async function act(fn, success) {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (success) toast(success, { tone: 'success' });
      onChange?.();
      return true;
    } catch (err) {
      setError(err.message);
      if (!modal) toast(err.message, { tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (group.myState === 'pending') {
    return (
      <button
        type="button"
        disabled={busy}
        title="Click to cancel your request"
        onClick={() => group.pendingRequestId && act(() => api.delete(`/groups/${group._id}/requests/${group.pendingRequestId}`), 'Request cancelled.')}
        className={`btn border border-amber-200 bg-amber-50 text-amber-800 ${size} ${w} ${group.pendingRequestId ? 'hover:bg-amber-100' : ''}`}
      >
        {group.pendingRequestId ? 'Pending · Cancel' : 'Request pending'}
      </button>
    );
  }

  const joinDirectly = inviteCode || group.privacy === 'open';
  if (joinDirectly) {
    return (
      <button
        type="button"
        disabled={busy}
        className={`btn-primary ${size} ${w}`}
        onClick={async () => {
          const ok = await act(() => (inviteCode ? api.post(`/groups/join/${inviteCode}`) : api.post(`/groups/${group._id}/join`)));
          if (ok) {
            await refreshGroups();
            navigate(`/g/${group._id}`);
          }
        }}
      >
        {busy ? 'Joining…' : 'Join'}
      </button>
    );
  }

  return (
    <>
      <button type="button" className={`btn-primary ${size} ${w}`} onClick={() => setModal(true)}>
        Request to join
      </button>
      <Modal open={modal} onClose={() => setModal(false)} title={`Ask to join ${group.name}`}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await act(() => api.post(`/groups/${group._id}/requests`, { message }), 'Request sent. The admin will review it.');
            if (ok) {
              setModal(false);
              setMessage('');
            }
          }}
          className="space-y-4"
        >
          <p className="text-sm leading-relaxed text-ink-soft">The group admin approves every new member. A short note about yourself helps.</p>
          <Field label="Message (optional)" hint={`${300 - message.length} characters left`}>
            {(p) => <textarea {...p} className="input min-h-[96px]" maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Same batch at the Ludhiana centre, weak in rotational motion…" />}
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
