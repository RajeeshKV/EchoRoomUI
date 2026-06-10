import { useState } from 'react';
import { useChat } from './hooks/useChat';
import LoginScreen from './components/LoginScreen';
import ActiveUsers from './components/ActiveUsers';
import GroupChat from './components/GroupChat';
import PrivateChat from './components/PrivateChat';
import './App.css';

export default function App() {
  const chat = useChat();
  const [mobileTab, setMobileTab] = useState('group'); // 'users' | 'group' | 'private'

  const handleLogin = async (username) => {
    const data = await chat.login(username);
    await chat.connectHub(data.token);
  };

  const handleSelectUser = (username) => {
    chat.joinPrivateRoom(username);
    setMobileTab('private'); // auto-switch to private chat on mobile
  };

  const handleClosePrivate = () => {
    // Clear the private chat selection — returns to contact list
    chat.joinPrivateRoom(null);
  };

  // Total unread count for the private tab badge
  const totalUnread = Object.values(chat.unreadPrivate || {}).reduce((sum, n) => sum + n, 0);

  // Session replaced overlay
  if (chat.sessionReplaced) {
    return (
      <div className="session-replaced">
        <div className="sr-card animate-fade">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h2>Session Replaced</h2>
          <p>Your session was replaced by a new login. Only one session per username is allowed.</p>
          <button className="sr-btn" onClick={chat.logout}>Login Again</button>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!chat.user) {
    return <LoginScreen onLogin={handleLogin} error={chat.error} />;
  }

  // Connecting loader — shown until SignalR is ready
  if (chat.connectionStatus !== 'connected') {
    return (
      <div className="connecting-screen">
        <div className="connecting-card animate-fade">
          <div className="connecting-spinner" />
          <h2>Connecting to EchoRoom...</h2>
          <p>Setting up your real-time session</p>
        </div>
      </div>
    );
  }

  // Main chat layout
  return (
    <div className="app-layout">
      {/* Error toast */}
      {chat.error && (
        <div className="error-toast animate-fade">
          <span>{chat.error}</span>
          <button onClick={() => chat.setError(null)}>✕</button>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="var(--accent)"/>
            <path d="M14 18C14 15.79 15.79 14 18 14H30C32.21 14 34 15.79 34 18V28C34 30.21 32.21 32 30 32H20L16 36V32H18C15.79 32 14 30.21 14 28V18Z" fill="white" fillOpacity="0.9"/>
          </svg>
          <span className="app-header-title">EchoRoom</span>
        </div>
        <button className="app-logout" onClick={chat.logout} title="Logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="logout-text">Logout</span>
        </button>
      </header>

      {/* 3-panel layout */}
      <main className="app-main">
        <div className={`panel-users ${mobileTab === 'users' ? 'panel--active' : ''}`}>
          <ActiveUsers
            users={chat.activeUsers}
            currentUser={chat.user}
            onSelectUser={handleSelectUser}
            privateChatUser={chat.privateChatUser}
            unreadPrivate={chat.unreadPrivate}
          />
        </div>
        <div className={`panel-group ${mobileTab === 'group' ? 'panel--active' : ''}`}>
          <GroupChat
            messages={chat.groupMessages}
            currentUser={chat.user}
            onSend={chat.sendGroupMessage}
            onTyping={chat.sendTyping}
            typingUsers={chat.typingUsers}
            connectionStatus={chat.connectionStatus}
            uploadMedia={chat.uploadMedia}
          />
        </div>
        <div className={`panel-private ${mobileTab === 'private' ? 'panel--active' : ''}`}>
          <PrivateChat
            messages={chat.privateMessages}
            currentUser={chat.user}
            privateChatUser={chat.privateChatUser}
            onSend={chat.sendPrivateMessage}
            onTyping={chat.sendTyping}
            typingUser={chat.privateTypingUser}
            onClose={handleClosePrivate}
            users={chat.activeUsers}
            onSelectUser={handleSelectUser}
            unreadPrivate={chat.unreadPrivate}
            recentContacts={chat.recentContacts}
            uploadMedia={chat.uploadMedia}
          />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav">
        <button
          className={`mobile-nav-item ${mobileTab === 'users' ? 'mobile-nav-item--active' : ''}`}
          onClick={() => setMobileTab('users')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Users</span>
          {chat.activeUsers.filter(u => u.username !== chat.user).length > 0 && mobileTab !== 'users' && (
            <span className="mobile-nav-dot" />
          )}
        </button>
        <button
          className={`mobile-nav-item ${mobileTab === 'group' ? 'mobile-nav-item--active' : ''}`}
          onClick={() => setMobileTab('group')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Group</span>
        </button>
        <button
          className={`mobile-nav-item ${mobileTab === 'private' ? 'mobile-nav-item--active' : ''}`}
          onClick={() => setMobileTab('private')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <span>Private</span>
          {totalUnread > 0 && (
            <span className="mobile-nav-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
          )}
        </button>
      </nav>
    </div>
  );
}
