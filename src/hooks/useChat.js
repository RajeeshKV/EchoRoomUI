import { useState, useCallback, useRef, useEffect } from 'react';
import * as signalR from '@microsoft/signalr';
import { config } from '../config';

// ── Presence / heartbeat constants ──────────────────────────────
const HEARTBEAT_INTERVAL_MS = 25_000;   // send heartbeat every 25 s
const FREEZE_THRESHOLD_MS   = 60_000;   // if loop was frozen > 60 s → reconnect

// Helper to check if a JWT token is expired
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp) {
      // payload.exp is in seconds, Date.now() is in milliseconds.
      // Use a 10-second buffer to handle network latency or clock skew
      return Date.now() >= (payload.exp * 1000 - 10000);
    }
    return false;
  } catch {
    return true;
  }
}

// ── Helpers: load/save recent contacts from localStorage ─────
function loadRecentContacts(username) {
  try {
    const raw = localStorage.getItem(`echoroom_recent_${username}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentContacts(username, contacts) {
  try {
    localStorage.setItem(`echoroom_recent_${username}`, JSON.stringify(contacts));
  } catch { /* quota exceeded – ignore */ }
}

/**
 * Upsert a contact into the recent list.
 * Returns a new array (does NOT mutate).
 */
function upsertContact(list, partner, preview, timestamp) {
  const existing = list.find((c) => c.username === partner);
  const ts = timestamp ? new Date(timestamp).getTime() : Date.now();
  if (existing) {
    // Only update if the new message is newer
    if (ts >= existing.lastTime) {
      return list.map((c) =>
        c.username === partner
          ? { ...c, lastMessage: preview, lastTime: ts }
          : c
      );
    }
    return list;
  }
  return [...list, { username: partner, lastMessage: preview, lastTime: ts }];
}

export function useChat() {
  // Restore session from storage
  const stored = localStorage.getItem('echoroom_session');
  const initial = stored ? JSON.parse(stored) : {};
  const isExpired = isTokenExpired(initial.token);

  // If token is expired, ignore the saved session
  const initialUsername = isExpired ? null : (initial.username || null);
  const initialToken = isExpired ? null : (initial.token || null);

  const [user, setUser] = useState(initialUsername);
  const [token, setToken] = useState(initialToken);
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
  const [recentContacts, setRecentContacts] = useState(() => loadRecentContacts(initialUsername));
  const connectionRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  const privateTypingTimeoutRef = useRef(null);
  const heartbeatRef = useRef(null);
  const lastHeartbeatTsRef = useRef(Date.now());
  const tokenRef = useRef(initialToken);   // stable ref for event handlers
  const userRef = useRef(initialUsername); // stable ref for the current username

  // ── Helpers: stop heartbeat ───────────────────────────────────
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // ── Helpers: start heartbeat ──────────────────────────────────
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    lastHeartbeatTsRef.current = Date.now();

    heartbeatRef.current = setInterval(async () => {
      const conn = connectionRef.current;
      if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;

      // Detect freeze / laptop wake – if timer drifted beyond threshold, reconnect
      const now = Date.now();
      const elapsed = now - lastHeartbeatTsRef.current;
      if (elapsed > FREEZE_THRESHOLD_MS) {
        console.warn('[EchoRoom] Freeze detected – elapsed', elapsed, 'ms. Reconnecting…');
        stopHeartbeat();
        try { await conn.stop(); } catch { /* ignore */ }
        // Trigger fresh reconnect using stored token
        const savedToken = tokenRef.current;
        if (savedToken) {
          // Small delay to let the old socket fully close
          setTimeout(() => connectHub(savedToken), 500);
        }
        return;
      }
      lastHeartbeatTsRef.current = now;

      try {
        await conn.invoke('Heartbeat');
      } catch {
        // Heartbeat failed – connection may be dead; SignalR auto-reconnect handles it
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat]);

  // ── Graceful disconnect helper (sync-safe) ────────────────────
  const gracefulDisconnect = useCallback(() => {
    const conn = connectionRef.current;
    if (!conn) return;

    // Use sendBeacon as a last-resort signal if the hub supports it via REST,
    // but primarily just call stop() which sends a close frame.
    try {
      conn.stop();
    } catch {
      // Best-effort on unload – swallow
    }
  }, []);

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
      tokenRef.current = data.token;
      setUser(data.username);
      userRef.current = data.username;
      localStorage.setItem('echoroom_session', JSON.stringify({ token: data.token, username: data.username }));
      // Load persisted recent contacts for this user
      setRecentContacts(loadRecentContacts(data.username));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Connect SignalR
  const connectHub = useCallback(async (jwtToken) => {
    // Stop any previous heartbeat
    stopHeartbeat();

    if (connectionRef.current) {
      try { await connectionRef.current.stop(); } catch { /* ignore */ }
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

      // Update recent contacts list
      const me = userRef.current;
      const partner = message.sender === me ? message.receiver : message.sender;
      if (partner && partner !== me) {
        let preview = message.message || message.content || message.text || '';
        if (message.attachment) {
          const kind = message.attachment.kind;
          const icon = kind === 'image' ? '📷' : kind === 'video' ? '🎥' : '🎤';
          preview = preview ? `${icon} ${preview}` : `${icon} ${kind}`;
        }
        const timestamp = message.sentAt || message.timestamp;
        setRecentContacts((prev) => {
          const next = upsertContact(prev, partner, preview, timestamp);
          saveRecentContacts(me, next);
          return next;
        });
      }
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
      stopHeartbeat();
      connection.stop();
    });

    // Connection state
    connection.onreconnecting(() => {
      setConnectionStatus('reconnecting');
      stopHeartbeat();          // pause heartbeat while reconnecting
    });
    connection.onreconnected(() => {
      setConnectionStatus('connected');
      startHeartbeat();         // resume heartbeat after reconnect
    });
    connection.onclose(() => {
      setConnectionStatus('disconnected');
      stopHeartbeat();
    });

    try {
      if (isTokenExpired(jwtToken)) {
        logout();
        return;
      }
      setConnectionStatus('connecting');
      await connection.start();
      setConnectionStatus('connected');
      connectionRef.current = connection;

      // Start heartbeat loop on successful connection
      startHeartbeat();
    } catch (err) {
      setConnectionStatus('disconnected');
      if (isTokenExpired(jwtToken)) {
        logout();
        return;
      }
      setError('Failed to connect to chat server. Retrying...');
      // Retry after delay
      setTimeout(() => connectHub(jwtToken), 5000);
    }
  }, [startHeartbeat, stopHeartbeat]);

  // Media Upload Endpoint
  const uploadMedia = useCallback(async (file, kind) => {
    const jwt = tokenRef.current;
    if (!jwt) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('File', file);
    formData.append('Kind', kind);

    const res = await fetch(`${config.API_BASE_URL}/api/chat/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`
      },
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Upload failed');
    }

    const data = await res.json();
    return data.attachment; // returns the ChatAttachmentDto
  }, []);

  // Send group message (supports Rich Messages)
  const sendGroupMessage = useCallback(async (message, attachment = null, replyToMessageId = null) => {
    if (connectionRef.current) {
      try {
        const hasText = message && message.trim();
        if (attachment || replyToMessageId) {
          await connectionRef.current.invoke('SendRichMessage', {
            message: hasText ? message.trim().slice(0, 500) : '',
            replyToMessageId: replyToMessageId || null,
            attachment: attachment || null
          });
        } else if (hasText) {
          await connectionRef.current.invoke('SendMessage', message.trim().slice(0, 500));
        }
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

        // Ensure this user is in recent contacts
        const me = userRef.current;
        setRecentContacts((prev) => {
          const exists = prev.find((c) => c.username === username);
          if (exists) return prev;
          const next = [...prev, { username, lastMessage: '', lastTime: Date.now() }];
          saveRecentContacts(me, next);
          return next;
        });

        await connectionRef.current.invoke('JoinPrivateRoom', username);
      } catch (err) {
        setError('Failed to join private room');
      }
    }
  }, [user]);

  // Send private message (supports Rich Messages)
  const sendPrivateMessage = useCallback(async (receiverUsername, message, attachment = null, replyToMessageId = null) => {
    if (connectionRef.current) {
      try {
        const hasText = message && message.trim();
        const trimmed = hasText ? message.trim().slice(0, 500) : '';

        if (attachment || replyToMessageId) {
          await connectionRef.current.invoke('SendPrivateRichMessage', receiverUsername, {
            message: trimmed,
            replyToMessageId: replyToMessageId || null,
            attachment: attachment || null
          });

          // Update recent contacts with the sent message preview
          const me = userRef.current;
          if (me && receiverUsername) {
            let preview = trimmed;
            if (attachment) {
              const icon = attachment.kind === 'image' ? '📷' : attachment.kind === 'video' ? '🎥' : '🎤';
              preview = preview ? `${icon} ${preview}` : `${icon} ${attachment.kind}`;
            }
            setRecentContacts((prev) => {
              const next = upsertContact(prev, receiverUsername, preview, new Date().toISOString());
              saveRecentContacts(me, next);
              return next;
            });
          }
        } else if (hasText) {
          await connectionRef.current.invoke('SendPrivateMessage', receiverUsername, trimmed);

          // Update recent contacts with the sent message
          const me = userRef.current;
          if (me && receiverUsername) {
            setRecentContacts((prev) => {
              const next = upsertContact(prev, receiverUsername, trimmed, new Date().toISOString());
              saveRecentContacts(me, next);
              return next;
            });
          }
        }
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
    stopHeartbeat();
    if (connectionRef.current) {
      try { await connectionRef.current.stop(); } catch { /* ignore */ }
      connectionRef.current = null;
    }
    localStorage.removeItem('echoroom_session');
    tokenRef.current = null;
    userRef.current = null;
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
    setRecentContacts([]);
  }, [stopHeartbeat]);

  // Auto-reconnect from saved session on mount
  useEffect(() => {
    if (initialToken && initialUsername && !connectionRef.current) {
      connectHub(initialToken);
    } else if (isExpired && stored) {
      // Clear expired session if any
      localStorage.removeItem('echoroom_session');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Page lifecycle: clean disconnect on every possible exit ───
  useEffect(() => {
    // beforeunload — desktop browsers, tab close, navigation away
    const onBeforeUnload = () => {
      gracefulDisconnect();
    };

    // pagehide — more reliable than beforeunload on mobile Safari / iOS
    const onPageHide = (e) => {
      // persisted = bfcache; still attempt stop
      gracefulDisconnect();
    };

    // visibilitychange — handles mobile tab switches, app backgrounding
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Pause heartbeat when tab is hidden (saves resources)
        stopHeartbeat();
      } else if (document.visibilityState === 'visible') {
        const conn = connectionRef.current;
        if (conn && conn.state === signalR.HubConnectionState.Connected) {
          // Tab is back — resume heartbeat and send an immediate one
          startHeartbeat();
          conn.invoke('Heartbeat').catch(() => {});
        } else if (conn && conn.state === signalR.HubConnectionState.Disconnected) {
          // Connection died while hidden — attempt fresh reconnect
          const savedToken = tokenRef.current;
          if (savedToken) {
            connectHub(savedToken);
          }
        }
      }
    };

    // freeze — fired on some browsers when page is about to be frozen (e.g., bfcache)
    const onFreeze = () => {
      gracefulDisconnect();
      stopHeartbeat();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('freeze', onFreeze);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('freeze', onFreeze);
    };
  }, [gracefulDisconnect, stopHeartbeat, startHeartbeat, connectHub]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      if (privateTypingTimeoutRef.current) {
        clearTimeout(privateTypingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    recentContacts,
    login,
    connectHub,
    sendGroupMessage,
    joinPrivateRoom,
    sendPrivateMessage,
    sendTyping,
    logout,
    setError,
    uploadMedia,
  };
}
