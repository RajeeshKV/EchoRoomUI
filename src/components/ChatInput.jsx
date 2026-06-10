import { useState, useRef } from 'react';
import VoiceRecorder from './VoiceRecorder';
import MediaPreview from './MediaPreview';
import './ChatInput.css';

export default function ChatInput({
  onSend,
  onTyping,
  placeholder,
  disabled,
  replyingTo,
  onCancelReply,
  uploadMedia,
}) {
  const [message, setMessage] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentKind, setAttachmentKind] = useState(null);
  const [uploadedAttachment, setUploadedAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);

  const handleChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) {
      clearTimeout(typingTimer.current);
      onTyping();
      typingTimer.current = setTimeout(() => {}, 2000);
    }
  };

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine kind
    let kind = null;
    if (file.type.startsWith('image/')) {
      kind = 'image';
    } else if (file.type.startsWith('video/')) {
      kind = 'video';
    } else if (file.type.startsWith('audio/') || file.name.endsWith('.webm') || file.name.endsWith('.ogg') || file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.m4a')) {
      kind = 'voice';
    } else {
      alert('Unsupported file type! Please choose an image, video, or audio file.');
      return;
    }

    // Size check
    const sizeMB = file.size / (1024 * 1024);
    if (kind === 'image' && sizeMB > 10) {
      alert('Image file size exceeds the 10MB limit.');
      return;
    } else if (kind === 'voice' && sizeMB > 15) {
      alert('Voice/audio file size exceeds the 15MB limit.');
      return;
    } else if (kind === 'video' && sizeMB > 50) {
      alert('Video file size exceeds the 50MB limit.');
      return;
    }

    setAttachmentFile(file);
    setAttachmentKind(kind);
    setUploading(true);

    try {
      const attachment = await uploadMedia(file, kind);
      setUploadedAttachment(attachment);
    } catch (err) {
      console.error(err);
      alert('Failed to upload attachment. Please try again.');
      setAttachmentFile(null);
      setAttachmentKind(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRecordingComplete = async (audioFile) => {
    setAttachmentFile(audioFile);
    setAttachmentKind('voice');
    setUploading(true);
    setIsRecording(false);

    try {
      const attachment = await uploadMedia(audioFile, 'voice');
      setUploadedAttachment(attachment);
    } catch (err) {
      console.error(err);
      alert('Failed to upload voice note. Please try again.');
      setAttachmentFile(null);
      setAttachmentKind(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentKind(null);
    setUploadedAttachment(null);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const messageTrimmed = message.trim();
    if (disabled || uploading || isRecording) return;
    if (!messageTrimmed && !uploadedAttachment) return; // need text or attachment to send

    onSend(
      messageTrimmed,
      uploadedAttachment,
      replyingTo ? replyingTo.id || replyingTo.messageId : null
    );

    // Reset fields
    setMessage('');
    setAttachmentFile(null);
    setAttachmentKind(null);
    setUploadedAttachment(null);
    if (onCancelReply) onCancelReply();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isSendDisabled = disabled || uploading || isRecording || (!message.trim() && !uploadedAttachment);

  return (
    <div className="chat-input-wrapper">
      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="reply-preview-bar animate-fade">
          <div className="reply-preview-content">
            <svg className="reply-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <polyline points="9 17 4 12 9 7"/>
              <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
            </svg>
            <div className="reply-details">
              <span className="reply-label">Replying to <strong className="reply-user">{replyingTo.sender}</strong></span>
              <span className="reply-text">
                {replyingTo.message || (replyingTo.attachmentKind ? `[${replyingTo.attachmentKind}]` : '') || (replyingTo.attachment ? `[${replyingTo.attachment.kind}]` : '')}
              </span>
            </div>
          </div>
          <button type="button" className="reply-close" onClick={onCancelReply} title="Cancel reply">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      {/* Attachment Preview (if any) */}
      {attachmentFile && (
        <MediaPreview
          file={attachmentFile}
          kind={attachmentKind}
          uploading={uploading}
          onRemove={handleRemoveAttachment}
        />
      )}

      {/* Main Input Controls */}
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*"
          style={{ display: 'none' }}
        />

        {isRecording ? (
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onCancel={() => setIsRecording(false)}
          />
        ) : (
          <>
            {/* Attachment Button */}
            <button
              type="button"
              className="chat-action-btn"
              onClick={handleFileClick}
              disabled={disabled || uploading}
              title="Add attachment (Image/Video/Audio)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>

            {/* Voice Recorder Toggle Button */}
            <button
              type="button"
              className="chat-action-btn"
              onClick={() => setIsRecording(true)}
              disabled={disabled || uploading}
              title="Record voice note"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>

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

            <button type="submit" disabled={isSendDisabled} title="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </>
        )}
      </form>
    </div>
  );
}
