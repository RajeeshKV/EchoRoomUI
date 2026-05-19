import { useState, useCallback, useRef, useEffect } from 'react';
import * as signalR from '@microsoft/signalr';
import { config } from '../config';

export function useChat() {
  // Restore session from storage
  const stored = sessionStorage.getItem('echoroom_session');
  const initial = stored ? JSON.parse(stored) : {};

  const [user, setUser] = useState(initial.username || null);
  const [token, setToken] = useState(initial.token || null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [privateChatUser, setPrivateChatUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [typingUsers, setTypingUsers] = useState([]);
  const [privateTypingUser, setPrivateTypingUser] = useState(null);
  const [error, setError] = useState(null);
  const [sessionReplaced, setSessionReplaced] = useState(false);
  const [unreadPrivate, setUnreadPrivate] = useState({});
  const connectionRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  const privateTypingTimeoutRef = useRef(null);

  // Login
  const login = useCallback(async (username) => {
    try {
      setError(null);
      const res = await fetch(config.ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Login failed');
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.username);
      sessionStorage.setItem('echoroom_session', JSON.stringify({ token: data.token, username: data.username }));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Connect SignalR
  const connectHub = useCallback(async (jwtToken) => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(config.HUB_URL, {
        accessTokenFactory: () => jwtToken,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Public messages
    connection.on('ReceiveMessage', (message) => {
      setGroupMessages((prev) => [...prev, message]);
    });

    // Private messages
    connection.on('ReceivePrivateMessage', (message) => {
      setPrivateMessages((prev) => [...prev, message]);
      // Track unread if the sender isn't the current private chat user
      setUnreadPrivate((prev) => {
        const sender = message.sender;
        return { ...prev, [sender]: (prev[sender] || 0) + 1 };
      });
    });

    // Bootstrap public history
    connection.on('PublicRoomHistory', (messages) => {
      setGroupMessages(messages || []);
    });

    // Bootstrap private history
    connection.on('PrivateRoomHistory', (messages) => {
      setPrivateMessages(messages || []);
    });

    // Active users
    connection.on('ActiveUsersUpdated', (users) => {
      setActiveUsers(users || []);
    });

    connection.on('UserJoined', (username) => {
      setActiveUsers((prev) => {
        if (prev.find((u) => u.username === username)) return prev;
        return [...prev, { username }];
      });
    });

    connection.on('UserLeft', (username) => {
      setActiveUsers((prev) => prev.filter((u) => u.username !== username));
    });

    // Typing indicators
    connection.on('UserTyping', (username) => {
      setTypingUsers((prev) => {
        if (prev.includes(username)) return prev;
        return [...prev, username];
      });
      // Clear after 3 seconds
      if (typingTimeoutsRef.current[username]) {
        clearTimeout(typingTimeoutsRef.current[username]);
      }
      typingTimeoutsRef.current[username] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== username));
      }, 3000);
    });

    connection.on('UserTypingPrivate', (username) => {
      setPrivateTypingUser(username);
      if (privateTypingTimeoutRef.current) {
        clearTimeout(privateTypingTimeoutRef.current);
      }
      privateTypingTimeoutRef.current = setTimeout(() => {
        setPrivateTypingUser(null);
      }, 3000);
    });

    // Rate limit
    connection.on('RateLimitWarning', (message) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    // Session replaced
    connection.on('SessionReplaced', (message) => {
      setSessionReplaced(true);
      connection.stop();
    });

    // Connection state
    connection.onreconnecting(() => setConnectionStatus('reconnecting'));
    connection.onreconnected(() => setConnectionStatus('connected'));
    connection.onclose(() => setConnectionStatus('disconnected'));

    try {
      setConnectionStatus('connecting');
      await connection.start();
      setConnectionStatus('connected');
      connectionRef.current = connection;
    } catch (err) {
      setConnectionStatus('disconnected');
      setError('Failed to connect to chat server. Retrying...');
      // Retry after delay
      setTimeout(() => connectHub(jwtToken), 5000);
    }
  }, []);

  // Send group message
  const sendGroupMessage = useCallback(async (message) => {
    if (connectionRef.current && message.trim()) {
      try {
        await connectionRef.current.invoke('SendMessage', message.trim().slice(0, 500));
      } catch (err) {
        setError('Failed to send message');
      }
    }
  }, []);

  // Join private room
  const joinPrivateRoom = useCallback(async (username) => {
    if (!username) {
      // Just close the private chat panel
      setPrivateChatUser(null);
      setPrivateMessages([]);
      return;
    }
    // Block self-DM
    if (username === user) return;
    if (connectionRef.current) {
      try {
        setPrivateChatUser(username);
        setPrivateMessages([]);
        setUnreadPrivate((prev) => {
          const next = { ...prev };
          delete next[username];
          return next;
        });
        await connectionRef.current.invoke('JoinPrivateRoom', username);
      } catch (err) {
        setError('Failed to join private room');
      }
    }
  }, []);

  // Send private message
  const sendPrivateMessage = useCallback(async (receiverUsername, message) => {
    if (connectionRef.current && message.trim()) {
      try {
        await connectionRef.current.invoke('SendPrivateMessage', receiverUsername, message.trim().slice(0, 500));
      } catch (err) {
        setError('Failed to send private message');
      }
    }
  }, []);

  // Typing indicators
  const sendTyping = useCallback(async (privateUser) => {
    if (connectionRef.current) {
      try {
        if (privateUser) {
          await connectionRef.current.invoke('Typing', privateUser);
        } else {
          await connectionRef.current.invoke('Typing');
        }
      } catch (err) {
        // Silently fail typing indicators
      }
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      connectionRef.current = null;
    }
    sessionStorage.removeItem('echoroom_session');
    setUser(null);
    setToken(null);
    setActiveUsers([]);
    setGroupMessages([]);
    setPrivateMessages([]);
    setPrivateChatUser(null);
    setConnectionStatus('disconnected');
    setTypingUsers([]);
    setPrivateTypingUser(null);
    setError(null);
    setSessionReplaced(false);
    setUnreadPrivate({});
  }, []);

  // Auto-reconnect from saved session on mount
  useEffect(() => {
    if (initial.token && initial.username && !connectionRef.current) {
      connectHub(initial.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      if (privateTypingTimeoutRef.current) {
        clearTimeout(privateTypingTimeoutRef.current);
      }
    };
  }, []);

  return {
    user,
    token,
    activeUsers,
    groupMessages,
    privateMessages,
    privateChatUser,
    connectionStatus,
    typingUsers,
    privateTypingUser,
    error,
    sessionReplaced,
    unreadPrivate,
    login,
    connectHub,
    sendGroupMessage,
    joinPrivateRoom,
    sendPrivateMessage,
    sendTyping,
    logout,
    setError,
  };
}
