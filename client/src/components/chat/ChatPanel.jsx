import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useGroups } from '../../context/GroupsContext.jsx';
import { useSocket, useSocketEvent } from '../../context/SocketContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { dayLabel, sameDay, timeOf } from '../../lib/format.js';
import { Icon } from '../Icon.jsx';
import { Avatar, EmptyState, Spinner } from '../ui.jsx';
import Composer from './Composer.jsx';
import MessageText from './MessageText.jsx';

const SEND_TIMEOUT_MS = 8000;
const TYPING_SEND_EVERY_MS = 2500;
const TYPING_SHOW_MS = 3500;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const newClientId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ChatPanel({ group, members, readOnly = false }) {
  const { user } = useAuth();
  const { socket, connected, readyCount } = useSocket();
  const { markGroupRead } = useGroups();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const focusId = params.get('m');

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const [typing, setTyping] = useState({}); // userId -> { name, until }
  const [showJump, setShowJump] = useState(false);

  const listRef = useRef(null);
  const nearBottom = useRef(true);
  const restoreScroll = useRef(null);
  const scrollToBottomNext = useRef(false);
  const lastTypingSent = useRef(0);
  const groupId = group._id;
  const isAdmin = group.myRole === 'admin';

  const nameById = useMemo(() => new Map(members.map((m) => [m.user._id, m.user.name])), [members]);
  const nameOf = useCallback((id) => nameById.get(id), [nameById]);

  const markRead = useCallback(() => {
    if (!readOnly && document.visibilityState === 'visible') markGroupRead(groupId);
  }, [groupId, markGroupRead]);

  // Initial load, group switch, and every reconnect (NFR-REL-02)
  const loadLatest = useCallback(async () => {
    const res = await api.get(`/groups/${groupId}/messages`);
    setMessages((prev) => [...res.messages, ...prev.filter((m) => m.status === 'failed' || m.status === 'sending')]);
    setHasMore(res.hasMore);
    setHasNewer(false);
    scrollToBottomNext.current = true;
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    (async () => {
      try {
        if (focusId) {
          // FR-CHAT-09: open the group at the mentioned message and highlight it
          const res = await api.get(`/groups/${groupId}/messages?around=${focusId}`);
          if (cancelled) return;
          setMessages(res.messages);
          setHasMore(res.hasMore);
          setHasNewer(res.hasNewer);
          setHighlight(focusId);
        } else {
          await loadLatest();
        }
      } catch (err) {
        if (!cancelled) {
          toast(err.message, { tone: 'error' });
          if (focusId) await loadLatest().catch(() => {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      markRead();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, focusId]);

  // After a reconnect, fetch what was missed
  const firstReady = useRef(readyCount);
  useEffect(() => {
    if (readyCount > firstReady.current && !hasNewer) loadLatest().then(markRead).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyCount]);

  // Scroll handling: bottom on load/new messages, keep position when older history loads
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (restoreScroll.current) {
      const { height, top } = restoreScroll.current;
      el.scrollTop = el.scrollHeight - height + top;
      restoreScroll.current = null;
    } else if (highlight && !scrollToBottomNext.current) {
      el.querySelector(`[data-id="${highlight}"]`)?.scrollIntoView({ block: 'center' });
    } else if (scrollToBottomNext.current || nearBottom.current) {
      el.scrollTop = el.scrollHeight;
      scrollToBottomNext.current = false;
    }
  }, [messages, highlight]);

  useEffect(() => {
    if (!highlight) return undefined;
    const t = setTimeout(() => {
      setHighlight(null);
      if (params.get('m')) {
        const next = new URLSearchParams(params);
        next.delete('m');
        setParams(next, { replace: true });
      }
    }, 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  async function loadOlder() {
    const oldest = messages.find((m) => !m.status);
    if (!oldest || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const res = await api.get(`/groups/${groupId}/messages?before=${oldest._id}`);
      const el = listRef.current;
      restoreScroll.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((prev) => [...res.messages, ...prev]);
      setHasMore(res.hasMore);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setLoadingOlder(false);
    }
  }

  function onScroll(e) {
    const el = e.currentTarget;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowJump(!nearBottom.current && el.scrollHeight - el.scrollTop - el.clientHeight > 600);
    if (el.scrollTop < 80) loadOlder();
  }

  // ---- live events ----
  useSocketEvent('chat:new', ({ message, clientId }) => {
    if (message.group !== groupId) return;
    if (hasNewer) {
      setShowJump(true);
      return;
    }
    setMessages((prev) => {
      if (prev.some((m) => m._id === message._id)) return prev;
      const pendingIdx = clientId ? prev.findIndex((m) => m.clientId === clientId) : -1;
      if (pendingIdx !== -1) return prev.map((m, i) => (i === pendingIdx ? message : m));
      return [...prev, message];
    });
    if (message.sender) setTyping((t) => {
      const { [message.sender._id]: _gone, ...rest } = t;
      return rest;
    });
    markRead();
  });

  useSocketEvent('chat:deleted', ({ groupId: gid, messageId }) => {
    if (gid !== groupId) return;
    setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true, text: null } : m)));
  });

  useSocketEvent('chat:typing', ({ groupId: gid, user: who }) => {
    if (gid !== groupId || who._id === user._id) return;
    setTyping((t) => ({ ...t, [who._id]: { name: who.name, until: Date.now() + TYPING_SHOW_MS } }));
  });

  useEffect(() => {
    const t = setInterval(() => {
      setTyping((current) => {
        const now = Date.now();
        const live = Object.fromEntries(Object.entries(current).filter(([, v]) => v.until > now));
        return Object.keys(live).length === Object.keys(current).length ? current : live;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && markRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  // ---- sending (FR-CHAT-04: show instantly, mark failed with retry) ----
  const emitSend = useCallback(
    (pending) => {
      if (!socket) return;
      socket.timeout(SEND_TIMEOUT_MS).emit('chat:send', { groupId, text: pending.text, mentions: pending.mentions, clientId: pending.clientId }, (err, res) => {
        if (!err && res?.ok) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === res.message._id)) return prev.filter((m) => m.clientId !== pending.clientId);
            return prev.map((m) => (m.clientId === pending.clientId ? res.message : m));
          });
          return;
        }
        const reason = err ? 'Not sent — check your connection.' : res?.error?.message || 'Not sent.';
        setMessages((prev) => prev.map((m) => (m.clientId === pending.clientId ? { ...m, status: 'failed', error: reason } : m)));
      });
    },
    [socket, groupId]
  );

  function send(text, mentions) {
    const pending = {
      _id: newClientId(),
      clientId: undefined,
      group: groupId,
      kind: 'user',
      sender: { _id: user._id, name: user.name, avatar: user.avatar },
      text,
      mentions,
      mentionsEveryone: false,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    pending.clientId = pending._id;
    scrollToBottomNext.current = true;
    if (hasNewer) {
      loadLatest().then(() => setMessages((prev) => [...prev, pending]));
    } else {
      setMessages((prev) => [...prev, pending]);
    }
    emitSend(pending);
  }

  function retry(m) {
    setMessages((prev) => prev.map((x) => (x.clientId === m.clientId ? { ...x, status: 'sending', error: null } : x)));
    emitSend(m);
  }

  function onTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_SEND_EVERY_MS) {
      lastTypingSent.current = now;
      socket?.emit('chat:typing', { groupId });
    }
  }

  async function removeMessage(m) {
    if (!window.confirm('Remove this message for everyone?')) return;
    try {
      await api.delete(`/groups/${groupId}/messages/${m._id}`);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function jumpToLatest() {
    try {
      await loadLatest();
      markRead();
      setShowJump(false);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  const typingNames = Object.values(typing).map((t) => t.name.split(' ')[0]);

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} onScroll={onScroll} className="scroll-thin relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite" aria-relevant="additions">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner label="Loading messages" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon="chat" title="Say hello">
            This is the start of {group.name}. Ask a doubt, share a plan, or @mention someone to bring them in.
          </EmptyState>
        ) : (
          <>
            {hasMore ? (
              <div className="flex justify-center py-2">{loadingOlder ? <Spinner label="Loading older messages" /> : <button type="button" onClick={loadOlder} className="btn-ghost btn-sm">Load older messages</button>}</div>
            ) : (
              <p className="py-3 text-center text-xs text-ink-faint">Start of the conversation</p>
            )}
            <ol className="flex flex-col">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
                const continued = !newDay && prev && prev.kind === 'user' && m.kind === 'user' && prev.sender?._id === m.sender?._id && new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_WINDOW_MS;
                return (
                  <li key={m._id} data-id={m._id}>
                    {newDay && (
                      <div className="my-3 flex items-center gap-3 text-xs font-medium text-ink-faint">
                        <span className="h-px flex-1 bg-slate-900/10" />
                        {dayLabel(m.createdAt)}
                        <span className="h-px flex-1 bg-slate-900/10" />
                      </div>
                    )}
                    <MessageRow
                      message={m}
                      continued={continued}
                      mine={m.sender?._id === user._id}
                      meId={user._id}
                      nameOf={nameOf}
                      highlighted={highlight === m._id}
                      canDelete={isAdmin && m.kind === 'user' && !m.isDeleted && !m.status}
                      onDelete={() => removeMessage(m)}
                      onRetry={() => retry(m)}
                    />
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      <div className="relative">
        {(showJump || hasNewer) && (
          <button type="button" onClick={jumpToLatest} className="absolute -top-14 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-cta">
            <Icon name="arrowDown" size={16} /> Jump to latest
          </button>
        )}
        <div className="flex h-6 items-center px-5 text-xs text-ink-muted sm:px-7" aria-live="polite">
          {typingNames.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-dot rounded-full bg-ink-faint" style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </span>
              {typingNames.length === 1 ? `${typingNames[0]} is typing…` : `${typingNames.slice(0, 2).join(' and ')} are typing…`}
            </span>
          )}
        </div>
        {readOnly ? (
          <p className="mx-3 mb-3 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-ink-muted sm:mx-5 sm:mb-5">You’re viewing this group as superadmin. Only members can post.</p>
        ) : (
          <Composer members={members} meId={user._id} isAdmin={isAdmin} disabled={!connected && !socket} onSend={send} onTyping={onTyping} />
        )}
      </div>
    </div>
  );
}

function MessageRow({ message: m, continued, mine, meId, nameOf, highlighted, canDelete, onDelete, onRetry }) {
  if (m.kind === 'system') {
    return <p className="my-2 text-center text-xs font-medium text-ink-faint">{m.text}</p>;
  }
  // FR-CHAT-07: messages that mention the reader stand out
  const mentionsMe = !mine && (m.mentions.includes(meId) || m.mentionsEveryone);

  return (
    <div className={`group/msg flex gap-3 rounded-2xl px-2 ${continued ? 'mt-0.5' : 'mt-3'} ${highlighted ? 'animate-flash' : ''} ${mine ? 'flex-row-reverse' : ''}`}>
      <div className="w-9 shrink-0">{!continued && !mine && <Avatar user={m.sender} size={36} />}</div>
      <div className={`flex min-w-0 max-w-[min(640px,85%)] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!continued && (
          <div className={`mb-1 flex items-baseline gap-2 text-xs ${mine ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold">{mine ? 'You' : m.sender?.name || 'Former member'}</span>
            <time dateTime={m.createdAt} className="text-ink-faint">
              {timeOf(m.createdAt)}
            </time>
          </div>
        )}
        <div className="flex max-w-full items-center gap-1">
          <div
            className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
              m.isDeleted
                ? 'border border-dashed border-slate-300 bg-transparent italic text-ink-faint'
                : mine
                  ? 'bg-brand-600 text-white'
                  : mentionsMe
                    ? 'border border-mention-border bg-mention-bg/70 text-ink'
                    : 'solid text-ink'
            } ${m.status === 'sending' ? 'opacity-70' : ''} ${m.status === 'failed' ? 'ring-2 ring-red-300' : ''}`}
          >
            {m.isDeleted ? 'Message removed' : <MessageText message={m} nameOf={nameOf} meId={meId} />}
          </div>
          {canDelete && (
            <button type="button" onClick={onDelete} aria-label="Remove message" className={`shrink-0 rounded-lg p-2 text-ink-faint transition hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover/msg:opacity-100 [@media(hover:hover)]:opacity-0 ${mine ? 'order-first' : ''}`}>
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
        {m.status === 'sending' && <span className="mt-1 text-xs text-ink-faint">Sending…</span>}
        {m.status === 'failed' && (
          <span className="mt-1 flex items-center gap-2 text-xs text-red-700">
            {m.error || 'Not sent.'}
            <button type="button" onClick={onRetry} className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-red-50">
              <Icon name="retry" size={14} /> Retry
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
