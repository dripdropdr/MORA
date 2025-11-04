import axios from 'axios';
// import { type Story } from '../types/story.ts';
import { type StoryStateResponse, type DialogueResponse } from '../types/story.ts';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || '',
  });

  
export interface StoriesResponse {
    success: boolean;
    stories: Array<{ id: string; title: string; target_words: string[]; target_sounds: string[] }>;
    user_id?: string;
  }
  
export interface InitStoryResponse { // interface for initializing a story
    success: boolean;
    message: string;
    user_id: string;
    story_id: string;
    story_info: {
      current_scene_id: string | null;
      current_dialogue: number;
      total_dialogues_in_scene: number;
      story_mode: string;
      selected_destination: string | null;
    };
}
  
export async function fetchStories(userId: string): Promise<StoriesResponse> { // get user's stories
    const { data } = await api.get<StoriesResponse>('/api/stories', {
        params: { user_id: userId }
    });
    return data;
}
  
 export async function initStory( // initialize a story
    userId: string,
    storyId: string,
    storyMode: 'sentence' | 'word'
  ): Promise<InitStoryResponse> {
    const { data } = await api.post<InitStoryResponse>('/api/story/init', {
      user_id: userId,
      story_id: storyId,
      story_mode: storyMode,
    });
    return data;
  }

export async function getStoryState(params: { user_id: string; story_id: string; story_mode: string }) {
    const { data } = await api.get<StoryStateResponse>('/api/story/state', { params });
    return data;
  }

export async function nextDialogue(body: { user_id: string; story_id: string; story_mode: string }) {
    const { data } = await api.post<DialogueResponse>('/api/story/next-dialogue', body);
    return data;
  }

export async function sendUserInput(body: {
    user_id: string; story_id: string; story_mode: string; input: string; retry_count?: number; sidebar_practice?: boolean;
  }) {
    const { data } = await api.post('/api/story/user-input', body);
    return data;
  }

export async function nextScene(body: { user_id: string; story_id: string; story_mode: string }) {
    const { data } = await api.post('/api/story/next-scene', body);
    return data;
  }

export async function selectDestination(body: { user_id: string; story_id: string; story_mode: string; selected_destination: string }) {
  const { data } = await api.post('/api/story/select-destination', body);
  return data;
}

export async function chooseItem(body: { user_id: string; story_id: string; story_mode: string; chosen_item: string }) {
  const { data } = await api.post('/api/story/choose-item', body);
  return data;
}

export async function exploreItem(body: { user_id: string; story_id: string; story_mode: string; item: string; available_items: string[] }) {
  const { data } = await api.post('/api/story/explore-item', body);
  return data;
}

export async function pronounceWord(body: { user_id: string; story_id: string; story_mode: string; word: string; target_sound?: string }) {
  const { data } = await api.post('/api/pronounce-word', body);
  return data;
}

export async function playSoundDescription(body: { user_id: string; story_id: string; story_mode: string; description: string }) {
  const { data } = await api.post('/api/play-sound-description', body);
  return data;
}

export async function uploadAndTranscribe(formData: FormData) {
  const { data } = await api.post('/api/story/audio/upload-and-transcribe', formData);
  return data;
}
