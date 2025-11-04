# import eventlet
# eventlet.monkey_patch()

from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from werkzeug.utils import secure_filename
# from flask_socketio import SocketIO, emit
import socketio as sio_pkg
from asgiref.wsgi import WsgiToAsgi
from flask_cors import CORS
import json
import os
import asyncio
import threading
import logging
from datetime import datetime
import re
import sys
import random
import tempfile
import os
import firebase_admin
from firebase_admin import credentials, firestore
import subprocess
import utils
from utils import error_response, success_response

try:
    from .engine.story_graph_manager import StoryGraphManager
    from .engine.word_learning_planner import WordLearningPlanner
    from .engine.dialog_generator import DialogGenerator
    from .engine.audio_creator import AudioCreator
    from .engine.visual_interaction_handler import VisualInteractionHandler
    from .engine.recording_handler import get_recordings_list_by_user_id, analysis_pronuncitaion_distance
    from .builder.config import config_story, generate_character_sheets, generate_scene, assign_image_in_story
except Exception as e:
    from engine.story_graph_manager import StoryGraphManager
    from engine.word_learning_planner import WordLearningPlanner
    from engine.dialog_generator import DialogGenerator
    from engine.audio_creator import AudioCreator
    from engine.visual_interaction_handler import VisualInteractionHandler
    from engine.recording_handler import get_recordings_list_by_user_id, analysis_pronuncitaion_distance
    from builder.config import config_story, generate_character_sheets, generate_scene, assign_image_in_story

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}) 
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'your-secret-key-here')
sio = sio_pkg.AsyncServer(async_mode="asgi", cors_allowed_origins="*", ping_timeout=20, ping_interval=25,) # SocketIO(app, cors_allowed_origins="*") # , logger=True, engineio_logger=True
# Bridge Flask (WSGI) into ASGI:
asgi_flask = WsgiToAsgi(app)
# Mount Socket.IO at /socket.io     and send everything else to Flask:
asgi_app = sio_pkg.ASGIApp(sio, other_asgi_app=asgi_flask)

# logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler('web_app.log'), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

OPENAI_API_KEY =  os.getenv('OPENAI_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
# Check if API keys are set
if not OPENAI_API_KEY or not GEMINI_API_KEY:
    logger.error("API_KEYS not set in environment variables")
    sys.exit(1)

# Initialize Firebase and Firestore and utils
try: # Check if Firebase app is already initialized (for hot reload)
    try:
        firebase_admin.get_app()
        logger.info("Firebase app already initialized, reusing existing instance")
        db = firestore.client()
    except ValueError: # Firebase not initialized, create new instance
        cred = credentials.Certificate(os.path.join(app.root_path, "static", "firebase-service-key.json"))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        logger.info("Firebase/Firestore initialized successfully")
    
    utils.init_db_utils(db, app.root_path)
except Exception as e:
    logger.error(f"Failed to initialize Firebase: {e}")
    sys.exit(1)

user_stories_cache = {} # Memory cache for active story states (runtime objects only)
users_cache = {} # Memory cache for users (to reduce Firestore queries)

def run_audio_generation_async(story_state, user_id, story_id, task_name, async_func, *args, **kwargs):
    """Run audio generation in background thread with proper status management"""
    story_state['audio_generating'] = True
    story_state['current_audio_task'] = task_name
    
    # Helper to emit from background thread
    def emit_sync(event, data):
        try:
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(sio.emit(event, data))
            loop.close()
            logger.info(f"[Socket.IO] emit_sync completed for {event}")
        except Exception as e:
            logger.error(f"Error emitting {event}: {e}", exc_info=True)
    
    emit_sync('audio_status_update', {
        'audio_generating': True,
        'current_audio_task': task_name,
        'user_id': user_id,
        'story_id': story_id
    })
    
    def audio_task():
        try:
            audio_path = asyncio.run(async_func(*args, **kwargs))
            logger.info(f"{task_name} audio generated successfully: {audio_path}")
            
            # Emit audio_url via Socket.IO
            if audio_path:
                audio_url = f"/generated_audio/{os.path.basename(audio_path)}"
                
                # Map task names to appropriate Socket.IO events
                event_map = {
                    'word_pronunciation': 'word_audio_ready',
                    'sound_description': 'audio_ready',
                    'dialogue': 'audio_ready',
                    'exploration': 'exploration_audio_ready',
                    'user_voice': 'user_voice_ready'
                }
                
                event_name = event_map.get(task_name, 'audio_ready')
                payload = {
                    'audio_url': audio_url,
                    'user_id': user_id,
                    'story_id': story_id
                }
                logger.info(f"[Socket.IO] Emitting {event_name} with payload: {payload}")
                emit_sync(event_name, payload)
                logger.info(f"[Socket.IO] Successfully emitted {event_name}")
                
        except Exception as e:
            logger.error(f"{task_name} audio generation error: {e}")
        finally:
            story_state['audio_generating'] = False
            story_state['current_audio_task'] = None
            emit_sync('audio_status_update', {
                'audio_generating': False,
                'current_audio_task': None,
                'user_id': user_id,
                'story_id': story_id
            })
    
    thread = threading.Thread(target=audio_task)
    thread.daemon = True
    thread.start()

def get_user_story_state(user_id, story_id, story_mode='sentence'):
    """Get or create user story state (Firestore-based with memory cache)"""
    story_id_norm = story_id if story_id.startswith('story_') else f'story_{story_id}'
    cache_key = f"{user_id}_{story_id_norm}_{story_mode}"
    
    # Check memory cache first
    if cache_key in user_stories_cache:
        return user_stories_cache[cache_key]
    
    # Load from Firestore
    story_state = utils.load_story_state_from_db(user_id, story_id_norm, story_mode)
    
    # If not exists, create initial state
    if not story_state:
        # Check if user has access to this story
        user_info = utils.get_user_info(user_id)
        if not user_info:
            logger.error(f"User not found: {user_id}")
            return None
        
        # Check if story file exists
        story_file_path = utils.get_story_file_path(story_id_norm)
        if not os.path.exists(story_file_path):
            logger.error(f"Story file not found: {story_file_path}")
            return None
        
        # Create initial state
        story_state = utils.create_initial_story_state(user_id, story_id_norm, story_mode)
        if not story_state:
            logger.error(f"Failed to create initial story state")
            return None
    
    # Add runtime fields
    story_state['story_path'] = utils.get_story_file_path(story_id_norm)
    story_state['user_id'] = user_id
    story_state['start_time'] = datetime.now() if not story_state.get('start_time') else story_state.get('start_time')
    
    # Cache in memory
    user_stories_cache[cache_key] = story_state
    
    return story_state

def get_current_story_state(user_id, story_id, story_mode='sentence'):
    """Get current user's story state"""
    if user_id:
        return get_user_story_state(user_id, story_id, story_mode)
    return None

def save_story_state(user_id, story_id, story_mode, story_state):
    """Save story state to Firestore"""
    try:
        story_id_norm = story_id if story_id.startswith('story_') else f'story_{story_id}'
        success = utils.save_story_state_to_db(user_id, story_id_norm, story_mode, story_state)
        if success:
            logger.info(f"Story state saved: {user_id}/{story_id_norm}_{story_mode}")
        return success
    except Exception as e:
        logger.error(f"Failed to save story state: {e}")
        return False

def log_story_event(event_type, user_id=None, story_id=None, story_mode='sentence', details=None):
    """Log Story Event"""
    if user_id and story_id:
        story_state = get_current_story_state(user_id, story_id, story_mode)
    else:
        story_state = None
    
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'user_id': user_id,
        'story_id': story_id,
        'event_type': event_type,
        'current_scene': story_state.get('current_scene') if story_state else None,
        'current_dialogue': story_state.get('current_dialogue') if story_state else None,
        'details': details
    }
    logger.info(f"Story Event: {json.dumps(log_data, ensure_ascii=False)}")

def initialize_story(user_id, story_id, story_mode, reset=False):
    """Initialize Story"""
    try:
        logger.info(f"Initialize story: {story_id} (mode: {story_mode}) for user: {user_id}")
        
        story_state = get_user_story_state(user_id, story_id, story_mode)
        if not story_state:
            logger.error(f"Story state not found for user {user_id}, story {story_id}, mode {story_mode}")
            return False
        
        # Set user and story info
        story_state['start_time'] = datetime.now()
        story_path = story_state.get('story_path')
        if not story_path:
            logger.error(f"Story path not found in story state")
            return False
        if not os.path.exists(story_path): # Check if story file exists
            logger.error(f"Story file not found: {story_path}")
            return False
        
        story_data_init = json.load(open(story_path))
        story_state['story_manager'] = StoryGraphManager(
            story_data_init
        )
        story_state['learning_planner'] = WordLearningPlanner(
            story_target_words=story_state['target_words']
        )
        story_state['dialog_gen'] = DialogGenerator(
            api_key=OPENAI_API_KEY,
            character_profiles=story_data_init["characters"]
        )
        story_state['audio_creator'] = AudioCreator(
            api_key=OPENAI_API_KEY,
            character_profiles=story_data_init["characters"],
            gemini_api_key=GEMINI_API_KEY
        )
        story_state['visual_interaction_handler'] = VisualInteractionHandler(
            api_key=OPENAI_API_KEY,
            story_data=story_data_init
        )
        del story_data_init
        
        if reset: # Reset story state
            story_state['current_scene'] = story_state['story_manager'].current_scene_id
            story_state['current_dialogue'] = 0
            story_state['current_turn'] = None  # 스토리 초기화 시 턴 상태 초기화
            story_state['conversation_history'] = []
            story_state['audio_generating'] = False
            story_state['current_audio_task'] = None
            story_state['story_mode'] = story_mode
            story_state['selected_destination'] = None
            # Save reset state to DB
            save_story_state(user_id, story_id, story_mode, story_state)
        else:
            # Set current scene and dialogue from stored state
            story_state['story_manager'].set_current_scene_id(story_state['current_scene'])
            story_state['story_manager'].set_current_dialogue_id(story_state['current_dialogue'])
            # 중간 지점 복구: 사용자의 이전 선택사항 재적용
            if story_state.get('selected_destination'):
                story_state['story_manager'].process_user_choice_for_select_destination(story_state['selected_destination'])
        
            if story_state.get('chosen_item'):
                story_state['story_manager'].process_user_choice_for_choose_item(story_state['chosen_item'])
        return True
    except Exception as e:
        logger.error(f"Story initialization error: {e}")
        return False

def _update_story_progress_flags(story_state):
    """Update story progress flags from story_manager to story_state"""
    progress_info = story_state['story_manager'].get_progress_info()
    
    # Sync flags to story_state for persistence
    story_state['current_dialogue'] = progress_info['current_dialogue_id']
    story_state['total_dialogues'] = progress_info['total_dialogues']
    story_state['has_next_dialogue'] = progress_info['has_next_dialogue']
    story_state['is_dialogue_complete'] = progress_info['is_dialogue_complete']
    story_state['has_next_scene'] = progress_info['has_next_scene']
    story_state['is_scene_complete'] = progress_info['is_scene_complete']
    story_state['is_story_complete'] = progress_info['is_story_complete']
    
    return progress_info

def _madlib_for_word_mode(user_id, story_id, dialogue, story_mode='word', destination=None, chosen_item=None):
    """Madlib for word mode"""
    story_state = get_current_story_state(user_id, story_id, story_mode)
    if not story_state:
        return "", []
        
    scene = story_state['story_manager'].get_current_scene()
    # Pass both destination and chosen_item to dialogue generator
    original_dialogue_text = story_state['dialog_gen'].generate_madlib_for_word_mode(scene, dialogue, story_state['target_sounds'], destination, chosen_item)
    words_in_dialogue = re.findall(r'\{[^}]+\}', original_dialogue_text)
    tmp_dialogue_text = original_dialogue_text
    for word in words_in_dialogue:
        tmp_dialogue_text = tmp_dialogue_text.replace(word, '_____')
    dialogue_text = tmp_dialogue_text
    return dialogue_text, words_in_dialogue, original_dialogue_text

def generate_audio_for_dialogue(user_id, story_id, character, dialogue_text, story_mode='sentence'):
    """Generate audio for dialogue (background)"""
    try:
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state: return False
            
        logger.info(f"Audio generation started notification sent: {character}")
        # Use helper function for audio generation
        run_audio_generation_async(
            story_state, user_id, story_id, character,
            story_state['audio_creator'].generate_speech_with_dialogue,
            character, dialogue_text)
        
        return True
    except Exception as e:
        logger.error(f"Audio generation start error: {e}")
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if story_state:
            story_state['audio_generating'] = False
            story_state['current_audio_task'] = None
        return False

def _advance_dialogue_common(user_id, story_id, story_mode='sentence'):
    
    """Common: process the current dialogue and generate the response data and side effects.
    반환: (response_dict, finished: bool)
    """
    story_state = get_current_story_state(user_id, story_id, story_mode)
    if not story_state or not story_state['current_scene']:
        return ({'error': 'Story not initialized'}, True)

    scene = story_state['story_manager'].get_current_scene()
    dialogue_idx = story_state['story_manager'].current_dialogue_id
    if dialogue_idx >= len(scene['dialogue_templates']):
        return ({'error': 'All dialogues are completed'}, True)

    dialogue = scene['dialogue_templates'][dialogue_idx]
    logger.info(f"Proceed to next dialogue: scene {scene['id']}, dialogue {dialogue_idx}, character {dialogue['character']}")

    # get destination and chosen_item from story_state if they exist
    destination = story_state.get('selected_destination', None)
    chosen_item = story_state.get('chosen_item', None)

    if dialogue['character'] != "{user}":
        # 캐릭터 차례: 대사 생성 + 오디오
        current_image_data = None
        try:
            dialogue_text = story_state['dialog_gen'].generate_dialogue(
                scene, dialogue, story_state['conversation_history'], story_state['target_sounds'], destination
            )

            base_dir = os.path.dirname(os.path.abspath(__file__))
            current_image_data = story_state['visual_interaction_handler'].route_dialogue_image('character_dialogue', dialogue, base_dir)

            generate_audio_for_dialogue(user_id, story_id, dialogue['character'], dialogue_text, story_mode)
            story_state['conversation_history'].append(dialogue_text)

            response_data = {
                'type': 'character_dialogue',
                'character': dialogue['character'],
                'text': dialogue_text,
                'image': current_image_data,  # Base64 encoded image
                'image_path': dialogue.get('image_path', ''),  # 경로만 저장 (current turn in get_story_state용)
                'prompt': dialogue.get('prompt', ''),
                'audio_generating': story_state['audio_generating'],
                'dialogue_index': story_state['story_manager'].current_dialogue_id,  # 증가되기 전 인덱스
                'total_dialogues': len(scene['dialogue_templates'])
            }
            log_story_event('character_dialogue', user_id, story_id, story_mode, {
                'character': dialogue['character'],
                'dialogue': dialogue_text
            })
        
        except Exception as e:
            logger.error(f"Dialogue generation error: {e}")
            response_data = {
                'type': 'error',
                'message': f'Dialogue generation error: {str(e)}',
                'image': current_image_data  # May be None if image loading failed
            }
            return (response_data, False)
    else: # user turn
        response_data = {
            'type': 'user_turn',
            'interaction': dialogue.get('interaction', None),  # interaction type 정보 저장
            'image_path': dialogue.get('image_path', ''),  # 경로 저장 (get_story_state용)
        }

        if story_state['story_mode'] == 'word' and not dialogue.get('interaction'):
            text, words_in_dialogue, original_dialogue_text = _madlib_for_word_mode(user_id, story_id, dialogue, story_mode, destination, chosen_item)
            response_data['text'] = text
            response_data['words_in_dialogue'] = words_in_dialogue
            response_data['original_dialogue_text'] = original_dialogue_text

        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if dialogue.get('interaction'):
            background_image_data, interact_image_data, interact_words = story_state['visual_interaction_handler'].route_interaction(dialogue['interaction'], dialogue, base_dir)
            response_data['image'] = background_image_data  # Background image (base64 string)
            response_data['btn_words'] = interact_words  # List of words
            response_data['btn_image'] = json.dumps(interact_image_data)  # JSON string of base64 image array
        else:
            background_image_data = story_state['visual_interaction_handler'].route_dialogue_image('user_turn', dialogue, base_dir)
            response_data['image'] = background_image_data  # Base64 encoded image

        # Replace placeholders in prompt
        prompt_text = dialogue.get('prompt', '')
        if destination:
            prompt_text = prompt_text.replace("{destination}", '{' + destination + '}')
        if chosen_item:
            prompt_text = prompt_text.replace("{chosen_item}", '{' + chosen_item + '}')
        response_data['prompt'] = prompt_text
        
        log_story_event('user_turn', user_id, story_id, story_mode, {'prompt': response_data.get('prompt', ''), 'text': response_data.get('text', ''), 'words_in_dialogue': response_data.get('words_in_dialogue', [])})

    # Increment dialogue index and update progress flags
    has_more_dialogues = story_state['story_manager'].move_to_next_dialogue()
    progress_info = _update_story_progress_flags(story_state)
    
    # Add progress info to response
    response_data['current_dialogue'] = progress_info['current_dialogue_id']
    response_data['total_dialogues'] = progress_info['total_dialogues']
    response_data['has_next_dialogue'] = progress_info['has_next_dialogue']
    response_data['is_scene_complete'] = progress_info['is_scene_complete']
    response_data['has_next_scene'] = progress_info['has_next_scene']
    response_data['is_story_complete'] = progress_info['is_story_complete']
    
    # Manage current turn state on the server (이미지 데이터 제외하고 저장)
    turn_data_to_save = response_data.copy()
    # 큰 이미지 데이터는 제거 (경로만 유지)
    turn_data_to_save.pop('image', None)
    turn_data_to_save.pop('btn_image', None)
    story_state['current_turn'] = turn_data_to_save
    
    # Save state after dialogue advance
    save_story_state(user_id, story_id, story_mode, story_state)
    
    # Return finished=True if no more dialogues
    return (response_data, not has_more_dialogues)

@app.route('/')
def index():
    """Main page, redirect to login if no user, or to start page if no story"""
    logger.info("Main page accessed")
    # Client-side will handle user authentication check
    return render_template('index.html')

@app.route('/login')
def login_page():
    """Login page"""
    logger.info("Login page accessed")
    return render_template('login.html')

@app.route('/story_creating/')
def story_creating():
    """Story creating page"""
    logger.info("Story creating page accessed")
    return render_template('story_creating.html')

@app.route('/start')
def start_page():
    """Start page"""
    logger.info("Start page accessed")
    # Client-side will handle user authentication check
    return render_template('start.html')

# Authentication API endpoints
@app.route('/api/auth/login', methods=['POST'])
def login():
    """Simple ID-based login (Firestore-based)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User ID is required'
            }), 400
        
        # Check cache first
        if user_id in users_cache:
            user_info = users_cache[user_id]
        else:
            # Get user info from Firestore
            user_info = utils.get_user_info(user_id)
            if not user_info:
                return jsonify({
                    'success': False,
                    'message': 'User ID not found. Please contact administrator.'
                }), 404
            # Cache user info
            users_cache[user_id] = user_info
        
        # Get user's stories
        user_stories_data = user_info.get('stories', [])
        
        logger.info(f"User logged in: {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user_id': user_id,
            'user_name': user_info.get('name', user_id),
            'stories': user_stories_data
        })
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logout current user"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        
        if user_id:
            logger.info(f"User logged out: {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Logout successful'
        })
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

# Story API endpoints
@app.route('/api/story/init', methods=['POST'])
def init_story():
    """Story initialization API"""
    try:        
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        if not user_id:
            return jsonify({
                'success': False,
                'message': 'User not logged in'
            }), 401
        
        story_id = data.get('story_id', 'story_967781')
        story_mode = data.get('story_mode', 'sentence')
        logger.info(f"Story initialization request: {story_id} for user: {user_id}")
        
        if initialize_story(user_id, story_id, story_mode, reset=False):
            story_state = get_current_story_state(user_id, story_id, story_mode)
            if not story_state:
                return jsonify({
                    'success': False,
                    'message': 'Failed to get story state after initialization'
                }), 500
                
            return jsonify({
                'success': True,
                'message': 'Story initialized',
                'user_id': story_state.get('user_id', user_id),
                'story_id': story_id,
                'story_info': {
                    'story_mode': story_state.get('story_mode'),
                    'current_scene_id': story_state.get('current_scene'),
                    'current_dialogue': story_state.get('current_dialogue'),
                    'total_dialogues_in_scene': len(story_state['story_manager'].get_current_scene().get('dialogue_templates', [])),
                    'selected_destination': story_state.get('selected_destination'),   
                    'audio_generating': story_state.get('audio_generating', False),
                    'current_audio_task': story_state.get('current_audio_task'),
                    # Note: Removed large data like current_scene, target_words, target_sounds, conversation_history, current_turn
                    # Client will load these from /api/story/state when needed
                }
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Story initialization failed'
            }), 500
    except Exception as e:
        logger.error(f"Story initialization API error: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/api/story/next-dialogue', methods=['POST'])
def next_dialogue():
    """Proceed to next dialogue"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence').strip()
        
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
            
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state or not story_state['current_scene']:
            return error_response('Story not initialized')

        scene = story_state['story_manager'].get_current_scene()

        if story_state['current_dialogue'] >= len(scene['dialogue_templates']):
            return error_response('All dialogues are completed')
        
        logger.info(scene)
        response_data, finished = _advance_dialogue_common(user_id, story_id, story_mode)
        
        if 'error' in response_data:
            logger.error(f"Next dialogue proceed error: {response_data.get('error', 'unknown')}")
            return error_response(response_data.get('error', 'Unknown error'))
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Next dialogue proceed error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.route('/api/story/user-input', methods=['POST'])
def process_user_input():
    """Process user input"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence')
        user_input = data.get('input', '')
        retry_count = data.get('retry_count', 0)
        sidebar_practice = data.get('sidebar_practice', False)
        
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
            
        if not user_input:
            return error_response('User input is empty')
        
        logger.info(f"Process user input: {user_input}, retry_count: {retry_count}, sidebar_practice: {sidebar_practice}")
        
        # For sidebar practice, just return success without story progression
        if sidebar_practice:
            logger.info(f"Sidebar practice completed for user {user_id}: {user_input}")
            return success_response({'sidebar_practice': True}, 'Sidebar practice completed')
        
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state:
            return error_response('Story not initialized')
        
        # sentence mode validation for target words
        max_retry_attempts = 3  # Allow up to 3 retry attempts
        if story_mode == 'sentence' and retry_count < max_retry_attempts:  # Check validation within retry limit
            current_turn = story_state.get('current_turn')
            if current_turn and current_turn.get('type') == 'user_turn' and current_turn.get('interaction', None) is None:
                # Get target words from the current turn
                scene = story_state['story_manager'].get_current_scene()
                prompt_text = current_turn.get('prompt', '')
                # Extract target words from the prompt (words surrounded by curly braces)
                target_words_in_prompt = re.findall(r'\{([^}]+)\}', prompt_text)
                
                if target_words_in_prompt:
                    # Check if all target words are included in the user input
                    user_input_lower = user_input.lower()
                    missing_words = []
                    
                    for target_word in target_words_in_prompt:
                        if target_word.lower() not in user_input_lower:
                            missing_words.append(target_word)
                    
                    # If target words are missing, request retry with audio feedback
                    if missing_words:
                        logger.info(f"Missing target words: {missing_words}")
                        
                        # Generate audio instruction for retry
                        character_name = None
                        scene = story_state['story_manager'].get_current_scene()
                        if scene and scene.get('characters'):
                            character_name = scene['characters'][0]  # Use first character
                        
                        # Get user's last recording path to concatenate with instruction
                        user_recording_path = story_state['audio_creator'].last_saved_recording_path
                        if user_recording_path:
                            logger.info(f"User recording will be concatenated: {user_recording_path}")
                        
                        run_audio_generation_async(
                            story_state,
                            user_id,
                            story_id,
                            'retry_instruction',
                            story_state['audio_creator'].generate_retry_instruction_audio,
                            missing_words,
                            character_name,
                            retry_count + 1,
                            user_recording_path  # Pass user recording path to concatenate
                        )
                        
                        return jsonify({
                            'success': False,
                            'message': 'Please try again and include the target words in your response.',
                            'missing_words': missing_words,
                            'target_words': target_words_in_prompt,
                            'retry_required': True,
                            'audio_feedback_started': True,
                            'retry_count': retry_count + 1,
                            'max_retries': max_retry_attempts
                        }), 400
            
        # If max retries reached but still missing words, allow progression with warning
        elif story_mode == 'sentence' and retry_count >= max_retry_attempts:
            current_turn = story_state.get('current_turn')
            if current_turn and current_turn.get('type') == 'user_turn':
                scene = story_state['story_manager'].get_current_scene()
                prompt_text = current_turn.get('prompt', '')
                target_words_in_prompt = re.findall(r'\{([^}]+)\}', prompt_text)
                
                if target_words_in_prompt:
                    user_input_lower = user_input.lower()
                    missing_words = []
                    
                    for target_word in target_words_in_prompt:
                        if target_word.lower() not in user_input_lower:
                            missing_words.append(target_word)
                    
                    if missing_words:
                        logger.info(f"Max retries reached, proceeding with missing words: {missing_words}")
                        # Log this as a learning opportunity
                        log_story_event('max_retries_reached', user_id, story_id, story_mode, {
                            'missing_words': missing_words,
                            'retry_count': retry_count,
                            'user_input': user_input
                        })
            
        # Add user input to conversation history
        story_state['conversation_history'].append({"speaker": "{user}", "line": user_input})
        # Count learning words
        child_input_words = [re.sub(r'[^\w\s]', '', word).lower() for word in user_input.split() if re.sub(r'[^\w\s]', '', word).lower() in story_state['target_words']]
        
        log_story_event('user_input_processed', user_id, story_id, story_mode, {
            'input_length': len(user_input),
            'words_counted': len(child_input_words),
            'retry_count': retry_count
        })
        
        # Save state after user input
        save_story_state(user_id, story_id, story_mode, story_state)
        
        # 공통 진행 로직 사용
        if not story_state['current_scene']:
            return error_response('Story not initialized')

        scene = story_state['story_manager'].get_current_scene()
        if story_state['current_dialogue'] >= len(scene['dialogue_templates']):
            next_dialogue_response = {
                'type': 'scene_complete',
                'message': 'All dialogues in the current scene are completed.'
            }
        else:
            next_dialogue_response, finished = _advance_dialogue_common(user_id, story_id, story_mode)
            if 'error' in next_dialogue_response:
                return error_response(next_dialogue_response.get('error', 'Unknown error'))
        
        return success_response({
            'learned_words': story_state['learning_planner'].learned_words,
            'next_dialogue': next_dialogue_response
        }, 'User input processed')
        
    except Exception as e:
        logger.error(f"User input process error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.route('/api/story/next-scene', methods=['POST'])
def next_scene():
    """Proceed to next scene"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence').strip()
        
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
            
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state or not story_state['story_manager']:
            return error_response('Story not initialized')
        
        logger.info(f"Proceed to next scene: current scene {story_state['story_manager'].current_scene_id}")
        
        has_more_scenes = story_state['story_manager'].move_to_next_scene()
        
        if has_more_scenes:
            # Scene changed successfully
            story_state['current_scene'] = story_state['story_manager'].current_scene_id
            story_state['conversation_history'] = []
            story_state['current_turn'] = None  # 새 씬에서는 턴 상태 초기화
            
            # Update progress flags
            progress_info = _update_story_progress_flags(story_state)
            
            log_story_event('scene_changed', user_id, story_id, story_mode, {
                'new_scene': story_state['story_manager'].current_scene_id
            })
            
            # Save state after scene change
            save_story_state(user_id, story_id, story_mode, story_state)
            
            return jsonify({
                'success': True,
                'message': 'Next scene moved',
                'current_scene': story_state['story_manager'].current_scene_id,
                **progress_info  # Include all progress flags
            })
        else:
            # Story completed
            progress_info = _update_story_progress_flags(story_state)
            
            log_story_event('story_completed', user_id, story_id, story_mode, {
                'total_dialogues': len(story_state['conversation_history']),
                'learned_words': story_state['learning_planner'].learned_words
            })
            
            # Save final state
            save_story_state(user_id, story_id, story_mode, story_state)
            
            return jsonify({
                'success': True,
                'message': 'Story completed!',
                'learned_words': story_state['learning_planner'].learned_words,
                **progress_info  # Include all progress flags
            })
            
    except Exception as e:
        logger.error(f"Next scene move error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.route('/generated_audio/<path:filename>')
def serve_generated_audio(filename):
    try:
        filepath = os.path.join(os.path.abspath('generated_audio'), filename)
        
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'message': 'File not found'}), 404
        return send_file(filepath, mimetype='audio/wav')
        
    except Exception as e:
        logger.error(f"Generated audio serve error: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error serving audio'}), 500

@app.route('/story_recordings/<path:filepath>')
def serve_story_recording(filepath):
    """Serve user recordings from story_recordings directory"""
    try:
        full_path = os.path.join(os.path.abspath('story_recordings'), filepath)
        
        if not os.path.exists(full_path):
            return jsonify({'success': False, 'message': 'Recording not found'}), 404
        return send_file(full_path, mimetype='audio/wav')
        
    except Exception as e:
        logger.error(f"Story recording serve error: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error serving recording'}), 500

@app.route('/api/story/audio/upload-and-transcribe', methods=['POST'])
def upload_and_transcribe_audio():
    """Accept browser-recorded audio, convert to WAV, transcribe, and optionally save."""
    try:
        if 'audio' not in request.files:
            return jsonify({'success': False, 'error': 'Audio file is required'}), 400
        audio_file = request.files['audio']
        user_id = request.form.get('user_id', '').strip()
        story_id = request.form.get('story_id', '').strip()
        story_mode = request.form.get('story_mode', 'sentence').strip()

        if not user_id or not story_id:
            return jsonify({'success': False, 'error': 'User ID and Story ID are required'}), 400

        # Determine prompt for sentence mode from current turn
        prompt = None
        story_state = get_current_story_state(user_id, story_id, story_mode) # TODO: where it changes to None
        if story_state and story_mode == 'sentence' and story_state.get('current_turn') and 'prompt' in story_state['current_turn']:
            prompt = story_state['current_turn']['prompt']

        # Save uploaded file to temp
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(secure_filename(audio_file.filename or 'audio'))[1] or '.webm') as tmp_in:
            audio_file.save(tmp_in.name)
            tmp_input_path = tmp_in.name

        # Convert to WAV mono 44.1kHz using ffmpeg; fallback to direct if ffmpeg unavailable
        tmp_wav_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_out:
                tmp_wav_path = tmp_out.name
            cmd = [
                'ffmpeg', '-y', '-i', tmp_input_path,
                '-ac', '1', '-ar', '44100', '-vn', tmp_wav_path
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            source_for_transcription = tmp_wav_path
        except Exception as conv_err:
            logger.warning(f"ffmpeg conversion failed, trying direct transcription: {conv_err}")
            source_for_transcription = tmp_input_path

        try:
            # Use audio_creator to transcribe and optionally persist into story_recordings
            if not story_state or not story_state.get('audio_creator'):
                # Initialize a minimal AudioCreator if needed
                story_data_init = None
                if story_state and story_state.get('story_path'):
                    story_data_init = json.load(open(story_state['story_path']))
                else:
                    # Fallback: load any story file to get characters list
                    story_dir = os.path.join(app.root_path, 'story')
                    story_files = [f for f in os.listdir(story_dir) if f.endswith('.json')]
                    story_data_init = json.load(open(os.path.join(story_dir, story_files[0]))) if story_files else {'characters': []}
                story_state = story_state or {}
                story_state['audio_creator'] = AudioCreator(
                    api_key=OPENAI_API_KEY,
                    character_profiles=story_data_init.get('characters', []),
                    gemini_api_key=GEMINI_API_KEY
                )

            transcribed_text = story_state['audio_creator'].transcribe_audio_file(
                audio_filepath=source_for_transcription,
                story_id=story_id,
                user_id=user_id,
                story_mode=story_mode,
                prompt=prompt,
                save_recording=True
            )
        finally:
            # Cleanup temp files
            try:
                if tmp_input_path and os.path.exists(tmp_input_path):
                    os.unlink(tmp_input_path)
            except Exception:
                pass
            try:
                if tmp_wav_path and os.path.exists(tmp_wav_path):
                    os.unlink(tmp_wav_path)
            except Exception:
                pass

        if not transcribed_text:
            return jsonify({'success': False, 'error': 'Transcription failed'}), 500

        return jsonify({'success': True, 'transcribed_text': transcribed_text})
    except Exception as e:
        logger.error(f"Upload and transcribe error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/story/state')
def get_story_state():
    """Current story state synchronization endpoint
    - Used to synchronize the server state with the client after restoration
    - Required information: user_id, current scene, current dialogue index, total dialogue count, metadata, audio status
    - If the next turn is the user's turn, provide the corresponding prompt and next dialogue image (if any)
    """
    try:
        requested_user_id = request.args.get('user_id', type=str)
        requested_story_id = request.args.get('story_id', type=str)
        requested_story_mode = request.args.get('story_mode', 'sentence')
        
        if not requested_user_id or not requested_story_id:
            return error_response('User ID and Story ID are required')

        story_state = get_current_story_state(requested_user_id, requested_story_id, requested_story_mode)
        if not story_state:
            return error_response('Story not initialized')
        # If the engine objects are not initialized, auto-initialize them
        if not story_state.get('story_manager'):
            logger.info(f"Objects not initialized, auto-initializing for {requested_user_id}/{requested_story_id}")
            if not initialize_story(requested_user_id, requested_story_id, requested_story_mode, reset=False):
                return error_response('Story engine objects initialization failed')
            story_state = get_current_story_state(requested_user_id, requested_story_id, requested_story_mode)

        scene = story_state['story_manager'].get_current_scene()
        # Resolve scene object if it's an ID string (before full initialization)
        if isinstance(scene, str):
            try:
                if story_state.get('story_manager'):
                    resolved_scene = story_state.get('story_manager').current_scene_id
                    if resolved_scene:
                        scene = resolved_scene
                        story_state['current_scene'] = resolved_scene
            except Exception as e:
                logger.warning(f"Scene resolution warning: {e}")

        total_dialogues = 0
        try:
            if isinstance(scene, dict) and scene and scene.get('dialogue_templates'):
                total_dialogues = len(scene['dialogue_templates'])
        except Exception as e:
            logger.warning(f"Total dialogues computation warning: {e}")

        # Load metadata (read from file if story_path exists)
        metadata = {}
        try:
            if story_state.get('story_path') and os.path.exists(story_state['story_path']):
                with open(story_state['story_path'], 'r', encoding='utf-8') as f:
                    metadata = json.load(f).get('metadata', {})
        except Exception as e:
            logger.error(f"Metadata load error: {e}")
            metadata = {}

        # Get progress info from story_manager
        progress_info = {}
        try:
            if story_state.get('story_manager'):
                progress_info = story_state['story_manager'].get_progress_info()
        except Exception as e:
            logger.warning(f"Progress info computation warning: {e}")
            progress_info = {
                'current_dialogue_id': story_state.get('current_dialogue', 0),
                'total_dialogues': total_dialogues,
                'has_next_dialogue': False,
                'is_dialogue_complete': False,
                'has_next_scene': False,
                'is_scene_complete': False,
                'is_story_complete': False
            }

        response = {
            'success': True,
            'user_id': requested_user_id,
            'story_id': requested_story_id,
            'story_info': {
                'story_mode': story_state.get('story_mode'),
                'current_scene': story_state.get('current_scene'),
                'current_dialogue': progress_info.get('current_dialogue_id', story_state.get('current_dialogue', 0)),
                'total_dialogues_in_scene': progress_info.get('total_dialogues', total_dialogues),
                
                # Progress flags
                'has_next_dialogue': progress_info.get('has_next_dialogue', False),
                'is_dialogue_complete': progress_info.get('is_dialogue_complete', False),
                'has_next_scene': progress_info.get('has_next_scene', False),
                'is_scene_complete': progress_info.get('is_scene_complete', False),
                'is_story_complete': progress_info.get('is_story_complete', False),
                
                'conversation_history': story_state.get('conversation_history', []),
                'target_words': story_state.get('target_words', []),
                'target_sounds': story_state.get('target_sounds', []),
                'selected_destination': story_state.get('selected_destination', None),
                'current_turn': story_state.get('current_turn', None),
                'audio_generating': story_state.get('audio_generating', False),
                'current_audio_task': story_state.get('current_audio_task')
            }
        }
        # current turn - if it is loaded in the middle of story processing
        turn = story_state.get('current_turn', None)
        if turn and turn.get('image_path'):
            try:
                vih = story_state.get('visual_interaction_handler')
                base_dir = os.path.dirname(os.path.abspath(__file__))
                if turn.get('interaction'):
                    image_data, btn_image_data, btn_words = vih.route_interaction(turn['interaction'], turn, base_dir)
                    response['image'] = image_data  # Background image (base64 string)
                    if btn_image_data: 
                        response['btn_image'] = json.dumps(btn_image_data)  # JSON string of base64 image array
                    if btn_words: 
                        response['btn_words'] = btn_words  # List of words
                else:
                    image_data = vih.route_dialogue_image(turn['type'], turn, base_dir)
                    response['image'] = image_data  # Base64 encoded image
            except Exception as e:
                logger.error(f"Failed to load image from path: {e}")

        return jsonify(response)

    except Exception as e:
        logger.error(f"Story state synchronization error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.route('/api/stories')
def get_stories():
    """Return user's assigned stories list from Firestore"""
    try:
        user_id = request.args.get('user_id', type=str)
        
        if not user_id:
            return error_response('User ID is required')
        
        # Get user info from Firestore (with cache)
        if user_id in users_cache:
            user_info = users_cache[user_id]
        else:
            user_info = utils.get_user_info(user_id)
            if not user_info:
                return error_response('User not found', 404)
            users_cache[user_id] = user_info
        
        # Get user's assigned story IDs
        assigned_story_ids = user_info.get('stories', [])
        
        if not assigned_story_ids:
            return jsonify({
                'success': True,
                'stories': []
            })
        
        # Load story information for assigned stories only
        stories = []
        story_dir = os.path.join(app.root_path, 'story')
        
        for story_id in assigned_story_ids:
            # Normalize story_id
            story_id_norm = story_id if story_id.startswith('story_') else f'story_{story_id}'
            story_filename = f'{story_id_norm}.json'
            story_path = os.path.join(story_dir, story_filename)
            
            if os.path.exists(story_path):
                try:
                    with open(story_path, 'r', encoding='utf-8') as f:
                        story_data = json.load(f)
                    
                    # Extract story information
                    story_info = {
                        'id': story_id_norm,
                        'title': story_data.get('metadata', {}).get('title', story_id_norm),
                        'target_words': story_data.get('metadata', {}).get('target_words', []),
                        'target_sounds': story_data.get('metadata', {}).get('themes', []),
                        'status': 'completed'
                    }
                    
                    stories.append(story_info)
                    
                except Exception as e:
                    logger.error(f"Story file read error {story_filename}: {e}")
                    continue
            else:
                logger.warning(f"Story file not found for user {user_id}: {story_path}")
        
        return jsonify({
            'success': True,
            'stories': stories,
            'user_id': user_id
        })
        
    except Exception as e:
        logger.error(f"Story list check error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.errorhandler(404)
def not_found(error):
    """404 error handler"""
    logger.warning(f"404 error: {request.url}")
    return jsonify({'error': 'Page not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """500 error handler"""
    logger.error(f"500 error: {error}")
    return jsonify({'error': 'Server internal error'}), 500

# WebSocket 이벤트 핸들러
@sio.on('connect')
async def handle_connect(sid, environ):
    """Handle client connection"""
    logger.info(f"Client connection: {sid}")
    
    # Client will send story state update request after connection

@sio.on('disconnect')
async def handle_disconnect(sid):
    """Handle client disconnection"""
    logger.info(f"Client disconnection: {sid}")

@sio.on('request_story_update')
async def handle_story_update_request(sid, data):
    """Handle story state update request"""
    try:
        user_id = data.get('user_id')
        story_id = data.get('story_id')
        story_mode = data.get('story_mode', 'sentence')
        
        if not user_id or not story_id:
            await sio.emit('error', {'message': 'User ID and Story ID are required'}, room=sid)
            return
            
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if story_state and story_state['current_scene']:
            # Safely compute current_scene identifier even if stored as string
            current_scene = story_state['current_scene']
            if isinstance(current_scene, dict):
                current_scene_value = current_scene.get('id')
            else:
                current_scene_value = current_scene

            await sio.emit('story_state_update', {
                'current_scene': current_scene_value,
                'current_dialogue': story_state.get('current_dialogue', 0),
                'current_turn': story_state.get('current_turn'),
                'audio_generating': story_state.get('audio_generating', False),
                'current_audio_task': story_state.get('current_audio_task'),
                # Progress flags
                'has_next_dialogue': story_state.get('has_next_dialogue', False),
                'is_scene_complete': story_state.get('is_scene_complete', False),
                'has_next_scene': story_state.get('has_next_scene', False),
                'is_story_complete': story_state.get('is_story_complete', False),
                'user_id': user_id,
                'story_id': story_id
            }, room=sid)
        else:
            await sio.emit('story_state_update', {
                'current_scene': None,
                'current_dialogue': 0,
                'current_turn': None,
                'audio_generating': False,
                'current_audio_task': None,
                'has_next_dialogue': False,
                'is_scene_complete': False,
                'has_next_scene': False,
                'is_story_complete': False,
                'user_id': user_id,
                'story_id': story_id
            }, room=sid)
    except Exception as e:
        logger.error(f"Story state update request error: {e}")
        await sio.emit('error', {'message': 'Story state update error'}, room=sid)

@app.route('/api/pronounce-word', methods=['POST'])
def pronounce_word():
    """Pronounce word API"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence')
        word = data.get('word', '')
        target_sound = data.get('target_sound', '')
        
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
            
        if not word:
            return error_response('Word is not provided')
        
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state:
            return error_response('Story not initialized')
        
        # remove curly braces
        clean_word = word.replace('{', '').replace('}', '')
        logger.info(f"Pronounce word request: {clean_word}")
        
        # Use helper function for audio generation
        run_audio_generation_async(
            story_state, user_id, story_id, 'word_pronunciation',
            story_state['audio_creator'].generate_word_pronunciation,
                    clean_word, target_sound
        )

        return success_response({'word': clean_word}, f'Word "{clean_word}" is pronounced')
        
    except Exception as e:
        logger.error(f"Pronounce word API error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.route('/api/play-sound-description', methods=['POST'])
def play_sound_description():
    """Play sound description audio using audio_creator"""
    try:
        data = request.get_json()
        description_text = data.get('description', '').strip()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence')
        
        if not description_text:
            return error_response('Description text is required')
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
        
        # Get audio creator instance from story state or create a new one
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state or 'audio_creator' not in story_state:
            return error_response('Audio creator not initialized')
        
        audio_creator = story_state['audio_creator']
        
        # Generate audio using the new method
        run_audio_generation_async(
            story_state, user_id, story_id, 'sound_description',
            audio_creator.generate_sound_description_audio,
            description_text
        )
        
        return success_response(message='Sound description audio generation started')
    except Exception as e:
        logger.error(f"Sound description audio error: {e}")
        return error_response(str(e), 500)

@app.route('/api/story/select-destination', methods=['POST'])
def select_destination():
    """Handle destination selection for interactive stories"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence')
        selected_destination = data.get('selected_destination', '')
        
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
            
        if not selected_destination:
            return error_response('Destination is not provided')
        
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state:
            return error_response('No active story session')
        
        logger.info(f"Destination selected: {selected_destination}")
        
        # Store the selected destination for next scene determination
        story_state['selected_destination'] = selected_destination
        
        # Process the destination selection through story graph manager
        story_graph = story_state.get('story_manager')
        if story_graph:
            try:
                # Update story state with destination selection
                result = story_graph.process_user_choice_for_select_destination(selected_destination)
                
                # IMPORTANT: Sync story_graph changes back to story_state
                # Update current_scene in story_state to reflect the changes made in story_graph
                updated_scene = story_graph.current_scene_id
                if updated_scene:
                    story_state['current_scene'] = updated_scene
                    logger.info(f"Synced story_graph changes to story_state for selected_destination: {selected_destination}")
                
                # Save state after destination selection
                save_story_state(user_id, story_id, story_mode, story_state)
                
                # If there's an immediate next dialogue, return it
                if result and 'next_dialogue' in result:
                    return jsonify({
                        'success': True,
                        'message': f'Destination "{selected_destination}" selected successfully',
                        'selected_destination': selected_destination,
                        'next_dialogue': result['next_dialogue']
                    })
                
                 # Default response - destination stored, ready for next scene
                return jsonify({
                    'success': True,
                    'message': f'Destination "{selected_destination}" selected successfully',
                    'selected_destination': selected_destination
                })
            except Exception as e:
                logger.warning(f"Story graph processing error: {e}")
    
        
    except Exception as e:
        logger.error(f"Select destination API error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.route('/api/story/choose-item', methods=['POST'])
def choose_item():
    """Handle item choice when screen is clicked during click interaction"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence')
        chosen_item = data.get('chosen_item', '')
        
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
            
        if not chosen_item:
            return error_response('Item is not provided')
        
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state:
            return error_response('No active story session')
        
        logger.info(f"Item chosen: {chosen_item}")
        
        # Store the chosen item for next scene determination
        story_state['chosen_item'] = chosen_item

        story_graph = story_state.get('story_manager')
        if story_graph:
            try:
                # Update story state with item selection
                result = story_graph.process_user_choice_for_choose_item(chosen_item)
                
                # IMPORTANT: Sync story_graph changes back to story_state
                # Update current_scene in story_state to reflect the changes made in story_graph
                updated_scene = story_graph.current_scene_id
                if updated_scene:
                    story_state['current_scene'] = updated_scene
                    logger.info(f"Synced story_graph changes to story_state for chosen_item: {chosen_item}")
                
                # Save state after item selection
                save_story_state(user_id, story_id, story_mode, story_state)
                
                # If there's an immediate next dialogue, return it
                if result and 'next_dialogue' in result:
                    return jsonify({
                        'success': True,
                        'message': f'Item "{chosen_item}" chosen successfully',
                        'chosen_item': chosen_item,
                        'next_dialogue': result['next_dialogue']
                    })
                
                 # Default response - item stored, ready for next scene
                return jsonify({
                    'success': True,
                    'message': f'Item "{chosen_item}" chosen successfully',
                    'chosen_item': chosen_item
                })
            except Exception as e:
                logger.warning(f"Story graph processing error: {e}")
        
    except Exception as e:
        logger.error(f"Choose item API error: {e}")
        return error_response(f'Server error: {str(e)}', 500)

@app.route('/api/story/explore-item', methods=['POST'])
def explore_item():
    """Handle item exploration when screen is clicked during click interaction"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '').strip()
        story_id = data.get('story_id', '').strip()
        story_mode = data.get('story_mode', 'sentence')
        item = data.get('item', '')
        available_items = data.get('available_items', [])
        
        if not user_id or not story_id:
            return error_response('User ID and Story ID are required')
        if not item:
            return error_response('Item is not provided')
        
        story_state = get_current_story_state(user_id, story_id, story_mode)
        if not story_state:
            return error_response('No active story session')
        
        logger.info(f"Item exploration: {item} from available items: {available_items}")
        
        # Get current scene and character info
        current_scene = story_state.get('current_scene')
        if not current_scene:
            return error_response('No current scene found')
        # Generate exploration dialogue
        dialog_gen = story_state.get('dialog_gen')
        if not dialog_gen:
            return error_response('Dialog generator not available')
        
        # Create exploration dialogue template
        exploration_dialogue = {
            'character': current_scene.get('characters', ['Character'])[0],  # Use first character
            'type': 'character_dialogue'
        }
        try: # Generate dialogue text like "Explore the item, how about {item}?"
            dialogue_text = dialog_gen.generate_exploration_dialogue(
                current_scene, item, available_items, story_state.get('target_sounds', [])
            )
            exploration_dialogue['text'] = dialogue_text
            
            # Start audio generation
            character = exploration_dialogue['character']
            run_audio_generation_async(
                story_state,
                user_id,
                story_id,
                'exploration',
                story_state['audio_creator'].generate_speech_with_dialogue,
                character,
                exploration_dialogue['text']
            )
            exploration_dialogue['audio_generating'] = True
            
            # Log the exploration event
            log_story_event('item_exploration', user_id, story_id, story_mode, {
                'item': item,
                'available_items': available_items,
                'character': character,
                'dialogue_text': dialogue_text
            })
            
            return jsonify({
                'success': True,
                'dialogue': exploration_dialogue,
                'explored_item': item
            })
            
        except Exception as e:
            logger.error(f"Exploration dialogue generation error: {e}")
            # Fallback dialogue
            fallback_text = f"Explore the item, how about {item}?"
            exploration_dialogue['text'] = fallback_text
            exploration_dialogue['audio_generating'] = False
            
            return jsonify({
                'success': True,
                'dialogue': exploration_dialogue,
                'explored_item': item
            })
        
    except Exception as e:
        logger.error(f"Explore item API error: {e}")
        return error_response(f'Server error: {str(e)}', 500)


# Recordings API
@app.route('/api/recordings/list')
def get_recordings_list():
    """Return current user recordings list"""
    try:
        user_id = request.args.get('user_id', type=str)
        
        if not user_id:
            return error_response('User ID is required')
        
        recordings_dir = os.path.join(app.root_path, "story_recordings")
        user_dir = os.path.join(recordings_dir, f"user_{user_id}")
        
        # Check for new format (user_*) first, then fallback to old format (session_*)
        if os.path.exists(user_dir):
            recordings = get_recordings_list_by_user_id(user_id, user_dir)
        else:
            recordings = []
        
        return jsonify({
            'success': True,
            'recordings': recordings,
            'user_id': user_id
        })
        
    except Exception as e:
        logger.error(f"Recordings list check error: {e}")
        return error_response(f'Recordings list check error: {str(e)}', 500)

@app.route('/api/recordings/audio/<path:filename>')
def get_recording_audio(filename):
    """Provide recording audio file for current user"""
    try:
        user_id = request.args.get('user_id', type=str)
        
        if not user_id:
            return error_response('User ID is required')
        
        # filename 형태: user_ID/story_ID/mode_MODE/filename.wav or session_ID/story_ID/mode_MODE/filename.wav (legacy)
        filepath = os.path.join(app.root_path, "story_recordings", filename)
        
        # 보안 검사: 현재 사용자의 파일만 접근 가능 (new format or legacy format)
        if not (filename.startswith(f"user_{user_id}/") or filename.startswith(f"session_{user_id}/")):
            return error_response('Access denied', 403)
        
        if not os.path.exists(filepath):
            return error_response('File not found', 404)
        
        return send_file(filepath, mimetype='audio/wav')
        
    except Exception as e:
        logger.error(f"Recording audio file provide error: {e}")
        return error_response(f'Recording audio file provide error: {str(e)}', 500)

@app.route('/recordings')
def recordings_page():
    """Recordings result page"""
    return render_template('recordings.html')

@app.route('/mouth_img/<path:filename>')
def serve_mouth_img(filename):
    return send_from_directory(os.path.join(app.root_path, 'mouth_img'), filename)

@app.route('/api/recordings/pronunciation-analysis')
def get_pronunciation_analysis():
    """Get pronunciation distance analysis for user recordings"""
    try:
        user_id = request.args.get('user_id')
        story_id = request.args.get('story_id')
        
        if not user_id:
            return error_response('User ID is required')
        
        target_words, analysis_results = analysis_pronuncitaion_distance(story_id, user_id)
        
        # Ensure compatibility with frontend expecting `all_stories_analysis` when story_id is not provided
        response_payload = {
            'success': True,
            'story_id': story_id,
            'user_id': user_id,
            'target_words': target_words,
            'analysis_results': analysis_results
        }
        
        if not story_id:
            # analysis_results here contains per-story analyses; mirror it under the expected key
            response_payload['all_stories_analysis'] = analysis_results
        
        return jsonify(response_payload)
            
    except Exception as e:
        logger.error(f"Pronunciation analysis error: {e}")
        return error_response(str(e), 500)

if __name__ == '__main__':
    logger.info("Web application started. Check the start page at http://localhost:8080/login")
    # socketio.run(app, debug=True, host='0.0.0.0', port=8080)
    import uvicorn
    uvicorn.run('web_app:asgi_app', host="0.0.0.0", port=8080, reload=True)


