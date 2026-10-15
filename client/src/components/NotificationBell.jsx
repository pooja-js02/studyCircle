import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../context/GroupsContext.jsx';
import { timeAgo } from '../lib/format.js';
import { Icon } from './Icon.jsx';
import { Avatar } from './ui.jsx';

function targetOf(n) {
  if (!n.group) return null;
  switch (n.type) {
    case 'mention':
      return `/g/${n.group}?m=${n.refId}`; // FR-CHAT-09
    case 'join_request':
      return `/g/${n.group}/manage`;
    case 'new_note':
      return `/g/${n.group}?tab=notes&note=${n.refId}`;
    case 'request_rejected':
      return `/g/${n.group}/preview`;
    case 'removed_from_group':
      return null;
    default:
      return `/g/${n.group}`;
  }
}

// FR-NOTIF-03: a bell with the unread count; the list can be marked read
export default function NotificationBell() {
  const { notifications, unreadNotifications, markNotificationsRead } = useGroups();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // The panel is rendered at <body> level (a portal) and placed under the bell,
  // so the sidebar's glass layer can't trap it behind the main content.
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 32);
    const left = Math.min(Math.max(16, r.left), window.innerWidth - width - 16);
    setPos({ top: r.bottom + 8, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && !panelRef.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    const shut = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', shut);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', shut);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-white/80"
      >
        <Icon name="bell" />
        {unreadNotifications > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-[70] animate-pop rounded-3xl border border-white bg-white/95 p-2 shadow-glass backdrop-blur-xl"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <h2 className="text-base font-semibold">Notifications</h2>
            {unreadNotifications > 0 && (
              <button type="button" onClick={() => markNotificationsRead()} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                Mark all read
              </button>
            )}
          </div>
          <ul className="scroll-thin max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-muted">You’re all caught up.</li>}
            {notifications.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markNotificationsRead([n._id]);
                    const to = targetOf(n);
                    setOpen(false);
                    if (to) navigate(to);
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/60'}`}
                >
                  {n.actor ? <Avatar user={n.actor} size={34} /> : <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-slate-100"><Icon name="bell" size={16} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-snug ${n.type === 'mention' ? 'text-ink' : 'text-ink-soft'}`}>{n.text}</span>
                    <span className="mt-0.5 block text-xs text-ink-faint">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="unread" />}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
