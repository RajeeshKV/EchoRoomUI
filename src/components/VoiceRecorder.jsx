import { useState, useRef, useEffect } from 'react';
import './VoiceRecorder.css';

export default function VoiceRecorder({ onRecordingComplete, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Create a File object so it behaves like a standard uploaded file
        const audioFile = new File([audioBlob], 'voice-note.webm', {
          type: 'audio/webm',
          lastModified: Date.now(),
        });
        onRecordingComplete(audioFile);
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check permissions.');
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder-bar animate-fade">
      <div className="recorder-status">
        <span className="recording-dot"></span>
        <span className="recorder-label">Recording Voice Note</span>
        <span className="recorder-time">{formatDuration(duration)}</span>
      </div>

      {/* Bounce waveform animation */}
      <div className="voice-waveform">
        <div className="wave-bar bar-1"></div>
        <div className="wave-bar bar-2"></div>
        <div className="wave-bar bar-3"></div>
        <div className="wave-bar bar-4"></div>
        <div className="wave-bar bar-5"></div>
        <div className="wave-bar bar-4"></div>
        <div className="wave-bar bar-3"></div>
        <div className="wave-bar bar-2"></div>
        <div className="wave-bar bar-1"></div>
      </div>

      <div className="recorder-actions">
        <button type="button" className="recorder-btn btn-cancel" onClick={handleCancel} title="Cancel recording">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <button type="button" className="recorder-btn btn-stop" onClick={stopRecording} title="Stop and use recording">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
          </svg>
        </button>
      </div>
    </div>
  );
}
