import { getInitial, getAvatarColor } from '../utils/formatTime';
import './Avatar.css';

export default function Avatar({ username, size = 36, online }) {
  const color = getAvatarColor(username);
  return (
    <div className="avatar" style={{ width: size, height: size, background: color }}>
      <span style={{ fontSize: size * 0.4 }}>{getInitial(username)}</span>
      {online && <span className="avatar-online" />}
    </div>
  );
}
