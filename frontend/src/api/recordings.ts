import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
});

export interface Recording {
  filename: string;
  filepath: string;
  timestamp: string;
  target_word?: string;
  size: number;
  transcription?: string;
  phoneme_transcription?: string;
  prompt?: string;
}

export interface StoryMode {
  story_mode: string;
  recordings: Recording[];
  total_recordings: number;
}

export interface StoryRecording {
  story_id: string;
  story_title: string;
  story_modes: StoryMode[];
  target_words: string[];
  target_sounds: string[];
  pronunciation_statistics: Record<string, number>;
  total_recordings: number;
}

export interface RecordingsResponse {
  success: boolean;
  recordings: StoryRecording[];
  user_id: string;
}

export interface PronunciationAnalysis {
  success: boolean;
  story_id?: string;
  user_id: string;
  target_words: string[];
  analysis_results: any;
  all_stories_analysis?: Record<string, any>;
}

export async function getRecordingsList(userId: string): Promise<RecordingsResponse> {
  const { data } = await api.get<RecordingsResponse>('/api/recordings/list', {
    params: { user_id: userId }
  });
  return data;
}

export async function getPronunciationAnalysis(userId: string, storyId?: string): Promise<PronunciationAnalysis> {
  const { data } = await api.get<PronunciationAnalysis>('/api/recordings/pronunciation-analysis', {
    params: { user_id: userId, story_id: storyId }
  });
  return data;
}

export function getRecordingAudioUrl(filepath: string, userId: string): string {
  return `/api/recordings/audio/${filepath}?user_id=${encodeURIComponent(userId)}`;
}


