# 현재 Scene, Characters, target_words 제공

import json

class StoryGraphManager:
    def __init__(self, story_data):
        self.story_data = story_data
        self.current_scene_id = "scene_0"
        self.current_dialogue_id = 0

    def set_current_scene_id(self, scene_id):
        self.current_scene_id = scene_id
    
    def set_current_dialogue_id(self, dialogue_id):
        self.current_dialogue_id = dialogue_id

    def get_current_scene(self):
        return self._get_scene_by_id(self.current_scene_id)
    
    def get_current_dialogue(self):
        return self._get_dialogue_by_id(self.current_dialogue_id)

    def move_to_next_scene(self):
        """Move to next scene. Returns True if there are more scenes."""
        current_scene = self.get_current_scene()
        if current_scene.get("next_scenes"):
            self.current_scene_id = current_scene["next_scenes"][0]
            self.current_dialogue_id = 0  # Reset dialogue index when moving to new scene
            return True
        return False  # No more scenes (story complete)
    
    def move_to_next_dialogue(self):
        """Move to next dialogue. Returns True if there are more dialogues."""
        current_scene = self.get_current_scene()
        total_dialogues = len(current_scene["dialogue_templates"])
        
        self.current_dialogue_id += 1  # Always increment
        
        # Return True if there are still more dialogues
        return self.current_dialogue_id < total_dialogues
    
    def get_progress_info(self):
        """Get comprehensive progress information with all flags"""
        current_scene = self.get_current_scene()
        total_dialogues = len(current_scene['dialogue_templates'])
        total_scenes = len(self.story_data['scenes'])
        current_scene_index = self._get_scene_index(self.current_scene_id)
        
        return {
            'current_dialogue_id': self.current_dialogue_id,
            'total_dialogues': total_dialogues,
            'has_next_dialogue': self.current_dialogue_id < total_dialogues,
            'is_dialogue_complete': self.current_dialogue_id >= total_dialogues,
            
            'current_scene_index': current_scene_index,
            'total_scenes': total_scenes,
            'has_next_scene': bool(current_scene.get('next_scenes')),
            'is_scene_complete': self.current_dialogue_id >= total_dialogues,
            'is_story_complete': (current_scene_index >= total_scenes - 1 and 
                                  self.current_dialogue_id >= total_dialogues and
                                  not bool(current_scene.get('next_scenes')))
        }
    
    def _get_scene_index(self, scene_id):
        """Get the index of current scene"""
        for idx, scene in enumerate(self.story_data['scenes']):
            if scene['id'] == scene_id:
                return idx
        return -1

    def _get_scene_by_id(self, scene_id):
        for scene in self.story_data["scenes"]:
            if scene["id"] == scene_id:
                return scene
        return None
    
    def _get_dialogue_by_id(self, dialogue_id):
        current_scene = self.get_current_scene()
        for idx, dialogue in enumerate(current_scene["dialogue_templates"]):
            if idx == dialogue_id:
                return dialogue
        return None

    def get_characters_of_current_scene(self):
        scene = self.get_current_scene()
        return scene["characters"]

    def process_user_choice_for_select_destination(self, choice):
        # select all scenes that have destination in the scene id
        scenes = []
        for scene in self.story_data["scenes"]:
            if "destination" in scene["id"]:
                scenes.append(scene)

        # find the scenes that have the same destination as the choice
        destination_scenes_name = []
        for scene in scenes:
            if choice in scene["location"][0]:
                destination_scenes_name.append(scene["id"])
        destination_scenes_name.sort()

        # find the intersection scene within all scenes
        for scene in self.story_data["scenes"]:
            if len(scene['next_scenes']) > 1:
                scene['next_scenes']  = [s for s in scene['next_scenes'] if s in destination_scenes_name[0]] # list(set(scene['next_scenes']) & set(destination_scenes_name))
                break
        
    def process_user_choice_for_choose_item(self, choice):
        # select all scenes that have item in the scene id
        dialogues = []
        for scene in self.story_data["scenes"]:
            for dialogue in scene["dialogue_templates"]:
                if "chosen_item" in dialogue["prompt"] and len(dialogue["image"]) > 1:
                    dialogues.append(dialogue)
        
        # leave only the image that has the choice in the image path
        for dialogue in dialogues:
            dialogue["image"] = [img_path for img_path in dialogue["image"] if choice in img_path][0]