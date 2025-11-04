// src/components/PronunciationModal.tsx
import { useState } from 'react';
import { useRecording } from '../hooks/useAudioandRecord';
import { uploadAndTranscribe, sendUserInput } from '../api/story';
import { useNotifications } from '../hooks/useNotifications';

interface Props {
  sentence: string;
  userId: string;
  storyId: string;
  storyMode: string;
  isSidebarPractice?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PronunciationModal({ 
  sentence, 
  userId, 
  storyId, 
  storyMode, 
  isSidebarPractice = false, 
  onClose, 
  onSuccess 
}: Props) {
  const { push: notify } = useNotifications();
  const [transcribedText, setTranscribed] = useState('');
  const [showResult, setShowResult] = useState(false);

  const uploadRecording = async (blob: Blob) => {
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');
    fd.append('user_id', userId);
    fd.append('story_id', storyId);
    fd.append('story_mode', storyMode);
    
    try {
      const data = await uploadAndTranscribe(fd);
      if (data?.success && data.transcribed_text) {
        setTranscribed(data.transcribed_text);
        setShowResult(true);
        notify('success', '🎤 Speech recognized!');
      } else {
        notify('error', 'Transcription failed');
      }
    } catch (e) {
      notify('error', 'Upload failed');
    }
  };

  const { recording, start, stop } = useRecording(uploadRecording);

  const toggleRecording = async () => {
    if (recording) {
      await stop();
      notify('info', '🎤 Processing...');
    } else {
      try {
        await start();
        notify('info', '🎤 Recording...');
      } catch (e: any) {
        notify('error', `Recording failed: ${e.message}`);
      }
    }
  };

  const handleRetry = () => {
    setShowResult(false);
    setTranscribed('');
  };

  const handleConfirm = async () => {
    if (!transcribedText) {
      notify('error', 'No transcribed text');
      return;
    }

    try {
      notify('info', '🔄 Processing...');
      
      // sidebar practice인 경우 서버에 전송하지만 스토리는 진행하지 않음
      const data = await sendUserInput({ 
        user_id: userId, 
        story_id: storyId, 
        story_mode: storyMode, 
        input: transcribedText,
        retry_count: 0,
        sidebar_practice: isSidebarPractice 
      });

      if (data?.success) {
        notify('success', isSidebarPractice ? '🎯 Practice completed!' : '✅ Pronunciation processed!');
        onClose();
        
        // sidebar practice가 아닌 경우에만 onSuccess 콜백 실행
        if (!isSidebarPractice && onSuccess) {
          await onSuccess();
        }
      } else {
        if (data?.retry_required && data?.missing_words) {
          notify('warning', `Please include: ${data.missing_words.join(', ')}`);
        } else {
          notify('error', 'Processing failed');
        }
      }
    } catch (e) {
      notify('error', 'Processing error');
    }
  };

  return (
    <>
      <div className="sentence-pronunciation-overlay show" onClick={onClose} />
      <div className="sentence-pronunciation-prompt" style={{ transform: 'scale(1)' }}>
        <div className="sentence-pronunciation-header">
          <h3>🎤 Follow the sentence and say it!</h3>
          <button className="close-prompt-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="sentence-pronunciation-content">
          <div className="target-sentence">
            <p className="sentence-label">Follow the sentence and say it:</p>
            <p className="sentence-text">"{sentence}"</p>
          </div>

          <div className="recording-controls">
            <button
              id="sentence-record-btn"
              className={`record-btn ${recording ? 'recording' : ''}`}
              onClick={toggleRecording}
            >
              {recording ? '⏹️ Stop recording' : '🎤 Start recording'}
            </button>
            
            {recording && (
              <div className="recording-status">
                <span className="recording-indicator">🔴 Recording...</span>
                <p className="recording-instruction">Click again to stop recording</p>
              </div>
            )}
          </div>

          {showResult && transcribedText && (
            <div className="pronunciation-result">
              <p className="result-label">Recognized sentence:</p>
              <p className="result-text">"{transcribedText}"</p>
              <div className="result-actions">
                <button className="retry-btn" onClick={handleRetry}>🔄 Retry</button>
                <button className="confirm-btn" onClick={handleConfirm}>✅ Good!</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

