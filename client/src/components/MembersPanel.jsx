import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useGroups } from '../context/GroupsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';
import { Avatar } from './ui.jsx';

export default function MembersPanel({ group, members }) {
  const { user } = useAuth();
  const { refreshGroups } = useGroups();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isAdmin = group.myRole === 'admin';

  // FR-GRP-13 / FR-GRP-14
  async function leave() {
    if (!window.confirm(`Leave ${group.name}? You’ll lose access to its chat and notes.`)) return;
    setBusy(true);
    try {
      await api.delete(`/groups/${group._id}/members/me`);
      await refreshGroups();
      toast(`You left ${group.name}.`);
      navigate('/discover');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <ul className="solid divide-y divide-slate-100 rounded-3xl">
          {members.map((m) => (
            <li key={m.user._id} className="flex items-center gap-3 px-4 py-3">
              <Avatar user={m.user} size={40} />
              <span className="flex-1 font-semibold">
                {m.user.name}
                {m.user._id === user._id && <span className="font-normal text-ink-muted"> (you)</span>}
              </span>
              {m.role === 'admin' ? <span className="chip bg-brand-100 text-brand-800">Admin</span> : <span className="text-xs text-ink-muted">Member</span>}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 px-1 text-xs text-ink-muted">
          <Icon name="shield" size={16} /> Members see only names and avatars. Emails and mobile numbers stay private.
        </p>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <Link to={`/g/${group._id}/manage`} className="btn-secondary">
              <Icon name="settings" size={16} /> Manage members
            </Link>
          ) : (
            <button type="button" onClick={leave} disabled={busy} className="btn-danger">
              <Icon name="logout" size={16} /> Leave group
            </button>
          )}
        </div>
        {isAdmin && <p className="text-xs text-ink-muted">As admin, transfer admin to another member before you leave.</p>}
      </div>
    </div>
  );
}
