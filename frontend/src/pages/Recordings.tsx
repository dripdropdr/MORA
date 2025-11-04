// Recordings 대시보드 페이지
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUserId } from '../utils/storage';
import { getRecordingsList, getPronunciationAnalysis } from '../api/recordings';
import type { StoryRecording } from '../api/recordings';
import { StoryRecordingsSection } from '../components/StoryRecordings';
import { UserInfo } from '../components/UserInfo';
import '../styles/Recordings.css';
import '../styles/RecordingsDistance.css';

export function Recordings() {
  const nav = useNavigate();
  const userId = getCurrentUserId();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recordings, setRecordings] = useState<StoryRecording[]>([]);
  const [analysisData, setAnalysisData] = useState<any>(null);

  useEffect(() => {
    if (!userId) {
      nav('/login');
      return;
    }

    loadData();
  }, [userId, nav]);

  const loadData = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError('');

    try {
      // 녹음 목록과 발음 분석을 병렬로 로드
      const [recordingsData, analysisResult] = await Promise.all([
        getRecordingsList(userId),
        getPronunciationAnalysis(userId).catch(e => {
          console.warn('Failed to load pronunciation analysis:', e);
          return null;
        })
      ]);

      if (recordingsData.success) {
        setRecordings(recordingsData.recordings);
        
        if (analysisResult?.success) {
          setAnalysisData(analysisResult.all_stories_analysis || {});
        }
      } else {
        setError('Cannot load recordings list.');
      }
    } catch (e) {
      console.error('Recordings load error:', e);
      setError('Server connection error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (!userId) return null;

  return (
    <div className="container">
      <UserInfo />
      
      <a href="/start" className="back-btn">← Back to Start</a>
      
      <div className="header">
        <h1>🎤 Recordings</h1>
        <p>Check the recordings and transcription results</p>
      </div>

      <div className="recordings-container">
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Loading recordings...</p>
          </div>
        )}

        {error && !loading && (
          <div className="error-message">{error}</div>
        )}

        {!loading && !error && recordings.length === 0 && (
          <div className="no-recordings">
            <h3>📝 No recordings yet</h3>
            <p>Record your voice while progressing through stories!</p>
            <button className="refresh-btn" onClick={loadData}>Refresh</button>
          </div>
        )}

        {!loading && !error && recordings.length > 0 && (
          <div id="recordings-list">
            {recordings.map((story, i) => (
              <StoryRecordingsSection
                key={i}
                story={story}
                userId={userId}
                analysisData={analysisData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

