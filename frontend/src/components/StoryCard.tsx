import { useState } from 'react';
import { type Story } from '../types/story.ts';
import styles from '../styles/StoryCard.module.css';

interface StoryCardProps {
    story: Story;
    onStartStory: (storyId: string, mode: 'sentence' | 'word') => Promise<void>;
  }
  
export function StoryCard({ story, onStartStory }: StoryCardProps) {
    const [selectedMode, setSelectedMode] = useState<'sentence' | 'word' | null>(null);
    const [loading, setLoading] = useState(false);
  
    const handleModeSelect = (mode: 'sentence' | 'word') => {
      setSelectedMode(mode);
    };
  
    const handleStart = async () => {
      if (!selectedMode) {
        alert('Please select a practice mode first.');
        return;
      }
  
      setLoading(true);
      try {
        await onStartStory(story.id, selectedMode);
      } catch (error) {
        console.error('Failed to start story:', error);
        alert('Failed to start the story. Please try again.');
      } finally {
        setLoading(false);
      }
    };
  
    // Format target words (remove curly braces)
    const targetWords = story.target_words.map(word => word.replace(/[{}]/g, ''));
    const displayWords = targetWords.slice(0, 6);
    const remainingWords = targetWords.length - 6;
    
    // Format target sounds
    const formatSound = (theme: string) => {
        return theme
        .replace('words_with_', '')
        .replace('_initial', ' sound')
        .replace('_', ' ')
        .toUpperCase();
    };
  
    return (
      <div className={styles.storyItem}>
        <div className={styles.storyHeader}>
          <h3 className={styles.storyTitle}>{story.title}</h3>
          <span className={styles.storyId}>{story.id}</span>
        </div>
  
        <div className={styles.storyDetails}>
          <div className={styles.storyTargets}>
            <div className={styles.targetSection}>
              <h4 className={styles.targetTitle}>🎯 Target Words</h4>
              <div className={styles.storyWords}>
                {displayWords.map((word, idx) => (
                  <span key={idx} className={styles.wordTag}>
                    {word}
                  </span>
                ))}
                {remainingWords > 0 && (
                  <span className={`${styles.wordTag} ${styles.more}`}>
                    +{remainingWords} more
                  </span>
                )}
              </div>
            </div>
  
            <div className={styles.targetSection}>
              <h4 className={styles.targetTitle}>🔊 Target Sounds</h4>
              <div className={styles.storySounds}>
                {story.target_sounds.length > 0 ? (
                  story.target_sounds.map((sound, idx) => (
                    <span key={idx} className={styles.soundTag}>
                      {formatSound(sound)}
                    </span>
                  ))
                ) : (
                  <span className={styles.soundTag}>No target sounds</span>
                )}
              </div>
            </div>
          </div>
        </div>
  
        <div className={styles.storyModes}>
          <div
            className={`${styles.modeOption} ${
              selectedMode === 'sentence' ? styles.selected : ''
            }`}
            onClick={() => handleModeSelect('sentence')}
          >
            <div className={styles.modeTitle}>📝 Sentence Mode</div>
            <div className={styles.modeDescription}>Practice full sentences</div>
          </div>
  
          <div
            className={`${styles.modeOption} ${
              selectedMode === 'word' ? styles.selected : ''
            }`}
            onClick={() => handleModeSelect('word')}
          >
            <div className={styles.modeTitle}>🔤 Word Mode</div>
            <div className={styles.modeDescription}>Practice individual words</div>
          </div>
        </div>
  
        <button
          className={styles.startButton}
          onClick={handleStart}
          disabled={!selectedMode || loading}
        >
          {loading ? (
            <>
              <span className={styles.loading}></span> Starting story...
            </>
          ) : (
            '🚀 Start Story'
          )}
        </button>
      </div>
    );
  }