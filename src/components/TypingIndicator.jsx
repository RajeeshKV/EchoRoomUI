import './TypingIndicator.css';

export default function TypingIndicator({ users }) {
  if (!users || users.length === 0) return null;
  const text = users.length === 1
    ? `${users[0]} is typing`
    : `${users.slice(0, 2).join(', ')} are typing`;

  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span /><span /><span />
      </div>
      <span className="typing-text">{text}</span>
    </div>
  );
}
