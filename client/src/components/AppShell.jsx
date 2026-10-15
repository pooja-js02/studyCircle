import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useGroups } from '../context/GroupsContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import CreateGroupModal from './CreateGroupModal.jsx';
import { Icon } from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { Avatar, Blobs, GroupAvatar, Logo } from './ui.jsx';

function GroupLink({ group, onNavigate }) {
  const preview = group.mentionCount
    ? `${group.lastMessage?.senderName || 'Someone'} mentioned you`
    : group.isMuted
      ? 'Muted'
      : group.lastMessage
        ? `${group.lastMessage.senderName ? `${group.lastMessage.senderName.split(' ')[0]}: ` : ''}${group.lastMessage.text}`
        : 'No messages yet';
  return (
    <NavLink
      to={`/g/${group._id}`}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex min-h-[56px] items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
          isActive ? 'border border-brand-600/20 bg-white shadow-lift' : 'border border-transparent hover:bg-white/70'
        }`
      }
    >
      <GroupAvatar name={group.name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{group.name}</span>
        <span className="truncate text-xs text-ink-muted">{preview}</span>
      </span>
      {group.mentionCount > 0 ? (
        <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-mention-border bg-mention-bg px-1.5 text-xs font-bold text-mention-text">
          <span className="sr-only">mentions: </span>@{group.mentionCount}
        </span>
      ) : group.unreadCount > 0 ? (
        <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
          <span className="sr-only">unread: </span>
          {group.unreadCount > 99 ? '99+' : group.unreadCount}
        </span>
      ) : null}
    </NavLink>
  );
}

function Sidebar({ onNavigate, onCreate }) {
  const { user } = useAuth();
  const { groups, groupsLoaded } = useGroups();
  const { connected } = useSocket();
  const [filter, setFilter] = useState('');
  const shown = filter ? groups.filter((g) => g.name.toLowerCase().includes(filter.toLowerCase())) : groups;

  return (
    <nav aria-label="My groups" className="glass flex h-full flex-col gap-4 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <Link to="/" onClick={onNavigate} className="rounded-xl">
          <Logo />
        </Link>
        {user && <NotificationBell />}
      </div>

      {user ? (
        <>
          <label className="solid flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-ink-faint">
            <Icon name="search" size={16} />
            <span className="sr-only">Filter my groups</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search my groups" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
          </label>
          <div className="eyebrow">My groups</div>
          <div className="scroll-thin -mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
            {groupsLoaded && groups.length === 0 && (
              <p className="rounded-2xl bg-white/60 p-4 text-sm leading-relaxed text-ink-muted">
                You haven’t joined a group yet. Discover one for your exam or create your own.
              </p>
            )}
            {shown.map((g) => (
              <GroupLink key={g._id} group={g} onNavigate={onNavigate} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/discover" onClick={onNavigate} className="btn-secondary px-3">
              <Icon name="compass" size={18} /> Discover
            </Link>
            <button type="button" onClick={onCreate} className="btn-primary px-3 shadow-none">
              <Icon name="plus" size={18} /> Create
            </button>
          </div>
          <Link to="/profile" onClick={onNavigate} className="flex items-center gap-3 rounded-2xl border-t border-slate-900/5 px-1 pt-3 hover:opacity-90">
            <Avatar user={user} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {connected ? 'Online' : 'Connecting…'}
              </span>
            </span>
            <Icon name="settings" size={18} className="text-ink-faint" />
          </Link>
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-6">
          <div className="space-y-3 rounded-2xl bg-white/60 p-4 text-sm leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">Study together. Stay in the circle.</p>
            <p>Private groups for your batch with shared notes and live chat.</p>
          </div>
          <div className="grid gap-2">
            <Link to="/signup" onClick={onNavigate} className="btn-primary">Create account</Link>
            <Link to="/login" onClick={onNavigate} className="btn-secondary">Log in</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="relative min-h-dvh">
      <Blobs />
      {/* Phone top bar: the sidebar becomes a slide-out drawer (SRS 4.1) */}
      <header className="glass sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-2.5 lg:hidden">
        <button type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/70">
          <Icon name="menu" />
        </button>
        <Link to="/" className="flex-1">
          <Logo size={30} />
        </Link>
        {user && <NotificationBell />}
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-4 p-3 sm:p-4">
        <aside className="sticky top-4 hidden h-[calc(100dvh-32px)] w-[300px] shrink-0 lg:block">
          <Sidebar onCreate={() => setCreateOpen(true)} />
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] animate-rise p-3">
            <Sidebar
              onNavigate={() => setDrawerOpen(false)}
              onCreate={() => {
                setDrawerOpen(false);
                setCreateOpen(true);
              }}
            />
          </div>
        </div>
      )}

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(g) => {
          setCreateOpen(false);
          navigate(`/g/${g._id}`);
        }}
      />
    </div>
  );
}
