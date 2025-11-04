
let currentStoryState = {
    userId: null,
    storyId: null,
    storyMode: 'sentence',
    scene: null,
    dialogueId: 0,
    lastTurn: null,
    conversationHistory: [],
    totalDialogues: 0,
    targetWords: [],
    targetSounds: [],
    destination: null,
    audioGenerating: false,
    currentAudioTask: null,
    // 새로 추가: 현재 dialogue의 words_in_dialogue와 발음된 단어들 추적
    currentWordsInDialogue: [],
    pronouncedWords: [],
    // sentence 모드 target words 재시도 횟수
    retryCount: 0
};

// 즉시 전역화 (다른 스크립트에서 접근할 수 있도록)
window.currentStoryState = currentStoryState;
window.getCurrentStoryState = () => currentStoryState;
window.setCurrentStoryState = (newState) => {
    currentStoryState = newState;
    window.currentStoryState = currentStoryState; // 동기화
};
window.updateCurrentStoryState = (updates) => {
    Object.assign(currentStoryState, updates);
    window.currentStoryState = currentStoryState; // 동기화
};

// 사용자 데이터 저장/복원 헬퍼
const USER_DATA_KEY = 'rp_user_data';

let socket;

// Get current user data
function getCurrentUserData() {
    try {
        const userData = JSON.parse(localStorage.getItem(USER_DATA_KEY));
        return userData;
    } catch (e) {
        return null;
    }
}

// currentStoryState => localStorage User Data (minimal data only)
function saveStoryState() {
    try {
        const userData = getCurrentUserData();
        if (!userData) return;
        
        // Save only essential data to avoid localStorage quota issues
        const storySnapshot = {
            userId: currentStoryState.userId,
            storyId: currentStoryState.storyId,
            storyMode: currentStoryState.storyMode || 'sentence',
            sceneId: currentStoryState.scene?.id || null,
            dialogueId: currentStoryState.dialogueId,
            totalDialogues: currentStoryState.totalDialogues,
            destination: currentStoryState.destination || null,
            // Note: Removed large data like targetWords, targetSounds, conversationHistory, lastTurn
            // These will be loaded from server when needed
            currentWordsInDialogue: currentStoryState.currentWordsInDialogue || [],
            pronouncedWords: currentStoryState.pronouncedWords || []
        };
        
        userData.currentStory = storySnapshot;
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    } catch (e) {
        console.warn('Failed to save story state (localStorage quota exceeded):', e);
        // Continue without saving - data will be loaded from server
    }
}

// clear localStorage User Data
function clearSavedUserData() {
    try {
        localStorage.removeItem(USER_DATA_KEY);
    } catch (e) {
        console.warn('Failed to clear user data:', e);
    }
}

// Loading: Story Snapshot from localStorage => currentStoryState
function loadStorySnapshotFromStorage() {
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.userId || !userData.currentStory) return null;
        return userData.currentStory;
    } catch (_) {
        return null;
    }
}

// Applying: Story Snapshot from localStorage => currentStoryState (minimal data only)
function applyStorySnapshot(saved) {
    if (!saved) return;
    currentStoryState.userId = saved.userId;
    currentStoryState.storyId = saved.storyId;
    currentStoryState.storyMode = saved.storyMode || 'sentence';
    currentStoryState.scene = saved.sceneId ? { id: saved.sceneId } : currentStoryState.scene;
    currentStoryState.dialogueId = saved.dialogueId || 0;
    currentStoryState.totalDialogues = saved.totalDialogues || 0;
    currentStoryState.destination = saved.destination || null;
    
    // Only restore word practice state
    currentStoryState.currentWordsInDialogue = Array.isArray(saved.currentWordsInDialogue) ? saved.currentWordsInDialogue : [];
    currentStoryState.pronouncedWords = Array.isArray(saved.pronouncedWords) ? saved.pronouncedWords : [];
    
    // Large data will be loaded from server
    currentStoryState.targetWords = [];
    currentStoryState.targetSounds = [];
    currentStoryState.conversationHistory = [];
    currentStoryState.lastTurn = null;
}

// WebSocket 연결 초기화
function initializeWebSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('WebSocket Connected');
        requestStoryUpdate();
    });
    
    socket.on('disconnect', () => {
        console.log('WebSocket Disconnected');
    });
    
    socket.on('story_state_update', (data) => { // if frontend request_story_update, server will send story_state_update
        updateStoryStateFromServer(data);
    });
    
    socket.on('audio_status_update', (data) => {
        updateAudioStatus(data);
    });

    // WebSocket event handlers for audio playback
    // Handle dialogue audio ready
    socket.on('audio_ready', function(data) {
        console.log('Audio ready:', data);
        if (data.audio_url) {
            playAudioFromUrl(data.audio_url).catch(error => {
                console.error('Error playing dialogue audio:', error);
            });
        }
    });

    // Handle word pronunciation audio ready
    socket.on('word_audio_ready', function(data) {
        console.log('Word audio ready:', data);
        if (data.audio_url) {
            playAudioFromUrl(data.audio_url).catch(error => {
                console.error('Error playing word audio:', error);
            });
        }
    });

    // Handle exploration audio ready
    socket.on('exploration_audio_ready', function(data) {
        console.log('Exploration audio ready:', data);
        if (data.audio_url) {
            playAudioFromUrl(data.audio_url).catch(error => {
                console.error('Error playing exploration audio:', error);
            });
        }
    });

    // Handle user voice audio ready
    socket.on('user_voice_ready', function(data) {
        console.log('User voice ready:', data);
        if (data.audio_url) {
            playAudioFromUrl(data.audio_url).catch(error => {
                console.error('Error playing user voice audio:', error);
            });
        }
    });

    socket.on('error', (data) => {
        showNotification('Error: ' + data.message, 'error');
    });
}

// Update story state from server
function updateStoryStateFromServer(data) {
    if (!data) {
        console.log('updateStoryStateFromServer: data is null');
        return;
    }

    // Update story id
    if (data.story_id) {
        currentStoryState.storyId = data.story_id;
    }
    // Update scene information (if exists)
    if (data.current_scene) {
        currentStoryState.scene = data.current_scene;
    }
    // dialogue index is always updated from server
    if (typeof data.current_dialogue !== 'undefined') {
        currentStoryState.dialogueId = data.current_dialogue;
    }
    // Metadata/sounds/words
    if (data.story_info?.target_words) {
        currentStoryState.targetWords = data.story_info.target_words;
        window.updateWordList(currentStoryState.targetWords);
    }
    if (Array.isArray(data.story_info?.target_sounds)) {
        currentStoryState.targetSounds = data.story_info.target_sounds;
        const sounds = currentStoryState.targetSounds.map(extractSoundFromTheme).filter(Boolean);
        if (sounds.length) window.updateMultipleMouthImages(sounds);
    }
    // Audio status
    updateAudioStatus({
        audio_generating: data.story_info?.audio_generating || false,
        current_audio_task: data.story_info?.current_audio_task || null
    });

    updateButtonStates();
    saveStoryState();
}

// Request story state update to server
function requestStoryUpdate() {
    if (socket && socket.connected) {
        const userData = getCurrentUserData();
        if (userData && userData.currentStory) {
            socket.emit('request_story_update', {
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'sentence'
            });
        }
    }
}

// Update audio status
function updateAudioStatus(data) {
    currentStoryState.audioGenerating = data.audio_generating || false;
    currentStoryState.currentAudioTask = data.current_audio_task || null;

    if (data.audio_generating) {
        showAudioStatus(true, data.current_audio_task);
    } else {
        showAudioStatus(false);
    }
    saveStoryState();
}

// Audio status display
function showAudioStatus(isGenerating, character = null) {
    if (isGenerating) {
        const message = character ? 
            `🎵 ${character} voice is generating...` : 
            '🎵 voice is generating...';
        // console.log(message);
        // when audio is generating, disable next button and show status
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            // console.log('disable next button');
            nextBtn.disabled = true;
            nextBtn.innerHTML = '<span class="loading"></span> Generating audio...';
        }
    } else {
        const message = character ? 
            `🎵 ${character} voice generation completed!` : 
            '🎵 voice generation completed!';
        // console.log(message);

        updateButtonStates();
    }
}

// Client-side audio recording variables
let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;
let audioStream = null;
let speechRecognition = null;
let isSpeechRecognizing = false;
let speechRecognitionMode = 'single'; // 'continuous' or 'single'

// Initialize Web Speech API
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Web Speech API not supported in this browser');
        return null;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onstart = function() {
        console.log('🎤 Speech recognition started');
        isSpeechRecognizing = true;
        updateSpeechRecognitionUI(true);
        showNotification('🎤 Listening... Speak now!', 'info');
    };
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        console.log('Speech recognition result:', transcript, 'confidence:', confidence);
        
        // 결과를 입력창에 설정
        const userInput = document.getElementById('user-input');
        if (userInput) {
            userInput.value = transcript;
        }
        
        showNotification(`✅ Speech recognized: "${transcript}"`, 'success');
    };
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        isSpeechRecognizing = false;
        updateSpeechRecognitionUI(false);
        
        let errorMessage = 'Speech recognition error: ';
        switch(event.error) {
            case 'no-speech':
                errorMessage += 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage += 'Audio capture failed. Check microphone permissions.';
                break;
            case 'not-allowed':
                errorMessage += 'Microphone access denied. Please allow microphone access.';
                break;
            case 'network':
                errorMessage += 'Network error. Please check your connection.';
                break;
            case 'service-not-allowed':
                errorMessage += 'Speech service not allowed. Try using HTTPS.';
                break;
            default:
                errorMessage += event.error;
        }
        
        showNotification(errorMessage, 'error');
    };
    
    recognition.onend = function() {
        console.log('Speech recognition ended');
        isSpeechRecognizing = false;
        updateSpeechRecognitionUI(false);
    };
    
    return recognition;
}

// Update UI for speech recognition
function updateSpeechRecognitionUI(recognizing) {
    const voiceBtn = document.getElementById('voice-btn');
    if (!voiceBtn) return;
    
    if (recognizing) {
        voiceBtn.classList.add('recording');
        voiceBtn.innerHTML = '🔴';
        voiceBtn.style.background = '#dc3545';
        voiceBtn.title = 'Click to stop speech recognition';
    } else {
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '🎤';
        voiceBtn.style.background = '#28a745';
        voiceBtn.title = 'Click to start speech recognition';
    }
}

// Start/stop speech recognition
async function toggleSpeechRecognition() {
    if (isSpeechRecognizing && speechRecognition) {
        // Stop speech recognition
        speechRecognition.stop();
        return;
    } else {
        // Start speech recognition
        if (!speechRecognition) {
            speechRecognition = initSpeechRecognition();
        }
        
        if (speechRecognition) {
            try {
                speechRecognition.start();
            } catch (error) {
                console.error('Speech recognition start error:', error);
                showNotification('Failed to start speech recognition: ' + error.message, 'error');
            }
        } else {
            showNotification('Speech recognition not supported in this browser', 'error');
        }
    }
}

// Voice input start/stop toggle with Web Audio API
async function startVoiceInput() {
    try {
        const voiceBtn = document.getElementById('voice-btn');
        
        // Check if recording is supported before attempting
        const supportCheck = isRecordingSupported();
        if (!supportCheck.supported) {
            showNotification('Recording not supported: ' + supportCheck.reason, 'warning');
            return;
        }
        
        // Web Speech API를 우선 사용
        if (supportCheck.method === 'speech-recognition') {
            await toggleSpeechRecognition();
            return;
        }
        
        // 기존 MediaRecorder 로직 (HTTPS 환경)
        if (voiceBtn.classList.contains('recording')) {
            // Stop recording
            await stopClientRecording();
        } else {
            // Start recording
            await startClientRecording();
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        const voiceBtn = document.getElementById('voice-btn');
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '🎤';
        voiceBtn.style.background = '#28a745';
    }
}

// Initialize recording support check
function initializeRecordingSupport() {
    // Log browser and environment information for debugging
    console.log('🔍 Browser environment check:');
    console.log('- User Agent:', navigator.userAgent);
    console.log('- Protocol:', location.protocol);
    console.log('- Hostname:', location.hostname);
    console.log('- Secure Context:', window.isSecureContext);
    console.log('- navigator.mediaDevices:', !!navigator.mediaDevices);
    console.log('- MediaRecorder:', !!window.MediaRecorder);
    console.log('- Web Speech API:', !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    
    const supportCheck = isRecordingSupported();
    const voiceBtn = document.getElementById('voice-btn');
    
    if (!supportCheck.supported) {
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.title = 'Recording not supported: ' + supportCheck.reason;
            voiceBtn.style.opacity = '0.5';
            voiceBtn.innerHTML = '🎤❌';
        }
        
        console.warn('❌ Recording not supported:', supportCheck.reason);
        
        // Show helpful message based on the issue
        if (supportCheck.reason.includes('HTTPS')) {
            console.warn('💡 Tip: Recording requires HTTPS in production. For local development, use localhost or 127.0.0.1');
        } else if (supportCheck.reason.includes('MediaRecorder')) {
            console.warn('💡 Tip: Try updating your browser to a more recent version that supports MediaRecorder API');
        } else if (supportCheck.reason.includes('getUserMedia')) {
            console.warn('💡 Tip: Your browser may not support microphone access. Try using Chrome, Firefox, or Safari');
        }
        
        // Show user-friendly notification
        setTimeout(() => {
            showNotification('🎤 Voice recording not available in this environment. ' + supportCheck.reason, 'warning');
        }, 1000);
        
        } else {
            if (voiceBtn) {
                voiceBtn.disabled = false;
                voiceBtn.title = supportCheck.method === 'speech-recognition' ? 
                    'Click to start speech recognition (Web Speech API)' : 
                    'Click to start/stop recording';
                voiceBtn.style.opacity = '1';
            }
            
            console.log('✅ Voice input supported:', supportCheck.method);
            
            // Web Speech API 사용 시 사용자에게 알림
            if (supportCheck.method === 'speech-recognition') {
                setTimeout(() => {
                    showNotification('🎤 Using Web Speech API for voice recognition (HTTP compatible)', 'info');
                }, 1000);
            }
        console.log('✅ Recording supported - ready to use!');
    }
}

// Call initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure all elements are loaded
    setTimeout(initializeRecordingSupport, 100);
});

// Check if recording is supported
function isRecordingSupported() {
    // Check for Web Speech API first (HTTP 환경에서도 작동)
    if (window.webkitSpeechRecognition || window.SpeechRecognition) {
        return { 
            supported: true, 
            method: 'speech-recognition',
            reason: 'Web Speech API available (works in HTTP)'
        };
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext && location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        return { supported: false, reason: 'Recording requires HTTPS or Web Speech API' };
    }
    
    // Check for navigator
    if (!navigator) {
        return { supported: false, reason: 'navigator not available' };
    }
    
    // Check for navigator.mediaDevices (modern way)
    if (!navigator.mediaDevices) {
        // Try legacy getUserMedia as fallback
        const getUserMedia = navigator.getUserMedia || 
                           navigator.webkitGetUserMedia || 
                           navigator.mozGetUserMedia || 
                           navigator.msGetUserMedia;
        
        if (!getUserMedia) {
            return { supported: false, reason: 'getUserMedia not available in this browser' };
        }
        
        // Polyfill navigator.mediaDevices for older browsers
        if (!navigator.mediaDevices) {
            navigator.mediaDevices = {};
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
                return new Promise(function(resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            };
        }
    }
    
    // Check for getUserMedia
    if (!navigator.mediaDevices.getUserMedia) {
        return { supported: false, reason: 'getUserMedia not available' };
    }
    
    // Check for MediaRecorder
    if (!window.MediaRecorder) {
        return { supported: false, reason: 'MediaRecorder not available in this browser' };
    }
    
    return { supported: true, method: 'media-recorder' };
}

// Start client-side recording using Web Audio API
async function startClientRecording() {
    try {
        const voiceBtn = document.getElementById('voice-btn');
        
        // Check if recording is supported
        const supportCheck = isRecordingSupported();
        if (!supportCheck.supported) {
            throw new Error(supportCheck.reason);
        }
        
        // Request microphone access with better error handling
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
        } catch (getUserMediaError) {
            // Try with simpler constraints if the advanced ones fail
            console.warn('Advanced audio constraints failed, trying basic constraints:', getUserMediaError);
            audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true
            });
        }
        
        // Create MediaRecorder with better browser compatibility
        let options = {};
        
        // Test different MIME types in order of preference
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav'
        ];
        
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                options.mimeType = mimeType;
                break;
            }
        }
        
        // Add bitrate if supported
        if (options.mimeType && options.mimeType.includes('webm')) {
            options.audioBitsPerSecond = 128000;
        }
        
        mediaRecorder = new MediaRecorder(audioStream, options);
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            await processRecordedAudio();
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            showNotification('Recording error: ' + event.error, 'error');
        };
        
        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        
        // Update UI
        voiceBtn.classList.add('recording');
        voiceBtn.innerHTML = '⏹️';
        voiceBtn.style.background = '#dc3545';
        
                showNotification('🎤 Recording started! Click again to stop.', 'success');
        console.log('Recording started with MIME type:', options.mimeType || 'default');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        
        let errorMessage = 'Recording failed: ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Microphone access denied. Please allow microphone access and try again.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No microphone found. Please connect a microphone and try again.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Recording not supported in this browser.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Microphone is already in use by another application.';
            } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
        
        // Reset UI
        const voiceBtn = document.getElementById('voice-btn');
                voiceBtn.classList.remove('recording');
                voiceBtn.innerHTML = '🎤';
                voiceBtn.style.background = '#28a745';
            }
        }

// Stop client-side recording
async function stopClientRecording() {
    try {
        const voiceBtn = document.getElementById('voice-btn');
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        // Update UI
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '🎤';
        voiceBtn.style.background = '#28a745';
        
        showNotification('🎤 Processing recording...', 'info');
        
    } catch (error) {
        console.error('Error stopping recording:', error);
        showNotification('Error stopping recording: ' + error.message, 'error');
    }
}

// Process recorded audio and send to server
async function processRecordedAudio() {
    try {
        if (recordedChunks.length === 0) {
            showNotification('No audio recorded', 'warning');
            return;
        }
        
        // Create audio blob
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        
        // Play back the recorded audio (optional)
        await playRecordedAudio(audioBlob);
        
        // Send to server for transcription
        await uploadAndTranscribeAudio(audioBlob);
        
    } catch (error) {
        console.error('Error processing recorded audio:', error);
        showNotification('Error processing audio: ' + error.message, 'error');
    }
}

// Play back recorded audio
async function playRecordedAudio(audioBlob) {
    try {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        showNotification('🔊 Playing back recorded audio...', 'info');
        
        return new Promise((resolve, reject) => {
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
            };
            audio.onerror = (error) => {
                URL.revokeObjectURL(audioUrl);
                reject(error);
            };
            audio.play().catch(reject);
        });
        
    } catch (error) {
        console.error('Error playing audio:', error);
        showNotification('Error playing audio: ' + error.message, 'warning');
    }
}

// Upload audio to server and get transcription
async function uploadAndTranscribeAudio(audioBlob) {
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            showNotification('User data not found', 'error');
            return;
        }

        // Create form data
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('user_id', userData.userId);
        formData.append('story_id', userData.currentStory.storyId);
        formData.append('story_mode', userData.currentStory.storyMode || 'sentence');
        
        showNotification('🎤 Uploading and transcribing audio...', 'info');
        
        const response = await fetch('/api/story/audio/upload-and-transcribe', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.success && data.transcribed_text) {
            document.getElementById('user-input').value = data.transcribed_text;
            showNotification('🎤 Speech recognition completed!', 'success');
        } else {
            showNotification('Speech recognition error: ' + (data.error || 'Unknown error'), 'error');
        }
        
    } catch (error) {
        console.error('Error uploading audio:', error);
        showNotification('Error uploading audio: ' + error.message, 'error');
    }
}

// Legacy function - transcription is now handled in uploadAndTranscribeAudio
async function transcribeRecordedAudio() {
    showNotification('This function is deprecated. Recording and transcription are now handled automatically.', 'warning');
}

// Play audio from server-generated audio URL
async function playAudioFromUrl(audioUrl) {
    try {
        const audio = new Audio(audioUrl);
        
        showNotification('🔊 Playing audio...', 'info');
        
        return new Promise((resolve, reject) => {
            audio.onended = () => {
                showNotification('🔊 Audio playback completed', 'success');
                resolve();
                updateButtonStates();
            };
            audio.onerror = (error) => {
                showNotification('Error playing audio: ' + error.message, 'error');
                reject(error);
            };
            audio.play().catch(reject);
        });
        
    } catch (error) {
        console.error('Error playing audio:', error);
        showNotification('Error playing audio: ' + error.message, 'error');
    }
}

// Download audio file from server
async function downloadAudioFile(audioUrl, filename = 'audio.wav') {
    try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('📁 Audio file downloaded', 'success');
        
    } catch (error) {
        console.error('Error downloading audio:', error);
        showNotification('Error downloading audio: ' + error.message, 'error');
    }
}

// Show dialogue
function showDialogue(character, text) {
    document.getElementById('dialogue-character').textContent = character;
    
    // Convert target words to clickable buttons in the text
    const processedText = convertTargetWordsToButtons(text);
    const dialogueTextElement = document.getElementById('dialogue-text');
    dialogueTextElement.innerHTML = processedText;
    
    // Highlight words in sidebar that are present in this dialogue
    if (window.highlightWordsInDialogue) {
        window.highlightWordsInDialogue(text);
    }
    
    document.getElementById('dialogue-overlay').classList.add('show');
    currentStoryState.lastTurn = { type: 'character_dialogue', character: character, text: text };
    saveStoryState();
}

// Show user prompt
function showUserPrompt(prompt, text = null, words_in_dialogue = null, interaction = false) {
    document.getElementById('dialogue-character').textContent = 'Instruction';
    const dialogueTextElement = document.getElementById('dialogue-text');
    
    if (text && words_in_dialogue) {
        // Save current words_in_dialogue to the state and Initialize pronounced words
        currentStoryState.currentWordsInDialogue = [...words_in_dialogue];
        currentStoryState.pronouncedWords = [];
        
        // Convert target words to clickable buttons in the text
        const processedText = convertTargetWordsToButtons(text);
        dialogueTextElement.innerHTML = processedText;
        
        // Highlight words in sidebar that are present in this dialogue text and words_in_dialogue
        if (window.highlightWordsInDialogue) {
            // Combine text and words_in_dialogue for comprehensive highlighting
            const allWordsText = text + ' ' + words_in_dialogue.map(word => word.replace(/[{}]/g, '')).join(' ');
            window.highlightWordsInDialogue(allWordsText);
        }
        
        // Add words_in_dialogue as buttons on the top of the dialogue-text
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'words-in-dialogue-buttons';
        buttonContainer.style.marginBottom = '10px';
        
        words_in_dialogue.forEach(word => {
            const button = document.createElement('button');
            const cleanWord = word.replace(/[{}]/g, ''); // Remove braces
            button.textContent = cleanWord;
            button.className = 'word-choice-btn';
            button.dataset.word = word; // Add original word (with braces) to data attribute for later finding the button
            button.addEventListener('click', () => {
                document.getElementById('user-input').value = cleanWord; // Set clean word to input field
            });
            buttonContainer.appendChild(button);
        });
        
        dialogueTextElement.insertBefore(buttonContainer, dialogueTextElement.firstChild);
    } else { // If normal mode or words_in_dialogue is not in the dialogue, convert target words to clickable buttons in the prompt
        const processedPrompt = convertTargetWordsToButtons(prompt);
        dialogueTextElement.innerHTML = processedPrompt;
        
        // Highlight words in sidebar that are present in this prompt
        console.log('showUserPrompt: Calling highlightWordsInDialogue with prompt:', prompt);
        console.log('showUserPrompt: currentStoryState.targetWords:', currentStoryState.targetWords);
        if (window.highlightWordsInDialogue) {
            window.highlightWordsInDialogue(prompt);
        } else {
            console.log('showUserPrompt: highlightWordsInDialogue function not available');
        }
    }

    if (!interaction) {
        document.getElementById('dialogue-overlay').classList.add('show');
        document.getElementById('input-section').style.display = 'block';
    }
    if (currentStoryState.storyMode === 'word') { // Tip message for each mode.
        document.getElementById('tip-message-word').style.display = 'block';
    } else {
        document.getElementById('tip-message').style.display = 'block';
    }
    document.getElementById('tip-message-mouth').style.display = 'block';
}

// Convert target words in text to clickable buttons
function convertTargetWordsToButtons(text) {
    if (!text) return '';
    
    let result = text;
    const processedWords = new Set(); // Track words that have been converted to buttons
    // First, handle words wrapped in curly braces (from templates like {lizard})
    const targetWordRegex = /\{([^}]+)\}/g;
    result = result.replace(targetWordRegex, (match, word) => {
        const cleanWord = word.replace(/[{}]/g, '');
        const escapedWord = cleanWord.replace(/'/g, "\\'");
        processedWords.add(cleanWord.toLowerCase()); // Mark this word as processed
        return `<button class="target-word-btn" onclick="handleTargetWordClick('${escapedWord}')">${cleanWord}</button>`;
    });
    
    // Second, handle target words that appear as regular words (from LLM responses like "Lizard")
    if (currentStoryState.targetWords && currentStoryState.targetWords.length > 0) {
        // Split text into parts to avoid replacing inside HTML tags
        const parts = result.split(/(<[^>]*>)/);
        
        for (let i = 0; i < parts.length; i += 2) {
            // Only process text parts (not HTML tags)
            if (i < parts.length) {
                let textPart = parts[i];
                
                currentStoryState.targetWords.forEach(targetWord => {
                    const cleanTargetWord = targetWord.replace(/[{}]/g, '');
                    
                    // Skip if this word has already been processed
                    if (processedWords.has(cleanTargetWord.toLowerCase())) {
                        return;
                    }
                    
                    // Create case-insensitive regex for whole words
                    const wordRegex = new RegExp(`\\b${escapeRegExp(cleanTargetWord)}\\b`, 'gi');
                    
                    textPart = textPart.replace(wordRegex, (match) => {
                        const escapedWord = match.replace(/'/g, "\\'");
                        processedWords.add(match.toLowerCase()); // Mark this word as processed
                        return `<button class="target-word-btn" onclick="handleTargetWordClick('${escapedWord}')">${match}</button>`;
                    });
                });
                parts[i] = textPart;
            }
        }
        result = parts.join('');
    }
    console.log(result);
    return result;
}

// Fill blank with button for pronounced word
function fillBlankWithButton(word) {
    const dialogueTextElement = document.getElementById('dialogue-text');
    let currentHTML = dialogueTextElement.innerHTML;
    
    // Remove braces
    const cleanWord = word.replace(/[{}]/g, '');
    // Replace _____ pattern with button
    const blankRegex = /_{3,}/; // 3 or more consecutive underscores
    if (blankRegex.test(currentHTML)) {
        const escapedWord = cleanWord.replace(/'/g, "\\'");
        const buttonHTML = `<button class="target-word-btn filled-word-btn" onclick="handleTargetWordClick('${escapedWord}')">${cleanWord}</button>`;
        currentHTML = currentHTML.replace(blankRegex, buttonHTML);
        dialogueTextElement.innerHTML = currentHTML;
        return true; // Successfully replaced
    }
    return false; // No blank to replace
}

// Handle target word button click
function handleTargetWordClick(word) {
    // 1. Select corresponding mouth shape
    selectMouthShapeForWord(word);
    // 2. Move word to top of target words list
    moveWordToTopOfList(word);
    // 3. Pronounce the word
    window.pronounceWord(word);
}

// Clear dialogue
function clearDialogue() {
    document.getElementById('dialogue-overlay').classList.remove('show');
    document.getElementById('dialogue-character').textContent = '';
    document.getElementById('dialogue-text').innerHTML = '';
    document.getElementById('input-section').style.display = 'none';
    document.getElementById('tip-message').style.display = 'none';
    document.getElementById('tip-message-word').style.display = 'none';
    document.getElementById('tip-message-mouth').style.display = 'none';
    
    // Clear dialogue word highlights in sidebar
    if (window.clearDialogueWordHighlights) {
        window.clearDialogueWordHighlights();
    }
}

// Common function to process dialogue data from server
function processDialogueData(dialogueData, context = '') {
    // Reset retry count when moving to new dialogue
    currentStoryState.retryCount = 0;

    if (dialogueData.type === 'character_dialogue') {
        showDialogue(dialogueData.character, dialogueData.text);
        if (dialogueData.image) {
            updateImage(dialogueData.image);
        }
        if (dialogueData.audio_generating) {
            showAudioStatus(true, dialogueData.character);
        }

        saveStoryState();
        return true;
        
    } else if (dialogueData.type === 'user_turn') {
        // console.log('in processDialogueData, user turn');
        if (dialogueData.words_in_dialogue) {
            currentStoryState.lastTurn = { 
                type: 'user_turn', 
                text: dialogueData.text,
                words_in_dialogue: dialogueData.words_in_dialogue,
                prompt: dialogueData.prompt,
                original_dialogue_text: dialogueData.original_dialogue_text
            };
            console.log('DialogueData in processDialogueData, user turn:', dialogueData);
            showUserPrompt(dialogueData.prompt, dialogueData.text, dialogueData.words_in_dialogue);
            
            // Update image for word mode if available
            if (dialogueData.image) {
                console.log('Updating image for word mode:', dialogueData.image);
                updateImage(dialogueData.image);
            }
        }
        else if (dialogueData.interaction) {
            // console.log('in processDialogueData, user turn, interaction');
            currentStoryState.lastTurn = {
                type: 'user_turn',
                prompt: dialogueData.prompt,
                interaction: dialogueData.interaction,
                image: dialogueData.image || null,
                btn_words: dialogueData.btn_words || null,
                btn_image: dialogueData.btn_image || null
            };
            // console.log('currentStoryState in processDialogueData, interaction:', currentStoryState, context);
            // console.log('dialogueData in processDialogueData, interaction:', dialogueData);
            if (dialogueData.btn_words && dialogueData.btn_image) {
                setUpInteractionwithButtons(dialogueData.interaction, dialogueData.image, dialogueData.btn_words, dialogueData.btn_image);
                showUserPrompt(dialogueData.prompt, null, null, true);
                
                // Highlight words in sidebar for interaction mode
                if (window.highlightWordsInDialogue) {
                    window.highlightWordsInDialogue(dialogueData.prompt);
                }
            } else {
                // TODO: add other interaction types like shout, touch, etc.
            }
        }
        else {
            // console.log('currentStoryState in processDialogueData, else:', currentStoryState, 'context:', context);
            // console.log('dialogueData in processDialogueData, else:', dialogueData);
            currentStoryState.lastTurn = {
                type: 'user_turn',
                prompt: dialogueData.prompt
            };
            console.log('dialogueData in processDialogueData, else (sentence mode):', dialogueData);
            console.log('Calling showUserPrompt with prompt:', dialogueData.prompt);
            showUserPrompt(dialogueData.prompt);
            if (dialogueData.image) {
                console.log('dialogueData.image in processDialogueData:', dialogueData.image);
                updateImage(dialogueData.image);
            }
        }
        saveStoryState();
        return true;
        
    } else if (dialogueData.type === 'scene_complete') {
        showNotification('Current scene is completed!', 'info');
        document.getElementById('next-scene-btn').disabled = false;
        return false;
        
    } else if (dialogueData.type === 'error') {
        console.error(`ProcessDialogueData: Error in ${context}: ${dialogueData.message}`);
        return false;
    }
    return false;
}

// Proceed to next dialogue
async function nextDialogue() {
    // console.log('in nextDialogue');
    try {
        // 모든 인터랙션 버튼들 숨기기
        clearAllInteractionButtons();
        const nextBtn = document.getElementById('next-btn');
        nextBtn.disabled = true;
        nextBtn.innerHTML = '<span class="loading"></span> Next dialogue...';

        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            console.error('User data not found');
            return;
        }

        // Get next dialogue data such as type, prompt, text, etc. through server. 
        // Server incremented dialogue index in server side.
        const response = await fetch('/api/story/next-dialogue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'sentence'
            })
        });
        const data = await response.json();
        
        // Update dialogue index from server response
        if (typeof data.current_dialogue !== 'undefined') {
            currentStoryState.dialogueId = data.current_dialogue;
        }
        if (typeof data.total_dialogues !== 'undefined') {
            currentStoryState.totalDialogues = data.total_dialogues;
        }
        
        const processed = processDialogueData(data, 'nextDialogue');

        // showAudioStatus controll the activation of nextBtn; after audio generation completed, nextBtn is enabled through websocket
        // If audio generation is not in progress, restore button states

        // updateStatusBar();
        saveStoryState();
        if (!data.audio_generating) {
            updateButtonStates();
        }
    } catch (error) {
        console.error('Error in nextDialogue: ' + error.message);
        updateButtonStates();
    }
}

// When user input is submitted, also control to move to next dialogue
async function submitUserInput() {
    // Remove words_in_dialogue button
    function removeWordInDialogueButton(word) {
        const buttonContainer = document.querySelector('.words-in-dialogue-buttons');
        if (buttonContainer) {
            const buttons = buttonContainer.querySelectorAll('.word-choice-btn');
            buttons.forEach(button => {
                // The data attribute contains the original word with braces (but innerText is clean word)
                if (button.dataset.word === word) {
                    button.remove();
                }
            });
            // If all buttons are removed, remove the container
            if (buttonContainer.querySelectorAll('.word-choice-btn').length === 0) {
                buttonContainer.remove();
            }
        }
    }

    const userData = getCurrentUserData();
    if (!userData || !userData.currentStory) {
        console.error('User data not found');
        return;
    }

    const input = document.getElementById('user-input').value.trim();
    if (!input) {
        showNotification('Please enter your input.', 'error');
        return;
    }

    try {
        const submitBtn = document.querySelector('.input-area .btn-primary');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span> Processing...';
        
        // word mode logic for words_in_dialogue
        if (currentStoryState.storyMode === 'word' && currentStoryState.currentWordsInDialogue.length > 0) {
            // Check if the pronounced word is in words_in_dialogue
            const matchedWord = currentStoryState.currentWordsInDialogue.find(word => {
                const cleanWord = word.replace(/[{}]/g, ''); // Remove braces
                return cleanWord.toLowerCase() === input.toLowerCase();
            });
            
            if (matchedWord) {
                // Add pronounced word to the list
                currentStoryState.pronouncedWords.push(matchedWord);
                // Remove the corresponding words_in_dialogue button
                removeWordInDialogueButton(matchedWord);
                // Fill the blank with a button
                fillBlankWithButton(matchedWord);
                // Initialize the input field
                document.getElementById('user-input').value = '';
                
                // Check if all words are pronounced
                const allWordsPronounced = currentStoryState.currentWordsInDialogue.every(word => {
                    const cleanWord = word.replace(/[{}]/g, '').toLowerCase();
                    return currentStoryState.pronouncedWords.some(pronounced => {
                        const cleanPronounced = pronounced.replace(/[{}]/g, '').toLowerCase();
                        return cleanPronounced === cleanWord;
                    });
                });
                
                if (allWordsPronounced) { // If all words are pronounced, send to server and proceed to next dialogue
                    // Speak children's voice with the complete dialogue
                    const originalText = currentStoryState.lastTurn?.original_dialogue_text;
                    await processCompleteWordInput(originalText);
                } else { // If there are still words to pronounce, continue waiting
                    showNotification(`Great! Keep going with the remaining words.`, 'success');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Send';
                    return;
                }
            } else { // If the word is not in words_in_dialogue, provide audio feedback
                const retryCount = currentStoryState.wordModeRetryCount || 0;
                currentStoryState.wordModeRetryCount = retryCount + 1;
                
                // Generate audio feedback for word mode
                const availableWords = currentStoryState.currentWordsInDialogue.map(word => 
                    word.replace(/[{}]/g, '')
                );
                
                if (retryCount < 3) {
                    // Call audio feedback API for word mode
                    await generateWordModeAudioFeedback(availableWords, input, retryCount + 1);
                    showWordModeRetryNotification(availableWords, input);
                } else {
                    showNotification('Please pronounce one of the highlighted words.', 'warning');
                }
                
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Send';
                return;
            }
        } else { // If normal mode or words_in_dialogue is not in the dialogue, use the existing logic
            const retryCount = currentStoryState.retryCount || 0;
            await processRegularUserInput(input, retryCount);
            // If successfully processed, reset retry count
            currentStoryState.retryCount = 0;
        }
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send';
    } catch (error) {
        console.error('Error in submitUserInput: ' + error.message);
        const submitBtn = document.querySelector('.input-area .btn-primary');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send';
    }
}

// When all words are pronounced in word mode, process the input
async function processCompleteWordInput(originalText) {
    // Combine words with removed braces
    const cleanWords = currentStoryState.pronouncedWords.map(word => word.replace(/[{}]/g, ''));
    const allPronounced = cleanWords.join(' ');
    
    const userData = getCurrentUserData();
    if (!userData || !userData.currentStory) {
        console.error('User data not found');
        return;
    }

    // First, start children's voice generation if originalText is provided
    let childrenVoiceStarted = false;
    if (originalText) {
        try {
            showNotification('🎵 Speaking complete dialogue...', 'info');
            const response = await fetch('/api/story/speak-childrens-voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userData.userId,
                    story_id: userData.currentStory.storyId,
                    story_mode: userData.currentStory.storyMode || 'sentence',
                    dialogue_text: originalText
                })
            });
            const data = await response.json();
            if (data.success) {
                childrenVoiceStarted = true;
                showNotification('🎵 Complete dialogue is being spoken!', 'success');
            } else {
                console.error('Error in speakChildrensVoice: ' + data.message);
            }
        } catch (error) {
            console.error('Network error in speakChildrensVoice:', error);
        }
    }
    
    // If children's voice started, wait for it to complete before proceeding
    if (childrenVoiceStarted) {
        showNotification('⏳ Waiting for children\'s voice to complete...', 'info');
        await waitForAudioCompletion(); // Wait for audio generation to complete
    }
    
    // Now proceed with user input processing
    const response = await fetch('/api/story/user-input', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            user_id: userData.userId,
            story_id: userData.currentStory.storyId,
            story_mode: userData.currentStory.storyMode || 'sentence',
            input: allPronounced 
        })
    });

    const data = await response.json();
    
    if (data.success) {
        document.getElementById('input-section').style.display = 'none';
        document.getElementById('tip-message').style.display = 'none';
        document.getElementById('tip-message-word').style.display = 'none';
        document.getElementById('tip-message-mouth').style.display = 'none';
        
        // If next dialogue information exists, display automatically
        if (data.next_dialogue) {
            // Update dialogue index from server response
            if (typeof data.next_dialogue.current_dialogue !== 'undefined') {
                currentStoryState.dialogueId = data.next_dialogue.current_dialogue;
            }
            if (typeof data.next_dialogue.total_dialogues !== 'undefined') {
                currentStoryState.totalDialogues = data.next_dialogue.total_dialogues;
            }
            
            processDialogueData(data.next_dialogue, 'submitUserInput');
        }
        finalizeTurn(false);
        showNotification('All words completed! Moving to next dialogue.', 'success');
    } else {
        console.error('Error processing complete word input: ' + data.message);
    }
}

// Helper function to wait for audio generation to complete
async function waitForAudioCompletion() {
    return new Promise((resolve) => {
        let timeoutCount = 0;
        const maxTimeout = 60; // Maximum 30 seconds (60 * 500ms)
        
        const checkAudioStatus = () => {
            if (!currentStoryState.audioGenerating) {
                console.log('Audio generation completed, proceeding to next dialogue');
                resolve();
            } else if (timeoutCount >= maxTimeout) {
                console.warn('Audio generation timeout, proceeding anyway');
                showNotification('⚠️ Audio generation taking too long, proceeding...', 'warning');
                resolve();
            } else {
                timeoutCount++;
                setTimeout(checkAudioStatus, 500); // Check every 500ms
            }
        };
        checkAudioStatus();
    });
}

// Process regular user input
async function processRegularUserInput(input, retryCount = 0) {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            console.error('User data not found');
            return;
        }

        const response = await fetch('/api/story/user-input', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'sentence',
                input: input,
                retry_count: retryCount
            })
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('user-input').value = '';
            document.getElementById('input-section').style.display = 'none';
            document.getElementById('tip-message').style.display = 'none';
            document.getElementById('tip-message-word').style.display = 'none';
            document.getElementById('tip-message-mouth').style.display = 'none';
            
            // If next dialogue information exists, display automatically
            if (data.next_dialogue) {
                // Update dialogue index from server response
                if (typeof data.next_dialogue.current_dialogue !== 'undefined') {
                    currentStoryState.dialogueId = data.next_dialogue.current_dialogue;
                }
                if (typeof data.next_dialogue.total_dialogues !== 'undefined') {
                    currentStoryState.totalDialogues = data.next_dialogue.total_dialogues;
                }
                
                processDialogueData(data.next_dialogue, 'submitUserInput');
            }
            
        finalizeTurn(false);
            showNotification('User input processed successfully!', 'success');
        } else {
            // Handle retry request due to missing target words
            if (data.retry_required && data.missing_words) {
                const missingWordsText = data.missing_words.join(', ');
                
                // Update retry count from server response
                if (data.retry_count) {
                    currentStoryState.retryCount = data.retry_count;
                }
                
                // Check if we're approaching max retries
                const maxRetries = data.max_retries || 3;
                const isLastTry = data.retry_count >= maxRetries - 1;
                
                // Show enhanced notification with audio feedback info
                if (data.audio_feedback_started) {
                    let message = `🎵 Listen for instructions! Please include these words: ${missingWordsText}`;
                    if (isLastTry) {
                        message += ` (Last attempt - we'll continue after this)`;
                    }
                    showNotification(message, 'warning', isLastTry ? 7000 : 5000);
                    
                    // Show visual indicator for audio feedback
                    showAudioFeedbackIndicator(data.missing_words, isLastTry);
                } else {
                    let message = `Please include these target words in your response: ${missingWordsText}. Try again!`;
                    if (isLastTry) {
                        message += ` (Last attempt)`;
                    }
                    showNotification(message, 'warning');
                }
                
                // Re-enable input field and focus
                document.getElementById('input-section').style.display = 'block';
                document.getElementById('user-input').focus();
                
                // Highlight missing words in the prompt if possible
                highlightMissingWordsInPrompt(data.missing_words);
                
                return; // Don't proceed to next dialogue
            }
            
            console.error('Error in processRegularUserInput: ' + data.message);
    }
}

// Show visual indicator for audio feedback
function showAudioFeedbackIndicator(missingWords, isLastTry = false) {
    // Create or update audio feedback indicator
    let indicator = document.getElementById('audio-feedback-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'audio-feedback-indicator';
        indicator.className = 'audio-feedback-indicator';
        
        // Insert before the input section
        const inputSection = document.getElementById('input-section');
        inputSection.parentNode.insertBefore(indicator, inputSection);
    }
    
    const indicatorClass = isLastTry ? 'audio-feedback-indicator last-try' : 'audio-feedback-indicator';
    indicator.className = indicatorClass;
    
    indicator.innerHTML = `
        <div class="audio-indicator-content">
            <div class="audio-icon">🎵</div>
            <div class="audio-text">
                <span class="audio-status">${isLastTry ? 'Final attempt - Let\'s listen carefully!' : 'Let\'s try to say again 💪'}</span>
                ${isLastTry ? '<br><small>⚠️ We\'ll continue after this attempt</small>' : ''}
                <div class="missing-words-emphasis">
                    <strong>${missingWords.join(', ')}</strong>
                </div>
                
            </div>
        </div>
    `;
    indicator.style.display = 'block';
    
    // Add CSS animation
    indicator.classList.add('pulse-animation');
    
    // Remove the indicator after audio completes (listen for audio status updates)
    const removeIndicator = () => {
        if (indicator && !currentStoryState.audioGenerating) {
            setTimeout(() => {
                indicator.style.display = 'none';
                indicator.classList.remove('pulse-animation');
            }, 2000); // Keep for 2 seconds after audio completes
        }
    };
    
    // Check periodically if audio generation is complete
    const checkAudioStatus = setInterval(() => {
        if (!currentStoryState.audioGenerating) {
            removeIndicator();
            clearInterval(checkAudioStatus);
        }
    }, 500);
}

// Generate audio feedback for word mode
async function generateWordModeAudioFeedback(availableWords, userInput, retryCount) {
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            console.error('User data not found');
            return;
        }

        const response = await fetch('/api/story/word-mode-retry-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'word',
                available_words: availableWords,
                user_input: userInput,
                retry_count: retryCount
            })
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('Word mode audio feedback started');
        } else {
            console.error('Word mode audio feedback error:', data.message);
        }
    } catch (error) {
        console.error('Error generating word mode audio feedback:', error);
    }
}

// Show word mode retry notification with listen back button
function showWordModeRetryNotification(availableWords, userInput) {
    const notificationContainer = document.getElementById('notification-container') || createNotificationContainer();
    
    // Remove existing notifications
    notificationContainer.innerHTML = '';
    
    const notification = document.createElement('div');
    notification.className = 'notification warning word-mode-retry';
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-message">
                🎵 Listen for instructions! Try saying one of these words: <strong>${availableWords.join(', ')}</strong>
            </div>
            <div class="notification-actions">
                <button class="listen-back-btn" onclick="playListenBack()">
                    🔊 Listen Back (What I said: "${userInput}")
                </button>
            </div>
        </div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 8000);
}

// Create notification container if it doesn't exist
function createNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    return container;
}

// Play listen back audio
async function playListenBack() {
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            console.error('User data not found');
            showNotification('❌ User data not found', 'error');
            return;
        }

        const response = await fetch('/api/story/listen-back', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'word'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('Listen back audio played successfully');
            showNotification('🔊 Playing back what you said...', 'info', 2000);
        } else {
            console.error('Listen back error:', data.message);
            showNotification(`❌ Listen back failed: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error playing listen back audio:', error);
        showNotification('❌ Failed to play listen back audio', 'error');
    }
}

// Highlight missing words in the current prompt
function highlightMissingWordsInPrompt(missingWords) {
    const promptElement = document.querySelector('.current-prompt, .dialogue-prompt');
    if (!promptElement) return;
    
    let promptText = promptElement.innerHTML;
    
    // Highlight each missing word
    missingWords.forEach(word => {
        // Create regex to find the word within curly braces
        const regex = new RegExp(`\\{${word}\\}`, 'gi');
        promptText = promptText.replace(regex, `<span class="missing-word-highlight">{${word}}</span>`);
    });
    
    promptElement.innerHTML = promptText;
    
    // Remove highlighting after some time
    setTimeout(() => {
        const highlightedElements = promptElement.querySelectorAll('.missing-word-highlight');
        highlightedElements.forEach(element => {
            element.classList.remove('missing-word-highlight');
        });
    }, 8000); // Remove after 8 seconds
}

// Move to next scene
async function nextScene() {
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            console.error('User data not found');
            return;
        }

        const nextSceneBtn = document.getElementById('next-scene-btn');
        nextSceneBtn.disabled = true;
        nextSceneBtn.innerHTML = '<span class="loading"></span> Moving to next scene...';
        
        const response = await fetch('/api/story/next-scene', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'sentence'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            if (data.message.includes('completed')) { // story completed
                showNotification('🎉 Story completed!', 'success');
                document.getElementById('next-scene-btn').disabled = true;
                document.getElementById('next-btn').disabled = true;
            } else { // move to next scene
                // Update scene information from server - dialogue is set to 0 by server
                currentStoryState.scene = data.current_scene;
                currentStoryState.totalDialogues = data.current_scene.dialogue_templates.length;
                // currentStoryState.dialogue is updated by server state synchronization
                clearDialogue();
                document.getElementById('next-btn').disabled = false;
                document.getElementById('input-section').style.display = 'none';
                document.getElementById('tip-message').style.display = 'none';
                document.getElementById('tip-message-word').style.display = 'none';
                document.getElementById('tip-message-mouth').style.display = 'none';
                document.getElementById('next-scene-btn').innerHTML = '🎬 Next scene';
                showNotification('Moved to next scene!', 'success');
                
                // Request server state synchronization
                requestStoryUpdate();
            }
            // updateStatusBar();
            saveStoryState();
        } else {
            console.error('Error: ' + data.message);
            nextSceneBtn.disabled = false;
            nextSceneBtn.innerHTML = '🎬 Next scene';
        }
    } catch (error) {
        console.error('Error: ' + error.message);
        const nextSceneBtn = document.getElementById('next-scene-btn');
        nextSceneBtn.disabled = false;
        nextSceneBtn.innerHTML = '🎬 Next scene';
    }
}

// Check if user is logged in
function checkUserLogin() {
    const userData = getCurrentUserData();
    if (!userData || !userData.userId) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

// Add logout function
async function logout() {
    try {
        const userData = getCurrentUserData();
        if (userData) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userData.userId
                })
            });
        }
        
        // Clear localStorage
        localStorage.removeItem('rp_user_data');
        
        // Redirect to login
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        // Still clear localStorage and redirect
        localStorage.removeItem('rp_user_data');
        window.location.href = '/login';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    // 1) Check if user is logged in
    if (!checkUserLogin()) return;
    
    // Show user info with logout button
    const userData = getCurrentUserData();
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; z-index: 1000; font-size: 14px; backdrop-filter: blur(10px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);';
    userInfo.innerHTML = `<span>👤 ${userData.userId}</span> | <button onclick="logout()" style="background: #dc3545; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">Logout</button>`;
    document.body.appendChild(userInfo);
    
    // 2) 저장된 스토리 스냅샷을 로드하여 메모리 상태에 적용
    const saved = loadStorySnapshotFromStorage();
    console.log('saved story in DOMContentLoaded:', saved);
    if (saved) applyStorySnapshot(saved);

    // 3) 서버 상태 동기화
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.userId || !userData.currentStory || !userData.currentStory.storyId) {
            try { clearSavedUserData(); } catch (e) { /* ignore */ }
            // redirectToStartWithOverlay('No user data or story found. Redirecting to start page...');
            return;
        }
        
        const storyMode = userData.currentStory.storyMode || 'sentence';
        const url = `/api/story/state?user_id=${encodeURIComponent(userData.userId)}&story_id=${encodeURIComponent(userData.currentStory.storyId)}&story_mode=${encodeURIComponent(storyMode)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
            try { clearSavedUserData(); } catch (e) { /* ignore */ }
            // updateStatusBar();
            initializeWebSocket();
            redirectToStartWithOverlay('No ongoing story found. Redirecting to start page...');
            return;
        }

        // 서버 상태를 우선 적용
        currentStoryState.userId = data.user_id;
        currentStoryState.storyId = data.story_id;
        currentStoryState.scene = data.story_info?.current_scene;
        currentStoryState.dialogueId = data.story_info?.current_dialogue || 0;
        currentStoryState.totalDialogues = data.story_info?.total_dialogues_in_scene || 0;
        currentStoryState.storyMode = data.story_info?.story_mode || currentStoryState.storyMode;        
        currentStoryState.targetWords = data.story_info?.target_words || [];
        currentStoryState.targetSounds = data.story_info?.target_sounds || [];
        currentStoryState.lastTurn = data.story_info?.current_turn || null;
        currentStoryState.selectedDestination = data.story_info?.selected_destination || null;

        // 오디오 상태
        updateAudioStatus({ audio_generating: data.audio_generating, current_audio_task: data.current_audio_task });
        console.log('data in DOMContentLoaded:', data);
        // 3) 현재 턴(UI)을 processDialogueData로 복구 (interaction 포함)
        // 서버에서 관리되는 current_turn 우선 사용, 없으면 기존 turn 필드 사용
        const turnData = currentStoryState.lastTurn;
        if (turnData) {
            const turnPayload = { ...turnData };
            // 서버가 interaction용 리소스를 주는 경우 포함
            if (turnData.type === 'user_turn') {
                if (data.image) turnPayload.image = data.image;
                if (data.btn_words) turnPayload.btn_words = data.btn_words;
                if (data.btn_image) turnPayload.btn_image = data.btn_image;
            }
            console.log('turnPayload in DOMContentLoaded:', turnPayload);
            // 복구 시에는 카운터 증가 금지
            processDialogueData(turnPayload, 'restore');
        } else if (data.image) {
            updateImage(data.image);
        }

        // 사이드바/버튼/상태 업데이트
        if (currentStoryState.targetWords.length) window.updateWordList(currentStoryState.targetWords);
        const sounds = (currentStoryState.targetSounds || []).map(extractSoundFromTheme).filter(Boolean);
        if (sounds.length) window.updateMultipleMouthImages(sounds);
        updateButtonStates();
        // updateStatusBar();
        saveStoryState();

        // 소켓 초기화 및 필요 시 자동 진행
        initializeWebSocket();
        // 새로고침이 아닌 경우에만 자동 진행 (turn이 없고 dialogue가 0인 경우는 새로운 스토리 시작)
        // if (currentStoryState.dialogue === 0 && !data.turn) {
        //     setTimeout(() => { nextDialogue(); }, 500);
        // }
    } catch (error) {
        console.error('Error while restoring story state (DOMContentLoaded):', error);
        try { clearSavedUserData(); } catch (e) { /* ignore */ }
        // redirectToStartWithOverlay('Error while restoring story state. Redirecting to start page...');
    }
});

// Assign globalfunctions to window object (for HTML onclick access)
window.nextDialogue = nextDialogue;
window.processDialogueData = processDialogueData;
window.handleTargetWordClick = handleTargetWordClick;
window.nextScene = nextScene;
window.logout = logout;
window.submitUserInput = submitUserInput;
window.startVoiceInput = startVoiceInput;
window.getCurrentUserData = getCurrentUserData;
window.saveStoryState = saveStoryState;
window.playListenBack = playListenBack;
