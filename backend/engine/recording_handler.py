import os
import json
import logging
from .error_detector import PronunciationDistanceCalculator

logger = logging.getLogger(__name__)

def clean_target_word(target_word):
    """Clean target word by removing suffixes and underscores"""
    if not target_word:
        return None
    
    # Remove common suffixes and clean the word
    cleaned = target_word.replace('_transcript', '').replace('_phoneme', '').replace('_prompt', '')
    
    # Remove any remaining underscores at the end
    cleaned = cleaned.rstrip('_')
    
    # If empty after cleaning, return None
    if not cleaned:
        return None
        
    return cleaned

def calculate_pronunciation_statistics(recordings, target_words):
    """Calculate pronunciation statistics for target words"""
    statistics = {}
    
    # Initialize statistics for all target words
    for word in target_words:
        clean_word = word.replace('{', '').replace('}', '').strip().lower()
        if clean_word:
            statistics[clean_word] = 0
    
    # Count pronunciations from recordings
    for recording in recordings:
        target_word = recording.get('target_word')
        transcription = recording.get('transcription')
        
        # Count from target_word field (mainly from word mode)
        if target_word:
            clean_target = target_word.strip().lower()
            if clean_target in statistics:
                statistics[clean_target] += 1
        
        # Count from transcription (both word mode and sentence mode)
        if transcription:
            transcription_lower = transcription.lower()
            # Remove punctuation and split into words
            import re
            transcription_words = re.findall(r'\b\w+\b', transcription_lower)
            
            # Check each target word against transcription
            for word in target_words:
                clean_word = word.replace('{', '').replace('}', '').strip().lower()
                
                # Handle multi-word targets (e.g., "raven's shadow")
                if ' ' in clean_word or "'" in clean_word:
                    # For multi-word targets, check if the phrase exists in the transcription
                    if clean_word in transcription_lower:
                        if clean_word in statistics:
                            # Only add if we haven't already counted from target_word field
                            if not target_word or target_word.strip().lower() != clean_word:
                                statistics[clean_word] += 1
                else:
                    # For single words, check in word list
                    if clean_word in transcription_words:
                        # Count how many times this word appears in the transcription
                        word_count = transcription_words.count(clean_word)
                        if clean_word in statistics:
                            # Only add if we haven't already counted from target_word field
                            if not target_word or target_word.strip().lower() != clean_word:
                                statistics[clean_word] += word_count
    
    return statistics

def analysis_pronuncitaion_distance(story_id, user_id):
    base_dir = os.path.dirname(os.path.dirname(__file__))  # backend directory
    # Initialize distance calculator
    calculator = PronunciationDistanceCalculator()
        
    if story_id:
        # Analyze specific story
        recording_dir = os.path.join(base_dir, 'story_recordings', f'user_{user_id}', f'story_{story_id}')
        
        # Get target words from story data
        story_file = os.path.join(base_dir, 'story', f'story_{story_id}.json')
        target_words = []
        if os.path.exists(story_file):
            with open(story_file, 'r') as f:
                story_data = json.load(f)
                target_words = story_data.get('metadata', {}).get('target_words', [])
        
        analysis_results = calculator.analyze_recording_pronunciation(recording_dir, target_words)
        
        return target_words, analysis_results
    else:
        # Analyze all stories for the user
        user_recordings_dir = os.path.join(base_dir, 'story_recordings', f'user_{user_id}')
        all_analyses = {}
        
        if os.path.exists(user_recordings_dir):
            for story_dir_name in os.listdir(user_recordings_dir):
                if story_dir_name.startswith('story_'):
                    story_id_from_dir = story_dir_name.replace('story_', '')
                    story_recording_dir = os.path.join(user_recordings_dir, story_dir_name)
                    
                    # Get target words for this story
                    story_file = os.path.join(base_dir, 'story', f'story_{story_id_from_dir}.json')
                    target_words = []
                    if os.path.exists(story_file):
                        with open(story_file, 'r') as f:
                            story_data = json.load(f)
                            target_words = story_data.get('metadata', {}).get('target_words', [])
                    
                    analysis_results = calculator.analyze_recording_pronunciation(story_recording_dir, target_words)
                    all_analyses[story_id_from_dir] = {
                        'target_words': target_words,
                        'analysis': analysis_results
                    }
        
        return target_words, all_analyses

def get_recordings_list_by_user_id(user_id, user_dir):
    recordings = []
    base_dir = os.path.dirname(os.path.dirname(__file__))  # backend directory
        
    # Search all stories in the user directory
    for story_dir_name in os.listdir(user_dir):
        if story_dir_name.startswith("story_"):
            story_id = story_dir_name.replace("story_", "")
            story_path = os.path.join(user_dir, story_dir_name)
            story_metadata = json.load(open(os.path.join(base_dir, "story", "story_"+story_id+".json"), 'r', encoding='utf-8'))['metadata']
            story_target_words = story_metadata['target_words']
            story_target_sounds = story_metadata.get('themes', [])
            story_title = story_metadata.get('title', f'Story {story_id}')
            
            if os.path.isdir(story_path):
                story_modes = []
                
                # Search all modes in the story
                for mode_dir_name in os.listdir(story_path):
                    if mode_dir_name.startswith("mode_"):
                        story_mode = mode_dir_name.replace("mode_", "")
                        mode_path = os.path.join(story_path, mode_dir_name)
                        
                        if os.path.isdir(mode_path):
                            mode_recordings = []
                            
                            # Search all recordings in the mode
                            for file in os.listdir(mode_path):
                                if file.endswith('.wav'):
                                    # Extract information from the filename
                                    # Filename format: recording_YYYYMMDD_HHMMSS_targetword.wav
                                    file_parts = file.replace('recording_', '').replace('.wav', '').split('_')
                                    logger.debug(f"Recording handler parsing: {file}, parts after removing 'recording_': {file_parts}")
                                    timestamp = '_'.join(file_parts[:2])  # YYYYMMDD_HHMMSS
                                    target_word = '_'.join(file_parts[2:]) if len(file_parts) > 2 else None
                                    logger.debug(f"Recording handler extracted target_word: {target_word}")
                                    
                                    # Clean target_word
                                    target_word = clean_target_word(target_word)
                                    
                                    recording_info = {
                                        'filename': file,
                                        'filepath': os.path.join(mode_path, file),
                                        'timestamp': timestamp,
                                        'target_word': target_word,
                                        'size': os.path.getsize(os.path.join(mode_path, file))
                                    }
                                    
                                    # Check transcription file
                                    transcript_file = file.replace('.wav', '_transcript.txt')
                                    transcript_path = os.path.join(mode_path, transcript_file)
                                    if os.path.exists(transcript_path):
                                        try:
                                            with open(transcript_path, 'r', encoding='utf-8') as f:
                                                recording_info['transcription'] = f.read().strip()
                                        except Exception as e:
                                            logger.error(f"Transcription file read error: {e}")
                                            recording_info['transcription'] = "Read error"
                                    else:
                                        recording_info['transcription'] = None
                                    
                                    # Check prompt file (sentence mode only)
                                    if story_mode == 'sentence':
                                        prompt_file = file.replace('.wav', '_prompt.txt')
                                        prompt_path = os.path.join(mode_path, prompt_file)
                                        if os.path.exists(prompt_path):
                                            try:
                                                with open(prompt_path, 'r', encoding='utf-8') as f:
                                                    recording_info['prompt'] = f.read().strip()
                                            except Exception as e:
                                                logger.error(f"Prompt file read error: {e}")
                                                recording_info['prompt'] = "Read error"
                                        else:
                                            recording_info['prompt'] = None
                                    else:
                                        recording_info['prompt'] = None
                                    
                                    # Check phoneme transcription file (새로 추가)
                                    phoneme_file = file.replace('.wav', '_phoneme.txt')
                                    phoneme_path = os.path.join(mode_path, phoneme_file)
                                    if os.path.exists(phoneme_path):
                                        try:
                                            with open(phoneme_path, 'r', encoding='utf-8') as f:
                                                recording_info['phoneme_transcription'] = f.read().strip()
                                        except Exception as e:
                                            logger.error(f"Phoneme transcription file read error: {e}")
                                            recording_info['phoneme_transcription'] = "Read error"
                                    else:
                                        recording_info['phoneme_transcription'] = None
                                    
                                    mode_recordings.append(recording_info)
                            
                            # Sort by timestamp
                            mode_recordings.sort(key=lambda x: x['timestamp'], reverse=True)
                            story_modes.append({
                                'story_mode': story_mode,
                                'recordings': mode_recordings,
                                'total_recordings': len(mode_recordings)
                            })
                
                # Sort by story mode
                story_modes.sort(key=lambda x: x['story_mode'])
                
                # Calculate pronunciation statistics for this story
                all_recordings = []
                for mode in story_modes:
                    all_recordings.extend(mode['recordings'])
                
                pronunciation_stats = calculate_pronunciation_statistics(all_recordings, story_target_words)
                
                recordings.append({
                    'story_id': story_id,
                    'story_title': story_title,
                    'story_modes': story_modes,
                    'target_words': story_target_words,
                    'target_sounds': story_target_sounds,
                    'pronunciation_statistics': pronunciation_stats,
                    'total_recordings': sum(mode['total_recordings'] for mode in story_modes)
                })
    
    # Sort by story ID
    recordings.sort(key=lambda x: x['story_id'])

    return recordings

def get_recordings_list_by_story_id(story_id, recordings_dir):
    story_modes = []
        
    # 각 모드별로 녹음 파일들을 탐색
    for mode_dir_name in os.listdir(recordings_dir):
        if mode_dir_name.startswith("mode_"):
            story_mode = mode_dir_name.replace("mode_", "")
            mode_path = os.path.join(recordings_dir, mode_dir_name)
            
            if os.path.isdir(mode_path):
                mode_recordings = []
                
                for file in os.listdir(mode_path):
                    if file.endswith('.wav'):
                        # 파일명에서 정보 추출
                        # Filename format: recording_YYYYMMDD_HHMMSS_targetword.wav
                        file_parts = file.replace('recording_', '').replace('.wav', '').split('_')
                        logger.debug(f"Story recordings parsing: {file}, parts after removing 'recording_': {file_parts}")
                        timestamp = '_'.join(file_parts[:2])  # YYYYMMDD_HHMMSS
                        target_word = '_'.join(file_parts[2:]) if len(file_parts) > 2 else None
                        logger.debug(f"Story recordings extracted target_word: {target_word}")
                        
                        # Clean target_word
                        target_word = clean_target_word(target_word)
                        
                        recording_info = {
                            'filename': file,
                            'filepath': os.path.join(mode_path, file),
                            'timestamp': timestamp,
                            'target_word': target_word,
                            'size': os.path.getsize(os.path.join(mode_path, file))
                        }
                        
                        # Check transcription file
                        transcript_file = file.replace('.wav', '_transcript.txt')
                        transcript_path = os.path.join(mode_path, transcript_file)
                        if os.path.exists(transcript_path):
                            try:
                                with open(transcript_path, 'r', encoding='utf-8') as f:
                                    recording_info['transcription'] = f.read().strip()
                            except Exception as e:
                                logger.error(f"Transcription file read error: {e}")
                                recording_info['transcription'] = "Read error"
                        else:
                            recording_info['transcription'] = None
                        
                        # Check prompt file (sentence mode only)
                        if story_mode == 'sentence':
                            prompt_file = file.replace('.wav', '_prompt.txt')
                            prompt_path = os.path.join(mode_path, prompt_file)
                            if os.path.exists(prompt_path):
                                try:
                                    with open(prompt_path, 'r', encoding='utf-8') as f:
                                        recording_info['prompt'] = f.read().strip()
                                except Exception as e:
                                    logger.error(f"Prompt file read error: {e}")
                                    recording_info['prompt'] = "Read error"
                            else:
                                recording_info['prompt'] = None
                        else:
                            recording_info['prompt'] = None
                        
                        # Check phoneme transcription file (새로 추가)
                        phoneme_file = file.replace('.wav', '_phoneme.txt')
                        phoneme_path = os.path.join(mode_path, phoneme_file)
                        if os.path.exists(phoneme_path):
                            try:
                                with open(phoneme_path, 'r', encoding='utf-8') as f:
                                    recording_info['phoneme_transcription'] = f.read().strip()
                            except Exception as e:
                                logger.error(f"Phoneme transcription file read error: {e}")
                                recording_info['phoneme_transcription'] = "Read error"
                        else:
                            recording_info['phoneme_transcription'] = None
                        
                        mode_recordings.append(recording_info)
                
                # Sort by timestamp
                mode_recordings.sort(key=lambda x: x['timestamp'], reverse=True)
                
                story_modes.append({
                    'story_mode': story_mode,
                    'recordings': mode_recordings,
                    'total_recordings': len(mode_recordings)
                })
    
    # Sort by story mode
    story_modes.sort(key=lambda x: x['story_mode'])

    return story_modes