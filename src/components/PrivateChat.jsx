import { useRef, useEffect } from 'react';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import './PrivateChat.css';

export default function PrivateChat({ messages, currentUser, privateChatUser, onSend, onTyping, typingUser, onClose }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, typingUser]);

  if (!privateChatUser) {
    return (
      <aside className="private-chat">
        <div className="pc-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <h3>Private Messages</h3>
          <p>Select a user from the sidebar to start a private conversation</p>
        </div>
      </aside>
    );
  }

  // Filter messages for this conversation
  const filtered = messages.filter(
    (m) =>
      (m.sender === currentUser && m.receiver === privateChatUser) ||
      (m.sender === privateChatUser && m.receiver === currentUser)
  );

  const typingArr = typingUser === privateChatUser ? [typingUser] : [];

  return (
    <aside className="private-chat">
      <div className="pc-header">
        <Avatar username={privateChatUser} size={34} online />
        <div className="pc-header-info">
          <h3 className="pc-header-name">{privateChatUser}</h3>
          <span className="pc-header-status">Private conversation</span>
        </div>
        <button className="pc-close" onClick={onClose} title="Close chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="pc-messages" ref={listRef}>
        {filtered.length === 0 && (
          <div className="pc-msg-empty">
            <p>No messages yet. Say hello to <strong>{privateChatUser}</strong>!</p>
          </div>
        )}
        {filtered.map((msg, i) => {
          const isOwn = msg.sender === currentUser;
          const showSender = !isOwn && (i === 0 || filtered[i - 1]?.sender !== msg.sender);
          return <MessageBubble key={i} message={msg} isOwn={isOwn} showSender={showSender} />;
        })}
      </div>

      <TypingIndicator users={typingArr} />
      <ChatInput
        onSend={(msg) => onSend(privateChatUser, msg)}
        onTyping={() => onTyping(privateChatUser)}
        placeholder={`Message ${privateChatUser}...`}
      />
    </aside>
  );
}
