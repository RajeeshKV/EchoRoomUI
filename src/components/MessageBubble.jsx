import { useState, useRef, useEffect } from 'react';
import Avatar from './Avatar';
import { formatTime } from '../utils/formatTime';
import { config } from '../config';
import './MessageBubble.css';

export default function MessageBubble({ message, isOwn, showSender, onReply }) {
  const sender = message.sender;
  const time = formatTime(message.sentAt);

  // Audio Player State (for voice notes)
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lightbox Modal State (for images)
  const [showLightbox, setShowLightbox] = useState(false);

  // Auto-load metadata for audio to display correct initial duration
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatAudioTime = (timeSecs) => {
    if (isNaN(timeSecs)) return '0:00';
    const mins = Math.floor(timeSecs / 60);
    const secs = Math.floor(timeSecs % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleScrollToOriginal = (e) => {
    e.preventDefault();
    const replyId = message.replyTo?.messageId;
    if (!replyId) return;

    const element = document.getElementById(`msg-${replyId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('msg-highlight-flash');
      setTimeout(() => {
        element.classList.remove('msg-highlight-flash');
      }, 1500);
    } else {
      alert('Original message not found in history.');
    }
  };

  // Render Attachment Helper
  const renderAttachment = () => {
    if (!message.attachment) return null;

    const attachmentUrl = message.attachment.url.startsWith('http')
      ? message.attachment.url
      : `${config.API_BASE_URL}${message.attachment.url}`;

    switch (message.attachment.kind) {
      case 'image':
        return (
          <div className="msg-attachment msg-attachment--image">
            <img
              src={attachmentUrl}
              alt={message.attachment.fileName || 'Image attachment'}
              className="msg-img-thumb"
              onClick={() => setShowLightbox(true)}
              loading="lazy"
            />
            {showLightbox && (
              <div className="lightbox-overlay" onClick={() => setShowLightbox(false)}>
                <button className="lightbox-close" onClick={() => setShowLightbox(false)}>✕</button>
                <img
                  src={attachmentUrl}
                  alt={message.attachment.fileName || 'Full Screen View'}
                  className="lightbox-image animate-fade"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        );
      case 'video':
        return (
          <div className="msg-attachment msg-attachment--video">
            <video
              src={attachmentUrl}
              controls
              className="msg-video-player"
              preload="metadata"
            />
          </div>
        );
      case 'voice':
        return (
          <div className="msg-attachment msg-attachment--voice">
            <audio
              ref={audioRef}
              src={attachmentUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            />
            <div className="custom-audio-player">
              <button type="button" className="audio-play-btn" onClick={togglePlay}>
                {isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                    <rect x="14" y="4" width="4" height="16" rx="1"></rect>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                )}
              </button>
              
              <div className="audio-slider-container">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="audio-progress-bar"
                />
                <div className="audio-time-row">
                  <span>{formatAudioTime(currentTime)}</span>
                  <span>{formatAudioTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="msg-attachment msg-attachment--generic">
            <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="generic-attachment-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
              <span>{message.attachment.fileName || 'Download File'}</span>
            </a>
          </div>
        );
    }
  };

  return (
    <div id={`msg-${message.id}`} className={`msg-row ${isOwn ? 'msg-row--own' : ''}`}>
      {!isOwn && showSender && <Avatar username={sender} size={32} />}
      {!isOwn && !showSender && <div className="msg-avatar-spacer" />}
      
      <div className="msg-bubble-wrapper">
        <div className={`msg-bubble ${isOwn ? 'msg-bubble--own' : ''}`}>
          {/* Reply Reference Panel */}
          {message.replyTo && (
            <button className="msg-reply-ref" onClick={handleScrollToOriginal}>
              <div className="reply-ref-border"></div>
              <div className="reply-ref-content">
                <span className="reply-ref-sender">{message.replyTo.sender}</span>
                <span className="reply-ref-text">
                  {message.replyTo.message || 
                   (message.replyTo.attachmentKind ? `[${message.replyTo.attachmentKind}]` : 'Attachment')}
                </span>
              </div>
            </button>
          )}

          {!isOwn && showSender && <span className="msg-sender">{sender}</span>}
          
          {/* Media Attachment */}
          {renderAttachment()}

          {/* Message Text */}
          {message.message && <p className="msg-text">{message.message}</p>}
          
          <span className="msg-time">{time}</span>
        </div>

        {/* Reply Trigger Action Button */}
        {onReply && (
          <button
            type="button"
            className="msg-bubble-reply-btn"
            onClick={() => onReply(message)}
            title="Reply to this message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 17 4 12 9 7"/>
              <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
