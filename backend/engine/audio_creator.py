from openai import OpenAI
from random import choice
import json
import asyncio
from openai import AsyncOpenAI
from openai.helpers import LocalAudioPlayer
try:
    import sounddevice as sd  # Optional in deployed/server environments
except Exception:
    sd = None
import numpy as np
import wave
import tempfile
import os
from datetime import datetime
import librosa
import subprocess
import tempfile
from werkzeug.utils import secure_filename
from google import genai
from google.genai import types
import shutil

class AudioCreator:
    def __init__(self, api_key, character_profiles, gemini_api_key=None):
        self.gemini_client = genai.Client(api_key=gemini_api_key)
        self.openai_async = AsyncOpenAI(api_key=api_key)
        self.openai_sync = OpenAI(api_key=api_key)
        self.voices = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]
        self.character_profiles = character_profiles
        self.character_voices = self.config_character_voices(self.character_profiles)
        self.recording = None
        self.is_recording = False
        self.last_recorded_frames = None
        self.stream = None
        self.buffer_frames = []
        self.last_saved_recording_path = None  # 마지막으로 저장된 녹음 파일 경로

    def _ensure_dir(self, dir_path: str) -> None:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)

    def _timestamp(self) -> str:
        return datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    
    def _concatenate_audio_files(self, file1_path: str, file2_path: str, output_path: str) -> str:
        """Concatenate two WAV audio files"""
        try:
            import wave
            
            # Read first file
            with wave.open(file1_path, 'rb') as wav1:
                params1 = wav1.getparams()
                frames1 = wav1.readframes(wav1.getnframes())
            
            # Read second file
            with wave.open(file2_path, 'rb') as wav2:
                params2 = wav2.getparams()
                frames2 = wav2.readframes(wav2.getnframes())
            
            # Ensure both files have same parameters
            if params1[:3] != params2[:3]:  # channels, sampwidth, framerate
                print(f"Warning: Audio parameters differ. File1: {params1[:3]}, File2: {params2[:3]}")
                # Convert file2 to match file1's format if needed
                if params1[2] != params2[2]:  # Different sample rates
                    import librosa
                    import soundfile as sf
                    # Resample file2
                    audio2, sr2 = librosa.load(file2_path, sr=None)
                    audio2_resampled = librosa.resample(audio2, orig_sr=sr2, target_sr=params1[2])
                    # Save resampled audio to temp file
                    temp_file = file2_path.replace('.wav', '_resampled.wav')
                    sf.write(temp_file, audio2_resampled, params1[2])
                    # Read resampled frames
                    with wave.open(temp_file, 'rb') as wav2_new:
                        frames2 = wav2_new.readframes(wav2_new.getnframes())
                    # Clean up temp file
                    import os
                    os.remove(temp_file)
            
            # Write concatenated file
            with wave.open(output_path, 'wb') as wav_out:
                wav_out.setparams(params1)
                wav_out.writeframes(frames1 + frames2)
            
            print(f"Audio files concatenated successfully: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"Error concatenating audio files: {e}")
            # Return first file as fallback
            return file1_path

    def config_character_voices(self, character_profiles):
        character_voices = {}
        for character in character_profiles:
            character_voices[character['name']] = choice(self.voices)
        return character_voices

    async def generate_speech_with_dialogue(self, character, dialogue_text, speed=0.8, sample_rate=24000):
        """Generate TTS for character dialogue and save to file; return file path."""
        self._ensure_dir("generated_audio")
        safe_char = secure_filename(str(character)) or "character"
        out_path = os.path.join("generated_audio", f"{safe_char}_{self._timestamp()}.wav")

        async with self.openai_async.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice=self.character_voices[character],
            input=dialogue_text,
            instructions=f"Speak slowly and clearly in a {next((c['description'] for c in self.character_profiles if c['name'] == character), '').strip()} tone.",
            response_format="wav",
        ) as response:
            # Save stream to file for client playback
            if hasattr(response, "stream_to_file"):
                await response.stream_to_file(out_path)  # type: ignore[attr-defined]
            else:
                # Fallback: read chunks
                with open(out_path, "wb") as f:
                    async for chunk in response.iter_bytes():  # type: ignore[attr-defined]
                        f.write(chunk)
        return out_path

    async def generate_word_pronunciation(self, word, target_sound):
        """Generate TTS for a single word; save to file and return path."""
        self._ensure_dir("generated_audio")
        safe_word = secure_filename(str(word)) or "word"
        out_path = os.path.join("generated_audio", f"word_{safe_word}_{self._timestamp()}.wav")
        async with self.openai_async.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice=self.voices[0],
            input=word,
            instructions=f"Speak slowly and clearly in a correct pronunciation of the target sound: {target_sound}.",
            response_format="wav",
        ) as response:
            if hasattr(response, "stream_to_file"):
                await response.stream_to_file(out_path)  # type: ignore[attr-defined]
            else:
                with open(out_path, "wb") as f:
                    async for chunk in response.iter_bytes():  # type: ignore[attr-defined]
                        f.write(chunk)
        return out_path

    async def generate_speech_with_dialogue_user(self, dialogue_text):
        """Generate TTS for user's combined dialogue; save to file and return path."""
        self._ensure_dir("generated_audio")
        out_path = os.path.join("generated_audio", f"user_dialogue_{self._timestamp()}.wav")
        async with self.openai_async.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice=self.voices[-1],
            input=dialogue_text,
            instructions=f"Speak slowly and clearly in a correct pronunciation of the children's dialogue.",
            response_format="wav",
        ) as response:
            if hasattr(response, "stream_to_file"):
                await response.stream_to_file(out_path)  # type: ignore[attr-defined]
            else:
                with open(out_path, "wb") as f:
                    async for chunk in response.iter_bytes():  # type: ignore[attr-defined]
                        f.write(chunk)
        return out_path

    async def generate_sound_description_audio(self, description_text):
        """소리 설명을 위한 친근한 음성 생성. 파일로 저장하고 경로 반환"""
        self._ensure_dir("generated_audio")
        out_path = os.path.join("generated_audio", f"description_{self._timestamp()}.wav")
        async with self.openai_async.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice="nova",  # 친근하고 부드러운 음성
            input=description_text,
            instructions="Speak in a warm, friendly, and encouraging teacher's voice. Be gentle and patient while explaining pronunciation techniques.",
            response_format="wav",
        ) as response:
            if hasattr(response, "stream_to_file"):
                await response.stream_to_file(out_path)  # type: ignore[attr-defined]
            else:
                with open(out_path, "wb") as f:
                    async for chunk in response.iter_bytes():  # type: ignore[attr-defined]
                        f.write(chunk)
        return out_path

    async def generate_retry_instruction_audio(self, missing_words, character_name=None, retry_count=1, user_recording_path=None):
        """Generate encouraging audio instruction for retry when target words are missing
        
        Args:
            missing_words: List of words that were missing from user input
            character_name: Name of character to use for voice
            retry_count: Current retry attempt number
            user_recording_path: Path to user's recording to concatenate after instruction
        
        Returns:
            Path to generated audio file (concatenated if user_recording_path provided)
        """
        voice = self.character_voices.get(character_name, self.voices[2]) if character_name else self.voices[2]
        
        # Create contextual instruction based on missing words and retry count
        if retry_count == 1:
            if len(missing_words) == 1:
                instruction_text = f"Great try! Can you say it again and include the word '{missing_words[0]}'? You can do it!"
            else:
                words_text = "', '".join(missing_words)
                instruction_text = f"Nice effort! Try again and include these words: '{words_text}'. Take your time!"
        else:
            if len(missing_words) == 1:
                instruction_text = f"Almost there! Remember to say '{missing_words[0]}' in your response. You're doing great!"
            else:
                words_text = "', '".join(missing_words)
                instruction_text = f"Keep going! Make sure to include '{words_text}' in what you say. You've got this!"
        
        # Add listening prompt if user recording will be included
        if user_recording_path and os.path.exists(user_recording_path):
            instruction_text += " Now, listen to your pronunciation."
        
        character_description = "friendly and encouraging teacher" if not character_name else f"{character_name}, speaking as a supportive guide"
        
        self._ensure_dir("generated_audio")
        out_path = os.path.join("generated_audio", f"retry_{self._timestamp()}.wav")
        async with self.openai_async.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice=voice,
            input=instruction_text,
            instructions=f"Speak slowly and clearly as a {character_description}. Be encouraging and patient.",
            response_format="wav",
        ) as response:
            if hasattr(response, "stream_to_file"):
                await response.stream_to_file(out_path)  # type: ignore[attr-defined]
            else:
                with open(out_path, "wb") as f:
                    async for chunk in response.iter_bytes():  # type: ignore[attr-defined]
                        f.write(chunk)
        
        # Concatenate with user recording if provided
        if user_recording_path and os.path.exists(user_recording_path):
            combined_path = os.path.join("generated_audio", f"retry_combined_{self._timestamp()}.wav")
            out_path = self._concatenate_audio_files(out_path, user_recording_path, combined_path)
            print(f"Concatenated instruction with user recording: {out_path}")
        
        return out_path

    async def generate_word_mode_retry_audio(self, available_words, user_input, character_name=None, retry_count=1):
        """Generate encouraging audio instruction for word mode when user says wrong word"""
        voice = self.character_voices.get(character_name, self.voices[2]) if character_name else self.voices[2]
        
        # Create contextual instruction based on available words and what user said
        if len(available_words) == 1:
            target_word = available_words[0]
            if retry_count == 1:
                instruction_text = f"Good try! I heard you say '{user_input}', but try saying '{target_word}' instead. You can do it!"
            elif retry_count == 2:
                instruction_text = f"Almost there! Let's try '{target_word}' - say it clearly. You're doing great!"
            else:
                instruction_text = f"Keep going! Just say '{target_word}' - take your time and say it clearly."
        else:
            words_text = "', '".join(available_words[:-1]) + f"', or '{available_words[-1]}'"
            if retry_count == 1:
                instruction_text = f"Good try! I heard '{user_input}', but please choose one of these words: '{words_text}'. Pick any one you like!"
            elif retry_count == 2:
                instruction_text = f"You're doing well! Try saying one of these words clearly: '{words_text}'. Take your time!"
            else:
                instruction_text = f"Almost there! Choose one word from: '{words_text}' and say it clearly. You've got this!"
        
        character_description = "friendly and encouraging teacher" if not character_name else f"{character_name}, speaking as a helpful guide"
        
        self._ensure_dir("generated_audio")
        out_path = os.path.join("generated_audio", f"word_retry_{self._timestamp()}.wav")
        async with self.openai_async.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice=voice,
            input=instruction_text,
            instructions=f"Speak slowly and clearly as a {character_description}. Be encouraging and help guide word pronunciation.",
            response_format="wav",
        ) as response:
            if hasattr(response, "stream_to_file"):
                await response.stream_to_file(out_path)  # type: ignore[attr-defined]
            else:
                with open(out_path, "wb") as f:
                    async for chunk in response.iter_bytes():  # type: ignore[attr-defined]
                        f.write(chunk)
        return out_path

    def toggle_recording(self):
        """Toggle recording on/off - start if not recording, stop if recording"""
        # In deployed environments, recording should be handled client-side.
        if sd is None:
            return None
        if not self.is_recording:
            return self.start_recording()
        else:
            return self.stop_recording()

    def start_recording(self):
        """Start recording audio"""
        if sd is None:
            return False
        if not self.is_recording:
            RATE = 44100
            self.buffer_frames = []

            def _callback(indata, frames, time, status):
                if status:
                    print(f"Audio stream status: {status}")
                # Copy to avoid referencing the same memory
                self.buffer_frames.append(indata.copy())

            self.stream = sd.InputStream(samplerate=RATE, channels=1, dtype=np.int16, callback=_callback)
            self.stream.start()
            self.is_recording = True
            print("Recording started...")
            return True
        return False

    def stop_recording(self):
        """Stop recording and return the recorded audio data"""
        if self.is_recording and self.stream is not None and sd is not None:
            self.stream.stop()
            self.stream.close()
            self.stream = None
            self.is_recording = False

            if len(self.buffer_frames) == 0:
                print("No audio captured.")
                return None

            frames = np.concatenate(self.buffer_frames, axis=0)
            print("Recording stopped!")
            return frames
        return None

    def play_audio(self, audio_frames):
        """Play back the recorded audio"""
        if sd is None:
            return
        if audio_frames is not None:
            RATE = 44100
            print("Playing back recorded audio...")
            sd.play(audio_frames, RATE)
            sd.wait()
            print("Playback complete!")

    def save_recording(self, audio_frames, story_id, user_id, story_mode, target_word=None, save_dir="story_recordings"):
        """녹음 파일을 WAV 형식으로 저장 (session_id, story_mode 기반)"""
        try:
            # 저장 디렉토리 생성
            if not os.path.exists(save_dir):
                os.makedirs(save_dir)
            
            # session_id - story_id - story_mode 기반 폴더 구조 생성
            user_dir = os.path.join(save_dir, f"user_{user_id}")
            if not os.path.exists(user_dir):
                os.makedirs(user_dir)
            
            story_dir = os.path.join(user_dir, f"{story_id}")
            if not os.path.exists(story_dir):
                os.makedirs(story_dir)
            
            mode_dir = os.path.join(story_dir, f"mode_{story_mode}")
            if not os.path.exists(mode_dir):
                os.makedirs(mode_dir)
            
            # 파일명 생성 (타임스탬프 포함)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            if target_word and story_mode == 'word':
                # word-mode에서는 target_word 포함
                clean_word = target_word.replace('{', '').replace('}', '').replace(' ', '_')
                filename = f"recording_{timestamp}_{clean_word}.wav"
            else:
                filename = f"recording_{timestamp}.wav"
            
            filepath = os.path.join(mode_dir, filename)
            
            # WAV 파일로 저장
            wf = wave.open(filepath, 'wb')
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(audio_frames.tobytes())
            wf.close()
            
            self.last_saved_recording_path = filepath
            print(f"녹음 파일 저장됨: {filepath}")
            return filepath
            
        except Exception as e:
            print(f"녹음 파일 저장 오류: {e}")
            return None

    def save_uploaded_recording(self, source_wav_path, story_id, user_id, story_mode, target_word=None, save_dir="story_recordings"):
        """Copy an uploaded WAV file into the structured recordings folder and return new path."""
        try:
            self._ensure_dir(save_dir)

            user_dir = os.path.join(save_dir, f"user_{user_id}")
            self._ensure_dir(user_dir)

            story_dir = os.path.join(user_dir, f"{story_id}")
            self._ensure_dir(story_dir)

            mode_dir = os.path.join(story_dir, f"mode_{story_mode}")
            self._ensure_dir(mode_dir)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            if target_word and story_mode == 'word':
                clean_word = target_word.replace('{', '').replace('}', '').replace(' ', '_')
                filename = f"recording_{timestamp}_{clean_word}.wav"
            else:
                filename = f"recording_{timestamp}.wav"

            dest_path = os.path.join(mode_dir, filename)
            shutil.copyfile(source_wav_path, dest_path)
            self.last_saved_recording_path = dest_path
            print(f"업로드 녹음 파일 저장됨: {dest_path}")
            return dest_path
        except Exception as e:
            print(f"업로드 녹음 파일 저장 오류: {e}")
            return None

    def transcribe_user_speech(self, story_id=None, user_id=None, story_mode='sentence', target_word=None, prompt=None, save_recording=True):
        """음성 인식 및 녹음 파일 저장"""
        if not hasattr(self, 'last_recorded_frames') or self.last_recorded_frames is None:
            print("No audio recorded yet. Please record audio first.")
            return None
        
        # 녹음 파일 저장 (story_id와 session_id가 제공된 경우)
        saved_filepath = None
        if save_recording and story_id and user_id:
            saved_filepath = self.save_recording(
                self.last_recorded_frames, 
                story_id, 
                user_id, 
                story_mode, 
                target_word
            )
        
        # Save the audio to a temporary WAV file for transcription
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            wf = wave.open(temp_file.name, 'wb')
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(self.last_recorded_frames.tobytes())
            wf.close()
            
            with open(temp_file.name, 'rb') as audio_file:
                transcript = self.openai_sync.audio.transcriptions.create(
                    model="gpt-4o-mini-transcribe",
                    file=audio_file,
                    language="en"
                )
            os.unlink(temp_file.name)
            
            # transcription to file (if recording is saved)
            if saved_filepath:
                transcript_filepath = saved_filepath.replace('.wav', '_transcript.txt')
                try:
                    with open(transcript_filepath, 'w', encoding='utf-8') as f:
                        f.write(transcript.text.strip())
                    print(f"Transcription saved: {transcript_filepath}")
                except Exception as e:
                    print(f"Transcription save error: {e}")
                
                # prompt를 파일로 저장 (sentence 모드에서만)
                if prompt and story_mode == 'sentence':
                    prompt_filepath = saved_filepath.replace('.wav', '_prompt.txt')
                    try:
                        with open(prompt_filepath, 'w', encoding='utf-8') as f:
                            f.write(prompt.strip())
                        print(f"Prompt saved: {prompt_filepath}")
                    except Exception as e:
                        print(f"Prompt save error: {e}")
            
            # 백그라운드에서 phoneme transcription 생성 (새로 추가)
            import threading
            def generate_phoneme_transcription():
                try:
                    phoneme_transcript = self.transcribe_phoneme_from_audio(saved_filepath)
                    phoneme_filepath = saved_filepath.replace('.wav', '_phoneme.txt')
                    with open(phoneme_filepath, 'w', encoding='utf-8') as f:
                        f.write(phoneme_transcript)
                    print(f"Phoneme transcription saved: {phoneme_filepath}")
                except Exception as e:
                    print(f"Phoneme transcription error: {e}")
            
            # 백그라운드 스레드에서 실행
            phoneme_thread = threading.Thread(target=generate_phoneme_transcription)
            phoneme_thread.daemon = True
            phoneme_thread.start()
        
        return transcript.text.strip()

    def transcribe_audio_file(self, audio_filepath, story_id=None, user_id=None, story_mode='sentence', target_word=None, prompt=None, save_recording=True):
        """Transcribe an existing WAV file and optionally save it into recordings, with transcripts and prompt."""
        if not os.path.exists(audio_filepath):
            print("Audio file not found for transcription")
            return None

        saved_filepath = None
        if save_recording and story_id and user_id:
            saved_filepath = self.save_uploaded_recording(
                audio_filepath,
                story_id,
                user_id,
                story_mode,
                target_word
            )

        with open(audio_filepath, 'rb') as audio_file:
            transcript = self.openai_sync.audio.transcriptions.create(
                model="gpt-4o-mini-transcribe",
                file=audio_file,
                language="en"
            )

        if saved_filepath:
            transcript_filepath = saved_filepath.replace('.wav', '_transcript.txt')
            try:
                with open(transcript_filepath, 'w', encoding='utf-8') as f:
                    f.write(transcript.text.strip())
                print(f"Transcription saved: {transcript_filepath}")
            except Exception as e:
                print(f"Transcription save error: {e}")

            if prompt and story_mode == 'sentence':
                prompt_filepath = saved_filepath.replace('.wav', '_prompt.txt')
                try:
                    with open(prompt_filepath, 'w', encoding='utf-8') as f:
                        f.write(prompt.strip())
                    print(f"Prompt saved: {prompt_filepath}")
                except Exception as e:
                    print(f"Prompt save error: {e}")

            # Phoneme transcription in background
            import threading
            def generate_phoneme_transcription():
                try:
                    phoneme_transcript = self.transcribe_phoneme_from_audio(saved_filepath)
                    phoneme_filepath = saved_filepath.replace('.wav', '_phoneme.txt')
                    with open(phoneme_filepath, 'w', encoding='utf-8') as f:
                        f.write(phoneme_transcript)
                    print(f"Phoneme transcription saved: {phoneme_filepath}")
                except Exception as e:
                    print(f"Phoneme transcription error: {e}")

            phoneme_thread = threading.Thread(target=generate_phoneme_transcription)
            phoneme_thread.daemon = True
            phoneme_thread.start()

        return transcript.text.strip()

    def record_and_transcribe(self):
        """Complete workflow: record, play back, and transcribe"""
        if self.start_recording():
            print("Press Enter when you want to stop recording...")
            input()
            audio_frames = self.stop_recording()
            if audio_frames is not None:
                self.last_recorded_frames = audio_frames
                self.play_audio(audio_frames)
                return self.transcribe_user_speech()
        return None
    
    def transcribe_phoneme_from_audio(self, audio_filepath):
        with open(audio_filepath, 'rb') as f:
            audio_bytes = f.read()
        
        transcription_phoneme = ""
        for chunk in self.gemini_client.models.generate_content_stream(
            model = "gemini-2.5-pro",
            contents = [
            types.Content(
                role="user",
                parts=[ types.Part.from_bytes( data=audio_bytes, mime_type="audio/m4a"),
                        types.Part(text=f"Can you create phoneme transcription of this audio? Always return the phoneme transcription ONLY")
                        ]
                    )
                ],):
            transcription_phoneme += chunk.text
        
        return transcription_phoneme

if __name__ == "__main__":
    audio_creator = AudioCreator(
        api_key="sk-RFDhyyJpo0SBUcJdVW-0cIWaifqLeuyyVzsuqM9iqBT3BlbkFJTZRxrTgoeynyQHf4wg2BwW1m9Rhf5qlk2ZUF_P1EAA",
        character_profiles=json.load(open("story/story_850518.json", "r"))["characters"],
        gemini_api_key="AIzaSyBzWB6Jeslbzpby3263i4CufiJNdmbKsr4"
    )
    # asyncio.run(audio_creator.generate_speech_with_dialogue("{champion}", "Hello, how are you?"))
    from glob import glob
    from tqdm import tqdm
    paths = glob("story_recordings/user_admin/story_850518/mode_word/*.wav")
    for path in tqdm(paths, desc="Transcribing phoneme from audio"):
        transcription = audio_creator.transcribe_phoneme_from_audio(path)
        with open(path.replace(".wav", "_phoneme.txt"), "w") as f:
            f.write(transcription)