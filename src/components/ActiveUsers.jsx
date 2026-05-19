import Avatar from './Avatar';
import './ActiveUsers.css';

export default function ActiveUsers({ users, currentUser, onSelectUser, privateChatUser, unreadPrivate }) {
  const others = users.filter((u) => u.username !== currentUser);

  return (
    <aside className="active-users">
      <div className="au-header">
        <h2 className="au-title">
          <span className="au-dot" />
          Online
          <span className="au-count">{others.length}</span>
        </h2>
      </div>
      <div className="au-list">
        {others.length === 0 && (
          <p className="au-empty">No other users online</p>
        )}
        {others.map((u) => {
          const unread = unreadPrivate?.[u.username] || 0;
          return (
            <button
              key={u.username}
              className={`au-user ${privateChatUser === u.username ? 'au-user--active' : ''} ${unread > 0 ? 'au-user--unread' : ''}`}
              onClick={() => onSelectUser(u.username)}
            >
              <Avatar username={u.username} size={34} online />
              <span className="au-username">{u.username}</span>
              {unread > 0 && <span className="au-badge">{unread > 9 ? '9+' : unread}</span>}
            </button>
          );
        })}
      </div>
      <div className="au-footer">
        <Avatar username={currentUser} size={30} online />
        <span className="au-current">{currentUser} <span className="au-you">(You)</span></span>
      </div>
    </aside>
  );
}
