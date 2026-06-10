import { useRef, useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import './PrivateChat.css';

export default function PrivateChat({
  messages,
  currentUser,
  privateChatUser,
  onSend,
  onTyping,
  typingUser,
  onClose,
  users,
  onSelectUser,
  unreadPrivate,
  recentContacts,
  uploadMedia,
}) {
  const listRef = useRef(null);
  const [replyingTo, setReplyingTo] = useState(null);

  // Clear reply state when switching chats
  useEffect(() => {
    setReplyingTo(null);
  }, [privateChatUser]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, typingUser]);

  // Build the contact list by merging persisted recent contacts + online users
  const contactList = useMemo(() => {
    const onlineSet = new Set((users || []).map((u) => u.username));
    const contactMap = new Map();

    // 1) Start with persisted recent contacts (these survive across sessions)
    (recentContacts || []).forEach((c) => {
      if (c.username !== currentUser) {
        contactMap.set(c.username, {
          username: c.username,
          lastMessage: c.lastMessage || '',
          lastTime: c.lastTime || 0,
          isOnline: onlineSet.has(c.username),
        });
      }
    });

    // 2) Scan current in-memory private messages to update previews
    (messages || []).forEach((msg) => {
      const partner = msg.sender === currentUser ? msg.receiver : msg.sender;
      if (!partner || partner === currentUser) return;

      const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
      const existing = contactMap.get(partner);

      if (!existing || msgTime > existing.lastTime) {
        contactMap.set(partner, {
          username: partner,
          lastMessage: msg.content || msg.text || '',
          lastTime: msgTime,
          lastSender: msg.sender,
          isOnline: onlineSet.has(partner),
        });
      }
    });

    // 3) Also add online users who haven't been chatted with yet
    (users || []).forEach((u) => {
      if (u.username !== currentUser && !contactMap.has(u.username)) {
        contactMap.set(u.username, {
          username: u.username,
          lastMessage: '',
          lastTime: 0,
          lastSender: null,
          isOnline: true,
        });
      }
    });

    // Sort: users with unread first, then by most recent message, then online users
    return Array.from(contactMap.values()).sort((a, b) => {
      const unreadA = unreadPrivate?.[a.username] || 0;
      const unreadB = unreadPrivate?.[b.username] || 0;
      if (unreadA !== unreadB) return unreadB - unreadA;
      if (a.lastTime !== b.lastTime) return b.lastTime - a.lastTime;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
  }, [recentContacts, messages, users, currentUser, unreadPrivate]);

  // Format relative time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // ===== Contact List View (no user selected) =====
  if (!privateChatUser) {
    return (
      <aside className="private-chat">
        <div className="pc-contacts-header">
          <h2 className="pc-contacts-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            Private Messages
          </h2>
        </div>
        <div className="pc-contacts-list">
          {contactList.length === 0 ? (
            <div className="pc-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              <h3>No conversations yet</h3>
              <p>Select a user from the online list to start a private conversation</p>
            </div>
          ) : (
            contactList.map((chat) => {
              const unread = unreadPrivate?.[chat.username] || 0;
              const preview = chat.lastMessage
                ? (chat.lastSender === currentUser ? 'You: ' : '') + chat.lastMessage
                : chat.isOnline
                ? 'Online — tap to chat'
                : 'Tap to load conversation';
              return (
                <button
                  key={chat.username}
                  className={`pc-contact-card ${unread > 0 ? 'pc-contact-card--unread' : ''}`}
                  onClick={() => onSelectUser(chat.username)}
                >
                  <Avatar username={chat.username} size={44} online={chat.isOnline} />
                  <div className="pc-contact-info">
                    <div className="pc-contact-top">
                      <span className="pc-contact-name">{chat.username}</span>
                      {chat.lastTime > 0 && (
                        <span className="pc-contact-time">{formatTime(chat.lastTime)}</span>
                      )}
                    </div>
                    <div className="pc-contact-bottom">
                      <span className="pc-contact-preview">{preview}</span>
                      {unread > 0 && (
                        <span className="pc-contact-badge">{unread > 9 ? '9+' : unread}</span>
                      )}
                    </div>
                  </div>
                  <svg className="pc-contact-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              );
            })
          )}
        </div>
      </aside>
    );
  }

  // ===== Active Conversation View =====
  const filtered = messages.filter(
    (m) =>
      (m.sender === currentUser && m.receiver === privateChatUser) ||
      (m.sender === privateChatUser && m.receiver === currentUser)
  );

  const typingArr = typingUser === privateChatUser ? [typingUser] : [];

  const handleSend = (text, attachment, replyToId) => {
    onSend(privateChatUser, text, attachment, replyToId);
    setReplyingTo(null);
  };

  return (
    <aside className="private-chat">
      <div className="pc-header">
        <button className="pc-back" onClick={onClose} title="Back to conversations">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <Avatar username={privateChatUser} size={34} online />
        <div className="pc-header-info">
          <h3 className="pc-header-name">{privateChatUser}</h3>
          <span className="pc-header-status">Private conversation</span>
        </div>
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

      <TypingIndicator users={typingArr} />
      <ChatInput
        onSend={handleSend}
        onTyping={() => onTyping(privateChatUser)}
        placeholder={`Message ${privateChatUser}...`}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        uploadMedia={uploadMedia}
      />
    </aside>
  );
}
