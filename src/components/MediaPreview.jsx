import { useState, useEffect } from 'react';
import './MediaPreview.css';

export default function MediaPreview({ file, kind, uploading, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) return;

    // Only create object URL for images and videos for preview
    if (kind === 'image' || kind === 'video') {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file, kind]);

  if (!file) return null;

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getMediaIcon = () => {
    switch (kind) {
      case 'video':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
        );
      case 'voice':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        );
    }
  };

  return (
    <div className="media-preview-container animate-fade">
      <div className="media-preview-card">
        {/* Render actual image if it's an image */}
        {kind === 'image' && previewUrl ? (
          <img src={previewUrl} alt="Upload preview" className="media-preview-thumbnail" />
        ) : kind === 'video' && previewUrl ? (
          <video src={previewUrl} className="media-preview-thumbnail" muted />
        ) : (
          <div className="media-preview-icon-wrapper">
            {getMediaIcon()}
          </div>
        )}

        <div className="media-preview-details">
          <span className="media-preview-name">{file.name || 'Voice Note'}</span>
          <span className="media-preview-size">{formatSize(file.size)}</span>
        </div>

        {uploading && (
          <div className="media-preview-uploading-overlay">
            <div className="uploading-spinner"></div>
            <span className="uploading-text">Uploading...</span>
          </div>
        )}

        {!uploading && (
          <button type="button" className="media-preview-remove" onClick={onRemove} title="Remove attachment">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
