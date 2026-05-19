import { useState, useRef } from 'react';
import './ChatInput.css';

export default function ChatInput({ onSend, onTyping, placeholder, disabled }) {
  const [message, setMessage] = useState('');
  const typingTimer = useRef(null);

  const handleChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) {
      clearTimeout(typingTimer.current);
      onTyping();
      typingTimer.current = setTimeout(() => {}, 2000);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;
    onSend(message);
    setMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type a message...'}
        maxLength={500}
        disabled={disabled}
        autoComplete="off"
      />
      <button type="submit" disabled={!message.trim() || disabled} title="Send">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}
