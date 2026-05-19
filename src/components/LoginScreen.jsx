import { useState } from 'react';
import './LoginScreen.css';

export default function LoginScreen({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErr, setValidationErr] = useState('');

  const validate = (val) => {
    if (val.length < 3) return 'Username must be at least 3 characters';
    if (val.length > 20) return 'Username must be 20 characters or less';
    if (!/^[a-zA-Z0-9]+$/.test(val)) return 'Only alphanumeric characters allowed';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate(username);
    if (err) { setValidationErr(err); return; }
    setLoading(true);
    try {
      await onLogin(username);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-bg-orb login-bg-orb--1" />
      <div className="login-bg-orb login-bg-orb--2" />
      <div className="login-card animate-fade">
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="14" fill="var(--accent)" />
            <path d="M14 18C14 15.79 15.79 14 18 14H30C32.21 14 34 15.79 34 18V28C34 30.21 32.21 32 30 32H20L16 36V32H18C15.79 32 14 30.21 14 28V18Z" fill="white" fillOpacity="0.9"/>
            <circle cx="21" cy="23" r="2" fill="var(--accent)"/>
            <circle cx="27" cy="23" r="2" fill="var(--accent)"/>
          </svg>
        </div>
        <h1 className="login-title">EchoRoom</h1>
        <p className="login-subtitle">Real-time chat, instantly connected</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-group">
            <input
              id="username-input"
              type="text"
              placeholder="Choose a username..."
              value={username}
              onChange={(e) => { setUsername(e.target.value); setValidationErr(''); }}
              maxLength={20}
              autoFocus
              autoComplete="off"
            />
            <span className="login-char-count">{username.length}/20</span>
          </div>
          {(validationErr || error) && (
            <p className="login-error">{validationErr || error}</p>
          )}
          <button
            id="login-button"
            type="submit"
            className="login-btn"
            disabled={loading || !username.trim()}
          >
            {loading ? <span className="login-spinner" /> : 'Enter Chat'}
          </button>
        </form>
      </div>
    </div>
  );
}
