export function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getInitial(username) {
  return username ? username.charAt(0).toUpperCase() : '?';
}

export function getAvatarColor(username) {
  const colors = ['#6c5ce7', '#e17055', '#00b894', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#d63031'];
  let hash = 0;
  for (let i = 0; i < (username || '').length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
