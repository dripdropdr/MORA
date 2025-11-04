// 문장/단어 발음 연습 팝업
import { useState } from 'react';
import { useRecording } from '../hooks/useAudioandRecord';
import { uploadAndTranscribe } from '../api/story';
import { getUserData } from '../utils/storage';

interface Props {
  sentence: string;
  onConfirm: (transcribed: string) => void;
  onClose: () => void;
  isSidebarPractice?: boolean;
}

export function PronunciationPrompt({ sentence, onConfirm, onClose, isSidebarPractice }: Props) {
  const [transcribed, setTranscribed] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const userData = getUserData();
  const userId = userData?.userId;
  const storyId = userData?.currentStory?.storyId;
  const storyMode = userData?.currentStory?.storyMode || 'sentence';

  const uploadRecording = async (blob: Blob) => {
    if (!userId || !storyId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'recording.webm');
      fd.append('user_id', userId);
      fd.append('story_id', storyId);
      fd.append('story_mode', storyMode);

      const data = await uploadAndTranscribe(fd);
      if (data?.success && data.transcribed_text) {
        setTranscribed(data.transcribed_text);
      } else {
        alert('Transcription failed');
      }
    } catch (e) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const { recording, start, stop } = useRecording(uploadRecording);

  const toggleRecording = async () => {
    if (recording) {
      await stop();
    } else {
      try {
        await start();
      } catch (e: any) {
        alert(`Recording failed: ${e.message}`);
      }
    }
  };

  const handleConfirm = () => {
    if (transcribed) {
      onConfirm(transcribed);
    }
  };

  const handleRetry = () => {
    setTranscribed(null);
  };

  return (
    <div className="sentence-pronunciation-overlay show">
      <div className="sentence-pronunciation-prompt">
        <div className="sentence-pronunciation-header">
          <h3>🎤 {isSidebarPractice ? 'Practice Word' : 'Follow the sentence and say it!'}</h3>
          <button className="close-prompt-btn" onClick={onClose}>×</button>
        </div>
        <div className="sentence-pronunciation-content">
          <div className="target-sentence">
            <p className="sentence-label">{isSidebarPractice ? 'Practice word:' : 'Follow the sentence and say it:'}</p>
            <p className="sentence-text">"{sentence}"</p>
          </div>
          
          <div className="recording-controls">
            <button 
              id="sentence-record-btn" 
              className={`record-btn ${recording ? 'recording' : ''}`}
              onClick={toggleRecording}
              disabled={uploading}
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

          {transcribed && (
            <div className="pronunciation-result">
              <p className="result-label">Recognized sentence:</p>
              <p className="result-text">"{transcribed}"</p>
              <div className="result-actions">
                <button className="retry-btn" onClick={handleRetry}>🔄 Retry</button>
                <button className="confirm-btn" onClick={handleConfirm}>✅ Good!</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


