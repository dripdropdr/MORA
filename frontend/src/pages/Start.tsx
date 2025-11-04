import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchStories, initStory } from '../api/story';
import { getCurrentUserId, setCurrentStory } from '../utils/storage';
import { type Story } from '../types/story';
import { StoryCard } from '../components/StoryCard';
import { UserInfo } from '../components/UserInfo';
import styles from '../styles/Start.module.css';

export function Start() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const userId = getCurrentUserId();

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    loadStories();
  }, [userId, navigate]);

  const loadStories = async () => {
    try {
      setLoading(true);
      
      if (!userId) {
        setError('User not logged in.');
        return;
      }

      // Fetch user's assigned stories from API (already filtered by backend)
      const response = await fetchStories(userId);
      
      if (!response.success) {
        throw new Error('Failed to load stories');
      }

      if (response.stories.length === 0) {
        setError('No stories available for this user.');
        return;
      }

      setStories(response.stories);
    } catch (err: any) {
      console.error('Failed to load stories:', err);
      setError('Failed to load stories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartStory = async (storyId: string, mode: 'sentence' | 'word') => {
    if (!userId) {
      alert('User data not found. Please login again.');
      navigate('/login');
      return;
    }

    try {
      const initData = await initStory(userId, storyId, mode);

      if (!initData.success) {
        throw new Error(initData.message || 'Failed to initialize story');
      }

      // Save minimal story data to localStorage
      const storyData = {
        userId: initData.user_id,
        storyId: storyId,
        sceneId: initData.story_info?.current_scene_id || null,
        dialogueId: initData.story_info?.current_dialogue || 0,
        totalDialogues: initData.story_info?.total_dialogues_in_scene || 0,
        storyMode: mode,
        selectedDestination: initData.story_info?.selected_destination || null,
      };

      setCurrentStory(storyData);

      // Navigate to main app
      navigate('/');
    } catch (error: any) {
      console.error('Story initialization error:', error);
      throw error;
    }
  };

  return (
    <div className={styles.startContainer}>
      <UserInfo />

      <div className={styles.header}>
        <h1>Interactive Story Intervention: prototype</h1>
        <p>Choose a story and practice mode to begin your adventure</p>
      </div>

      <div className={styles.headerActions}>
        {/* <a href="/story-creating" className={styles.headerBtn}>
          <span>📚</span>
          <span>Create Story</span>
        </a> */}
        <a href="/recordings" className={styles.headerBtn}>
          <span>🎤</span>
          <span>Recordings</span>
        </a>
      </div>

      <div className={styles.storiesSection}>
        <h2>📚 Available Stories</h2>
        <div className={styles.storiesList}>
          {loading && (
            <div className={styles.loadingMessage}>
              Loading available stories...
            </div>
          )}

          {error && !loading && (
            <div className={styles.errorMessage}>{error}</div>
          )}

          {!loading && !error && stories.length > 0 && (
            stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onStartStory={handleStartStory}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}