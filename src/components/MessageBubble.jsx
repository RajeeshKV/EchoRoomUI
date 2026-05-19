import Avatar from './Avatar';
import { formatTime } from '../utils/formatTime';
import './MessageBubble.css';

export default function MessageBubble({ message, isOwn, showSender }) {
  const sender = message.sender;
  const time = formatTime(message.sentAt);

  return (
    <div className={`msg-row ${isOwn ? 'msg-row--own' : ''}`}>
      {!isOwn && showSender && <Avatar username={sender} size={32} />}
      {!isOwn && !showSender && <div className="msg-avatar-spacer" />}
      <div className={`msg-bubble ${isOwn ? 'msg-bubble--own' : ''}`}>
        {!isOwn && showSender && <span className="msg-sender">{sender}</span>}
        <p className="msg-text">{message.message}</p>
        <span className="msg-time">{time}</span>
      </div>
    </div>
  );
}
