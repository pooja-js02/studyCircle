import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import JoinButton from '../components/JoinButton.jsx';
import { Avatar, GroupAvatar, PageLoader, PrivacyBadge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { plural } from '../lib/format.js';
import NotFound from './NotFound.jsx';

// FR-GRP-09 public preview (also reached through an invite link, FR-GRP-17)
export default function GroupPreview({ byInvite = false }) {
  const { id, code } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(byInvite ? `/groups/invite/${encodeURIComponent(code)}` : `/groups/${id}`);
      setGroup(res.group);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [byInvite, code, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <NotFound title={byInvite ? 'Invite code not valid' : 'Group not found'} message={byInvite ? 'Check the code with whoever shared it. Codes change when an admin resets them.' : 'This group may be invite-only, or it was deleted.'} />;
  }
  if (!group) return <PageLoader />;

  return (
    <div className="space-y-5">
      <Link to="/discover" className="inline-flex min-h-[44px] items-center gap-1 rounded-xl text-sm font-medium">
        <Icon name="back" size={16} /> Back to discover
      </Link>
      <section className="glass overflow-hidden rounded-4xl">
        <div className="h-28 bg-[linear-gradient(120deg,#FED7AA,#FDE68A_50%,#BFDBFE)] sm:h-36" />
        <div className="flex flex-wrap items-end gap-6 px-5 pb-6 sm:px-7">
          <GroupAvatar name={group.name} size={96} rounded="rounded-[28px]" className="-mt-12 border-4 border-white text-3xl" />
          <div className="min-w-[240px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold sm:text-4xl">{group.name}</h1>
              <PrivacyBadge privacy={group.privacy} />
            </div>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">{group.description || 'No description yet.'}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              <span>{plural(group.memberCount, 'member')}</span>
              <span>{plural(group.notesCount, 'note')}</span>
              {group.createdBy && <span>Created by {group.createdBy.name}</span>}
              {group.tags.length > 0 && <span>{group.tags.map((t) => `#${t}`).join('  ')}</span>}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
            <JoinButton group={group} inviteCode={byInvite ? code : undefined} onChange={load} block />
            {user?.platformRole === 'superadmin' && group.myState !== 'joined' && (
              <Link to={`/g/${group._id}?tab=notes`} className="btn-secondary w-full">
                <Icon name="shield" size={16} /> Open as superadmin
              </Link>
            )}
            <span className="text-center text-xs text-ink-muted">
              {group.myState === 'joined'
                ? 'You are a member'
                : byInvite || group.privacy === 'open'
                  ? 'You’ll join straight away'
                  : group.myState === 'pending'
                    ? 'Waiting for the admin'
                    : 'The group’s admin will review your request'}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
        <section className="glass space-y-4 rounded-3xl p-6">
          <h2 className="text-xl font-semibold">About this group</h2>
          {group.admin && (
            <div className="flex items-center gap-3">
              <Avatar user={group.admin} />
              <div>
                <div className="font-semibold">{group.admin.name}</div>
                <div className="text-sm text-ink-muted">Group admin</div>
              </div>
            </div>
          )}
          <div className="flex gap-2.5 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-xs leading-relaxed text-brand-900">
            <Icon name="shield" size={18} className="text-brand-600" />
            <span>Members see only names and avatars. Emails and mobile numbers stay private.</span>
          </div>
        </section>
        <section className="glass rounded-3xl p-6">
          <h2 className="text-xl font-semibold">What members get</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['chat', 'Live group chat', '@mention anyone and they’re notified wherever they are.'],
              ['notes', 'Shared notes', `${plural(group.notesCount, 'note')} in folders, searchable by title and tag.`],
              ['users', 'A focused circle', group.privacy === 'approval' ? 'The admin approves every member.' : 'Join and start studying today.'],
            ].map(([icon, title, body]) => (
              <li key={title} className="rounded-2xl bg-white/70 p-4">
                <Icon name={icon} className="text-brand-600" />
                <div className="mt-2 font-semibold">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
