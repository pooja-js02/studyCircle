import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useSocket, useSocketEvent } from './SocketContext.jsx';
import { useToast } from './ToastContext.jsx';

const GroupsContext = createContext(null);

/**
 * The signed-in user's groups (sidebar, FR-GRP-07) and notifications (FR-NOTIF-02/03),
 * kept live from socket events.
 */
export function GroupsProvider({ children }) {
  const { user } = useAuth();
  const { readyCount, socket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const activeGroupRef = useRef(null);

  const refreshGroups = useCallback(async () => {
    try {
      const res = await api.get('/groups/mine');
      setGroups(res.groups);
    } catch {
      // keep what we have; the next reconnect retries
    } finally {
      setGroupsLoaded(true);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.notifications);
      setUnreadNotifications(res.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setGroupsLoaded(false);
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }
    refreshGroups();
    refreshNotifications();
  }, [user, refreshGroups, refreshNotifications]);

  // Reload after every reconnect so nothing missed while offline is lost (NFR-REL-02)
  useEffect(() => {
    if (readyCount > 1) {
      refreshGroups();
      refreshNotifications();
    }
  }, [readyCount, refreshGroups, refreshNotifications]);

  const setActiveGroup = useCallback((groupId) => {
    activeGroupRef.current = groupId;
    if (groupId) setGroups((list) => list.map((g) => (g._id === groupId ? { ...g, unreadCount: 0, mentionCount: 0 } : g)));
  }, []);

  const markGroupRead = useCallback(
    (groupId) => {
      socket?.emit('chat:read', { groupId });
      setGroups((list) => list.map((g) => (g._id === groupId ? { ...g, unreadCount: 0, mentionCount: 0 } : g)));
    },
    [socket]
  );

  useSocketEvent('chat:new', ({ message }) => {
    setGroups((list) => {
      const idx = list.findIndex((g) => g._id === message.group);
      if (idx === -1) return list;
      const g = list[idx];
      const isActive = activeGroupRef.current === message.group;
      const mine = message.sender?._id === user?._id;
      const countsAsUnread = !isActive && !mine && message.kind === 'user';
      const mentionsMe = message.mentions.includes(user?._id) || message.mentionsEveryone;
      const updated = {
        ...g,
        lastMessage: { text: message.text || '', senderName: message.sender?.name || null, kind: message.kind, createdAt: message.createdAt },
        lastActivityAt: message.createdAt,
        unreadCount: countsAsUnread ? g.unreadCount + 1 : g.unreadCount,
        mentionCount: countsAsUnread && mentionsMe ? g.mentionCount + 1 : g.mentionCount,
      };
      return [updated, ...list.slice(0, idx), ...list.slice(idx + 1)];
    });
  });

  useSocketEvent('notification:new', (n) => {
    setNotifications((list) => [n, ...list].slice(0, 40));
    setUnreadNotifications((c) => c + 1);
    const viewingThatGroup = activeGroupRef.current && activeGroupRef.current === n.group;
    if (n.type === 'mention' && !viewingThatGroup) {
      toast(n.text, { tone: 'mention', action: { label: 'Open', onClick: () => navigate(`/g/${n.group}?m=${n.refId}`) } });
    } else if (n.type === 'request_approved') {
      toast(n.text, { tone: 'success', action: { label: 'Open group', onClick: () => navigate(`/g/${n.group}`) } });
    } else if (n.type === 'join_request') {
      toast(n.text, { action: { label: 'Review', onClick: () => navigate(`/g/${n.group}/manage`) } });
    } else if (n.type === 'request_rejected' || n.type === 'admin_transferred') {
      toast(n.text);
    }
  });

  useSocketEvent('group:joined', refreshGroups);
  useSocketEvent('group:updated', refreshGroups);

  useSocketEvent('member:removed', ({ groupId, groupName, userId, reason }) => {
    if (userId) return; // someone else left; the group view refreshes its own member list
    setGroups((list) => list.filter((g) => g._id !== groupId));
    if (reason === 'removed') toast(`You were removed from ${groupName}.`, { tone: 'error' });
    if (activeGroupRef.current === groupId) navigate('/discover', { replace: true });
  });

  useSocketEvent('group:deleted', ({ groupId, groupName }) => {
    setGroups((list) => list.filter((g) => g._id !== groupId));
    if (activeGroupRef.current === groupId) {
      toast(`${groupName} was deleted by its admin.`, { tone: 'error' });
      navigate('/discover', { replace: true });
    }
  });

  const markNotificationsRead = useCallback(async (ids) => {
    try {
      const res = await api.patch('/notifications/read', ids ? { ids } : {});
      setUnreadNotifications(res.unreadCount);
      setNotifications((list) => list.map((n) => (!ids || ids.includes(n._id) ? { ...n, read: true } : n)));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      groups,
      groupsLoaded,
      refreshGroups,
      setActiveGroup,
      markGroupRead,
      notifications,
      unreadNotifications,
      markNotificationsRead,
    }),
    [groups, groupsLoaded, refreshGroups, setActiveGroup, markGroupRead, notifications, unreadNotifications, markNotificationsRead]
  );
  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export const useGroups = () => useContext(GroupsContext);
