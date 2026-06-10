import { useRef, useEffect, useState } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import './GroupChat.css';

export default function GroupChat({
  messages,
  currentUser,
  onSend,
  onTyping,
  typingUsers,
  connectionStatus,
  uploadMedia,
}) {
  const listRef = useRef(null);
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  const handleSend = (text, attachment, replyToId) => {
    onSend(text, attachment, replyToId);
    setReplyingTo(null);
  };

  return (
    <section className="group-chat">
      <div className="gc-header">
        <div className="gc-header-info">
          <h2 className="gc-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Group Chat
          </h2>
          <span className={`gc-status gc-status--${connectionStatus}`}>
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'reconnecting' ? 'Reconnecting…' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="gc-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="gc-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.sender === currentUser;
          const showSender = !isOwn && (i === 0 || messages[i - 1]?.sender !== msg.sender);
          return (
            <MessageBubble
              key={msg.id || i}
              message={msg}
              isOwn={isOwn}
              showSender={showSender}
              onReply={setReplyingTo}
            />
          );
        })}
      </div>

      <TypingIndicator users={typingUsers.filter((u) => u !== currentUser)} />
      <ChatInput
        onSend={handleSend}
        onTyping={() => onTyping()}
        placeholder="Message the group..."
        disabled={connectionStatus !== 'connected'}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        uploadMedia={uploadMedia}
      />
    </section>
  );
}
