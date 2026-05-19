import { useChat } from './hooks/useChat';
import LoginScreen from './components/LoginScreen';
import ActiveUsers from './components/ActiveUsers';
import GroupChat from './components/GroupChat';
import PrivateChat from './components/PrivateChat';
import './App.css';

export default function App() {
  const chat = useChat();

  const handleLogin = async (username) => {
    const data = await chat.login(username);
    await chat.connectHub(data.token);
  };

  const handleSelectUser = (username) => {
    chat.joinPrivateRoom(username);
  };

  const handleClosePrivate = () => {
    // Clear the private chat selection (no hub method needed)
    chat.joinPrivateRoom(null);
  };

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
          Logout
        </button>
      </header>

      {/* 3-panel layout */}
      <main className="app-main">
        <ActiveUsers
          users={chat.activeUsers}
          currentUser={chat.user}
          onSelectUser={handleSelectUser}
          privateChatUser={chat.privateChatUser}
          unreadPrivate={chat.unreadPrivate}
        />
        <GroupChat
          messages={chat.groupMessages}
          currentUser={chat.user}
          onSend={chat.sendGroupMessage}
          onTyping={chat.sendTyping}
          typingUsers={chat.typingUsers}
          connectionStatus={chat.connectionStatus}
        />
        <PrivateChat
          messages={chat.privateMessages}
          currentUser={chat.user}
          privateChatUser={chat.privateChatUser}
          onSend={chat.sendPrivateMessage}
          onTyping={chat.sendTyping}
          typingUser={chat.privateTypingUser}
          onClose={handleClosePrivate}
        />
      </main>
    </div>
  );
}
