// 개별 녹음 아이템
import { useState } from 'react';
import type { Recording } from '../api/recordings';
import { formatTimestamp, getDistanceColor, getDistanceLabel } from '../utils/recordings';
import { getRecordingAudioUrl } from '../api/recordings';

interface Props {
  recording: Recording;
  storyId: string;
  storyMode: string;
  userId: string;
  analysisData?: any;
}

export function RecordingItem({ recording, storyId, storyMode, userId, analysisData }: Props) {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const timestamp = formatTimestamp(recording.timestamp);
  
  // 파일 경로 구성
  const audioPath = `user_${userId}/story_${storyId}/mode_${storyMode}/${recording.filename}`;
  const audioUrl = getRecordingAudioUrl(audioPath, userId);

  // Distance 정보 가져오기
  const getDistanceInfo = () => {
    if (!analysisData || !analysisData[storyId]) return null;
    
    const storyAnalysis = analysisData[storyId];
    const modeKey = storyMode === 'word' ? 'word_mode' : 'sentence_mode';
    const modeAnalysis = storyAnalysis.analysis?.[modeKey];
    
    if (!modeAnalysis) return null;
    
    const recordingName = recording.filename.replace('.wav', '');
    const analysisEntry = modeAnalysis[recordingName];
    
    if (!analysisEntry || !analysisEntry.length) return null;
    
    const distances = analysisEntry.map((item: any) => item.distance).filter((d: number) => d !== Infinity);
    if (distances.length === 0) return null;
    
    const bestDistance = Math.min(...distances);
    return {
      distance: bestDistance,
      color: getDistanceColor(bestDistance),
      label: getDistanceLabel(bestDistance)
    };
  };

  const distanceInfo = getDistanceInfo();

  const togglePlay = () => {
    if (playing && audio) {
      audio.pause();
      setPlaying(false);
      setAudio(null);
    } else {
      const newAudio = new Audio(audioUrl);
      newAudio.addEventListener('ended', () => {
        setPlaying(false);
        setAudio(null);
      });
      newAudio.addEventListener('error', () => {
        setPlaying(false);
        setAudio(null);
        alert('Cannot play audio file.');
      });
      newAudio.play();
      setAudio(newAudio);
      setPlaying(true);
    }
  };

  return (
    <div className="recording-item">
      <div className="recording-header">
        <div className="recording-meta">
          <span className="timestamp">🕒 {timestamp}</span>
          {recording.target_word && (
            <span className="target-word">🎯 {recording.target_word}</span>
          )}
          {distanceInfo && (
            <span 
              className={`distance-info ${distanceInfo.color}`}
              title={`Pronunciation accuracy: ${distanceInfo.distance.toFixed(2)}`}
            >
              📊 {distanceInfo.label}
            </span>
          )}
        </div>
        <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={togglePlay}>
          {playing ? '⏸ Stop' : '▶ Play'}
        </button>
      </div>

      {storyMode === 'sentence' && recording.prompt && (
        <div className="prompt-section">
          <span className="prompt-label">💬</span>
          <span className="prompt-text">{recording.prompt}</span>
        </div>
      )}

      <div className="transcription-section">
        <div className="transcription-row">
          <div className="transcription-item text-transcription">
            <span className="transcription-label">📝</span>
            <span className="transcription-content">
              {recording.transcription || 'No text transcription yet.'}
            </span>
          </div>
        </div>
        <div className="transcription-row">
          <div className="transcription-item phoneme-transcription">
            <span className="transcription-label">🔤</span>
            <span className="transcription-content">
              {recording.phoneme_transcription || 
                (recording.transcription ? '🔄 Processing...' : 'No phoneme transcription yet.')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


