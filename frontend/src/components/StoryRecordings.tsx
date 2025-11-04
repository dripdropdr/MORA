// 스토리별 녹음 섹션
import { useState } from 'react';
import type { StoryRecording } from '../api/recordings';
import { RecordingItem } from './RecordingItem';
import { AccuracyPieChart } from './AccuracyPieChart';
import { calculateAccuracyStats, formatTargetSound } from '../utils/recordings';

interface Props {
  story: StoryRecording;
  userId: string;
  analysisData?: any;
}

export function StoryRecordingsSection({ story, userId, analysisData }: Props) {
  const [expanded, setExpanded] = useState(false);

  const accuracyStats = calculateAccuracyStats(story.story_id, story.story_modes, analysisData);

  // Pronunciation statistics 표시
  const renderStatistics = () => {
    if (!story.pronunciation_statistics || !story.target_words || story.target_words.length === 0) {
      return null;
    }

    const wordsWithCounts = story.target_words.map(word => {
      const cleanWord = word.replace(/[{}]/g, '').trim().toLowerCase();
      const count = story.pronunciation_statistics[cleanWord] || 0;
      const displayWord = word.replace(/[{}]/g, '').trim();
      
      return { displayWord, count };
    }).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.displayWord.localeCompare(b.displayWord);
    });

    return (
      <div className="pronunciation-statistics">
        <div className="stats-label">📊 Pronunciation Count:</div>
        <div className="stats-items">
          {wordsWithCounts.map((item, i) => {
            let colorClass = 'stat-low';
            if (item.count >= 5) colorClass = 'stat-high';
            else if (item.count >= 2) colorClass = 'stat-medium';
            
            return (
              <span key={i} className={`pronunciation-stat ${colorClass}`}>
                {item.displayWord}: {item.count}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // Target sounds 표시
  const renderTargetSounds = () => {
    if (!story.target_sounds || story.target_sounds.length === 0) return null;

    return (
      <div className="target-sounds">
        <div className="sounds-container">
          {story.target_sounds.map((sound, i) => (
            <span key={i} className="sound-badge">
              {formatTargetSound(sound)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="story-section">
      <div className="story-header" onClick={() => setExpanded(!expanded)}>
        <div className="story-header-content">
          {renderTargetSounds()}
          <div className="story-main-info">
            <h3>📚 {story.story_title || `Story ${story.story_id}`}</h3>
            <p>{story.total_recordings} recordings total</p>
            {renderStatistics()}
          </div>
          {accuracyStats && (
            <div className="story-accuracy-stats">
              <AccuracyPieChart stats={accuracyStats} />
            </div>
          )}
        </div>
      </div>

      <div className={`story-content ${expanded ? 'active' : ''}`}>
        {story.story_modes.length === 0 ? (
          <p className="no-transcription">No recordings in this story.</p>
        ) : (
          story.story_modes.map((mode, i) => (
            <ModeSection
              key={i}
              mode={mode}
              storyId={story.story_id}
              userId={userId}
              analysisData={analysisData}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ModeSection({ mode, storyId, userId, analysisData }: {
  mode: any;
  storyId: string;
  userId: string;
  analysisData?: any;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mode-section">
      <div className="mode-header" onClick={() => setExpanded(!expanded)}>
        <h4>🎯 {mode.story_mode} mode</h4>
        <p>{mode.total_recordings} recordings</p>
      </div>

      <div className={`mode-content ${expanded ? 'active' : ''}`}>
        {mode.recordings.length === 0 ? (
          <p className="no-transcription">No recordings in this mode.</p>
        ) : (
          mode.recordings.map((recording: any, i: number) => (
            <RecordingItem
              key={i}
              recording={recording}
              storyId={storyId}
              storyMode={mode.story_mode}
              userId={userId}
              analysisData={analysisData}
            />
          ))
        )}
      </div>
    </div>
  );
}


