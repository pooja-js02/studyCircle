import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, connected: false, readyCount: 0 });

export function SocketProvider({ children }) {
  const { token, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  // Bumps on every (re)connect so views can reload anything missed while offline (NFR-REL-02)
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    const s = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    s.on('ready', () => {
      setConnected(true);
      setReadyCount((n) => n + 1);
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => {
      setConnected(false);
      if (err?.data?.code === 'token_invalid') logout('Your session has expired. Please log in again.');
      if (err?.data?.code === 'banned') logout(err.message);
    });
    setSocket(s);
    return () => {
      s.close();
      setSocket(null);
      setConnected(false);
    };
  }, [token, logout]);

  return <SocketContext.Provider value={{ socket, connected, readyCount }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Subscribes to a socket event for the component's lifetime, always calling the latest handler. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (payload) => ref.current(payload);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
