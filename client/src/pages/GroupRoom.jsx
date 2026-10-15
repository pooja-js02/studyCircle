import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ChatPanel from '../components/chat/ChatPanel.jsx';
import MembersPanel from '../components/MembersPanel.jsx';
import NotesPanel from '../components/notes/NotesPanel.jsx';
import { Icon } from '../components/Icon.jsx';
import { GroupAvatar, PageLoader, PrivacyBadge } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGroups } from '../context/GroupsContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';
import { api } from '../lib/api.js';
import { plural } from '../lib/format.js';
import NotFound from './NotFound.jsx';

const TABS = [
  { key: 'chat', label: 'Chat', icon: 'chat' },
  { key: 'notes', label: 'Notes', icon: 'notes' },
  { key: 'members', label: 'Members', icon: 'users' },
];

export default function GroupRoom() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'chat';
  const { setActiveGroup } = useGroups();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);

  const loadGroup = useCallback(async () => {
    try {
      const [g, m] = await Promise.all([api.get(`/groups/${id}`), api.get(`/groups/${id}/members`)]);
      setGroup(g.group);
      setMembers(m.members);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    setGroup(null);
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    setActiveGroup(id);
    return () => setActiveGroup(null);
  }, [id, setActiveGroup]);

  const isThisGroup = (p) => p?.groupId === id;
  useSocketEvent('member:joined', (p) => isThisGroup(p) && loadGroup());
  useSocketEvent('member:removed', (p) => isThisGroup(p) && p.userId && loadGroup());
  useSocketEvent('group:updated', (p) => isThisGroup(p) && loadGroup());
  useSocketEvent('note:new', (p) => isThisGroup(p) && setGroup((g) => g && { ...g, notesCount: g.notesCount + 1 }));
  useSocketEvent('note:deleted', (p) => isThisGroup(p) && setGroup((g) => g && { ...g, notesCount: Math.max(0, g.notesCount - 1) }));

  if (error) {
    return error.status === 403 ? (
      <NotFound title="You’re not in this group" message="Ask to join from the group’s preview page." />
    ) : (
      <NotFound title="Group not found" message="It may have been deleted." />
    );
  }
  if (!group) return <PageLoader />;
  // The platform superadmin may look into any group (read-only) to moderate notes
  const moderating = group.myState !== 'joined' && user.platformRole === 'superadmin';
  if (group.myState !== 'joined' && !moderating) return <NotFound title="You’re not in this group" message="Ask to join from the group’s preview page." />;

  const isAdmin = group.myRole === 'admin';
  const setTab = (key) => {
    const next = new URLSearchParams();
    if (key !== 'chat') next.set('tab', key);
    setParams(next, { replace: true });
  };

  return (
    <section className="glass flex h-[calc(100dvh-88px)] flex-col overflow-hidden rounded-3xl lg:h-[calc(100dvh-32px)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-slate-900/5 px-4 pb-0 pt-4 sm:px-6">
        <GroupAvatar name={group.name} size={46} rounded="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{group.name}</h1>
            <PrivacyBadge privacy={group.privacy} />
          </div>
          <p className="text-sm text-ink-muted">
            {plural(group.memberCount, 'member')} · {moderating ? 'Viewing as StudyCircle superadmin (read-only)' : `You are ${isAdmin ? 'Admin' : 'a member'}`}
          </p>
        </div>
        {isAdmin && (
          <Link to={`/g/${id}/manage`} aria-label="Manage group" className="btn-secondary btn-sm min-h-[40px]">
            <Icon name="settings" size={16} /> <span className="hidden sm:inline">Manage</span>
          </Link>
        )}
        <nav role="tablist" aria-label="Group sections" className="-mb-px flex w-full gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink'}`}
            >
              <Icon name={t.icon} size={17} />
              {t.label}
              {t.key === 'notes' && <span className="text-ink-faint">· {group.notesCount}</span>}
              {t.key === 'members' && <span className="text-ink-faint">· {group.memberCount}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1" role="tabpanel">
        {tab === 'chat' && <ChatPanel group={group} members={members} readOnly={moderating} />}
        {tab === 'notes' && <NotesPanel group={group} />}
        {tab === 'members' && <MembersPanel group={group} members={members} />}
      </div>
    </section>
  );
}
