"""
Firestore utility functions for story state management
"""
import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from flask import jsonify
import asyncio
import threading
import os

logger = logging.getLogger(__name__)

# Helper Functions
def error_response(message, status_code=400):
    """Return standardized error response"""
    return jsonify({'success': False, 'message': message}), status_code

def success_response(data=None, message='Success'):
    """Return standardized success response"""
    response = {'success': True, 'message': message}
    if data:
        response.update(data)
    return jsonify(response)

# Will be set from web_app.py after Flask app and Firestore initialization
db = None
app_root_path = None

def init_db_utils(firestore_client, root_path):
    """Initialize utils module with Firestore client and app root path"""
    global db, app_root_path
    db = firestore_client
    app_root_path = root_path

def get_story_file_path(story_id: str) -> str:
    """Compute story file path from story_id"""
    story_id_norm = story_id if story_id.startswith('story_') else f'story_{story_id}'
    return os.path.join(app_root_path, 'story', f'{story_id_norm}.json')

def pack_current_turn(turn: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Pack current_turn for Firestore storage (exclude binary data)"""
    if not turn:
        return None
    return {
        'type': turn.get('type'),
        'character': turn.get('character'),
        'text': turn.get('text'),
        'prompt': turn.get('prompt'),
        'words_in_dialogue': turn.get('words_in_dialogue', []),
        'interaction': turn.get('interaction'),
        'image_path': turn.get('image_path'),
        'btn_words': turn.get('btn_words', []),
        'dialogue_index': turn.get('dialogue_index'),
        'total_dialogues': turn.get('total_dialogues'),
    }

def load_story_state_from_db(user_id: str, story_id: str, story_mode: str) -> Optional[Dict[str, Any]]:
    """Load story state from Firestore"""
    try:
        story_id_norm = story_id if story_id.startswith('story_') else f'story_{story_id}'
        doc_key = f"{story_id_norm}_{story_mode}"
        
        doc_ref = db.collection('users').document(user_id).collection('stories').document(doc_key)
        doc = doc_ref.get()
        
        if doc.exists:
            state = doc.to_dict()
            # Use current_scene_id (string) instead of full scene object
            if 'current_scene_id' in state:
                state['current_scene'] = state['current_scene_id']
            logger.info(f"Loaded story state from Firestore: {user_id}/{doc_key}")
            return state
        return None
    except Exception as e:
        logger.error(f"Failed to load story state from Firestore: {e}")
        return None

def save_story_state_to_db(user_id: str, story_id: str, story_mode: str, state: Dict[str, Any]) -> bool:
    """Save story state to Firestore (excluding runtime objects)"""
    try:
        story_id_norm = story_id if story_id.startswith('story_') else f'story_{story_id}'
        doc_key = f"{story_id_norm}_{story_mode}"
        
        # Extract only serializable fields
        serializable_state = {
            'user_id': user_id,
            'story_id': story_id_norm,
            'story_mode': story_mode,
            'current_scene_id': state.get('current_scene', {}).get('id') if isinstance(state.get('current_scene'), dict) else state.get('current_scene'),
            'current_dialogue': state.get('current_dialogue', 0),
            'conversation_history': state.get('conversation_history', []),
            'target_words': state.get('target_words', []),
            'target_sounds': state.get('target_sounds', []),
            'selected_destination': state.get('selected_destination'),
            'chosen_item': state.get('chosen_item'),
            'current_turn': pack_current_turn(state.get('current_turn')),
            'audio_generating': state.get('audio_generating', False),
            'current_audio_task': state.get('current_audio_task'),
            'is_playing': state.get('is_playing', False),
            'updated_at': datetime.now().isoformat(),
        }
        
        doc_ref = db.collection('users').document(user_id).collection('stories').document(doc_key)
        doc_ref.set(serializable_state, merge=True)
        logger.info(f"Saved story state to Firestore: {user_id}/{doc_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to save story state to Firestore: {e}")
        return False

def create_initial_story_state(user_id: str, story_id: str, story_mode: str) -> Optional[Dict[str, Any]]:
    """Create initial story state from story file and save to Firestore"""
    try:
        story_file_path = get_story_file_path(story_id)
        
        if not os.path.exists(story_file_path):
            logger.error(f"Story file not found: {story_file_path}")
            return None
        
        with open(story_file_path, 'r', encoding='utf-8') as f:
            story_json = json.load(f)
        
        metadata = story_json.get('metadata', {})
        story_id_norm = story_id if story_id.startswith('story_') else f'story_{story_id}'
        
        # Clean target_words: remove curly braces for consistency
        raw_target_words = metadata.get('target_words', [])
        clean_target_words = [w.replace('{', '').replace('}', '') for w in raw_target_words]
        
        state = {
            'user_id': user_id,
            'story_id': story_id_norm,
            'story_mode': story_mode,
            'target_sounds': metadata.get('themes', []),
            'target_words': clean_target_words,
            'current_scene_id': 'scene_0',
            'current_dialogue': 0,
            'current_turn': None,
            'conversation_history': [],
            'is_playing': False,
            'audio_generating': False,
            'current_audio_task': None,
            'selected_destination': None,
            'chosen_item': None,
            # Runtime objects (not saved to DB)
            'story_manager': None,
            'learning_planner': None,
            'dialog_gen': None,
            'audio_creator': None,
            'visual_interaction_handler': None,
        }
        
        # Save to Firestore
        save_story_state_to_db(user_id, story_id, story_mode, state)
        logger.info(f"Created initial story state for {user_id}/{story_id_norm}_{story_mode}")
        
        return state
    except Exception as e:
        logger.error(f"Failed to create initial story state: {e}")
        return None

def get_user_info(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user info from Firestore"""
    try:
        doc_ref = db.collection('users').document(user_id)
        doc = doc_ref.get()
        
        if doc.exists:
            user_data = doc.to_dict()
            logger.info(f"Loaded user info from Firestore: {user_id}")
            return user_data
        return None
    except Exception as e:
        logger.error(f"Failed to get user info from Firestore: {e}")
        return None

def get_all_users() -> Dict[str, Any]:
    """Get all registered users from Firestore"""
    try:
        users_ref = db.collection('users')
        docs = users_ref.stream()
        
        users = {}
        for doc in docs:
            users[doc.id] = doc.to_dict()
        
        logger.info(f"Loaded {len(users)} users from Firestore")
        return users
    except Exception as e:
        logger.error(f"Failed to get all users from Firestore: {e}")
        return {}

def create_or_update_user(user_id: str, name: str, stories: list = None) -> bool:
    """Create or update user info in Firestore"""
    try:
        if stories is None:
            stories = []
        
        user_data = {
            'name': name,
            'stories': stories,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        doc_ref = db.collection('users').document(user_id)
        doc_ref.set(user_data, merge=True)
        logger.info(f"Created/updated user in Firestore: {user_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to create/update user in Firestore: {e}")
        return False

def get_user_stories_list(user_id: str) -> list:
    """Get list of all stories for a user from Firestore"""
    try:
        stories_ref = db.collection('users').document(user_id).collection('stories')
        docs = stories_ref.stream()
        
        stories = []
        seen_story_ids = set()
        
        for doc in docs:
            data = doc.to_dict()
            story_id = data.get('story_id')
            if story_id and story_id not in seen_story_ids:
                seen_story_ids.add(story_id)
                stories.append({
                    'story_id': story_id,
                    'modes': []
                })
        
        # Add mode information
        for story in stories:
            story_id = story['story_id']
            modes_docs = stories_ref.where('story_id', '==', story_id).stream()
            for doc in modes_docs:
                data = doc.to_dict()
                story['modes'].append(data.get('story_mode', 'sentence'))
        
        return stories
    except Exception as e:
        logger.error(f"Failed to get user stories list: {e}")
        return []

def ensure_user_story_exists(user_id: str, story_id: str, story_mode: str = 'sentence') -> bool:
    """Ensure a story state exists in Firestore for the user, create if not"""
    try:
        state = load_story_state_from_db(user_id, story_id, story_mode)
        if state:
            return True
        
        # Create new state
        new_state = create_initial_story_state(user_id, story_id, story_mode)
        return new_state is not None
    except Exception as e:
        logger.error(f"Failed to ensure user story exists: {e}")
        return False

