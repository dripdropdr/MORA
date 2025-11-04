export interface Story {
    id: string;
    title: string;
    target_words: string[];
    target_sounds: string[];
    status?: string;
  }
  // What is the status in here?
  
export interface StoryMode {
    mode: 'sentence' | 'word';
    description: string;
    title: string;
  }
  
export interface UserStoryData {
    userId: string;
    storyId: string;
    sceneId: string | null;
    dialogueId: number;
    totalDialogues: number;
    storyMode: 'sentence' | 'word';
    selectedDestination: string | null;
  }

export interface StoryInfo {
  story_mode: 'sentence' | 'word';
  current_scene?: any;
  current_dialogue: number;
  total_dialogues_in_scene: number;
  
  // Progress flags
  has_next_dialogue?: boolean;
  is_dialogue_complete?: boolean;
  has_next_scene?: boolean;
  is_scene_complete?: boolean;
  is_story_complete?: boolean;
  
  conversation_history?: any[];
  target_words?: string[];
  target_sounds?: string[];
  selected_destination?: string | null;
  current_turn?: any;
  audio_generating?: boolean;
  current_audio_task?: string | null;
}

export interface StoryStateResponse {
  success: boolean;
  user_id: string;
  story_id: string;
  story_info: StoryInfo;
  image?: string | null;
  btn_words?: string[] | null;
  btn_image?: string | null;
}

export interface DialogueResponse {
  type: 'character_dialogue' | 'user_turn' | 'scene_complete' | 'error';
  character?: string;
  text?: string;
  prompt?: string;
  image?: string | null;
  btn_image?: string | null;
  btn_words?: string[] | null;
  words_in_dialogue?: string[];
  original_dialogue_text?: string;
  audio_generating?: boolean;
  current_dialogue?: number;
  total_dialogues?: number;
  
  // Progress flags
  has_next_dialogue?: boolean;
  is_scene_complete?: boolean;
  has_next_scene?: boolean;
  is_story_complete?: boolean;
  
  message?: string;
}