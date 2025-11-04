// Sidebar and mouth-shape related utilities

// 사이드바 토글 기능
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
        toggleBtn.textContent = '◀';
    } else {
        toggleBtn.textContent = '▶';
    }
}

// 입 모양 사이드바 토글 기능
function toggleMouthSidebar() {
    const mouthSidebar = document.querySelector('.mouth-sidebar');
    const toggleBtn = document.querySelector('.mouth-sidebar-toggle');
    mouthSidebar.classList.toggle('collapsed');
    if (mouthSidebar.classList.contains('collapsed')) {
        toggleBtn.textContent = '◀';
    } else {
        toggleBtn.textContent = '▶';
    }
}

// 공통 토글 함수
function toggleCollapsibleSidebar(button) {
    const container = button.closest('.sidebar, .mouth-sidebar');
    container.classList.toggle('collapsed');
    button.textContent = container.classList.contains('collapsed') ? '◀' : '▶';
}

// 소리와 입 모양 이미지 매칭 함수
function getMouthImageForSound(sound) {
    const soundToImageMap = {
        'h': '/mouth_img/h.png',
        'j': '/mouth_img/j.png',
        'l': '/mouth_img/l.png',
        'k': '/mouth_img/k.png',
        'f': '/mouth_img/f_tmp.png',
        'g': '/mouth_img/g.png',
        'sh': '/mouth_img/sh.png',
        'ay': '/mouth_img/ay.png',
        'n': '/mouth_img/n.png',
        'm': '/mouth_img/m.png',
        'b': '/mouth_img/b.png',
        'p': '/mouth_img/p.png',
        's': '/mouth_img/s.png',
        'z': '/mouth_img/z.png',
        'th': '/mouth_img/th.png',
        'w': '/mouth_img/w.png',
        'ai': '/mouth_img/ai.png',
        'r': '/mouth_img/r_updated.png',
        'v': '/mouth_img/v.png',
        'ah': '/mouth_img/ah.png',
        'e': '/mouth_img/e.png',
        'oh': '/mouth_img/oh.png',
        't': '/mouth_img/t.png',
        'd': '/mouth_img/d.png',
        'ch': 'mouth_img/sh.png',
        'ph': 'mouth_img/p.png',
        'wh': 'mouth_img/w.png',
        'bl': 'mouth_img/b.png',
        'cl': 'mouth_img/k.png',
        'fl': 'mouth_img/f_tmp.png',
        'gl': 'mouth_img/g.png',
        'pl': 'mouth_img/p.png',
        'sl': 'mouth_img/s.png',
        'br': 'mouth_img/b.png',
        'cr': 'mouth_img/k.png',
        'dr': 'mouth_img/d.png',
        'fr': 'mouth_img/f_tmp.png',
        'gr': 'mouth_img/g.png',
        'pr': 'mouth_img/p.png',
        'tr': 'mouth_img/t.png',
        'st': 'mouth_img/s.png',
        'sp': 'mouth_img/s.png',
        'sw': 'mouth_img/s.png',
        'sm': 'mouth_img/s.png',
        'sn': 'mouth_img/s.png',
        'sc': 'mouth_img/s.png',
        'sk': 'mouth_img/k.png'
    };
    if (soundToImageMap[sound.toLowerCase()]) {
        return soundToImageMap[sound.toLowerCase()];
    }
    return null;
}

// 여러 입 모양 이미지 업데이트 함수
function updateMultipleMouthImages(sounds) {
    const mouthImagesGrid = document.getElementById('mouthImagesGrid');
    const soundInfo = document.getElementById('soundInfo');
    mouthImagesGrid.innerHTML = '';
    if (sounds && sounds.length > 0) {
        sounds.forEach((sound, index) => {
            const imagePath = getMouthImageForSound(sound);
            if (imagePath) {
                const imageItem = document.createElement('div');
                imageItem.className = 'mouth-image-item';
                imageItem.onclick = () => selectMouthImage(sound, index);
                const img = document.createElement('img');
                img.src = imagePath;
                img.alt = `${sound} mouth shape`;
                const label = document.createElement('div');
                label.className = 'mouth-image-label';
                label.textContent = sound.toUpperCase();
                imageItem.appendChild(img);
                imageItem.appendChild(label);
                mouthImagesGrid.appendChild(imageItem);
            }
        });
        if (sounds.length > 0) {
            updateSoundInfo(sounds[0]);
            const firstItem = mouthImagesGrid.querySelector('.mouth-image-item');
            if (firstItem) {
                firstItem.classList.add('active');
            }
        }
        soundInfo.innerHTML = `
            <h4>🎯 Multiple Target Sounds</h4>
            <p><strong>Total Sounds:</strong> ${sounds.length}</p>
            <p><strong>Sounds:</strong> ${sounds.map(s => s.toUpperCase()).join(', ')}</p>
            <p>Click on any mouth image to see detailed information</p>
        `;
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'mouth-placeholder';
        placeholder.textContent = 'No target sounds available';
        mouthImagesGrid.appendChild(placeholder);
        soundInfo.innerHTML = '';
    }
}

// 입 모양 선택
function selectMouthImage(sound, index) {
    const allItems = document.querySelectorAll('.mouth-image-item');
    allItems.forEach(item => item.classList.remove('active'));
    const selectedItem = document.querySelectorAll('.mouth-image-item')[index];
    if (selectedItem) {
        selectedItem.classList.add('active');
        updateSoundInfo(sound);
    }
}

// 소리 정보 업데이트
function updateSoundInfo(sound) {
    const soundInfo = document.getElementById('soundInfo');
    const soundDescription = getSoundDescription(sound);
    if (!soundDescription) {
        soundInfo.innerHTML = '';
        return;
    }
    soundInfo.innerHTML = `
        <h4>🎯 ${sound.toUpperCase()}</h4>
        <div class="sound-description-section">
            <div class="sound-section-header">
                <span class="sound-section-icon">📝</span>
                <span class="sound-section-title">How to make this sound</span>
                <button class="sound-speaker-btn" onclick="playSoundDescription('${sound}')" title="Play description">🔊</button>
            </div>
            <p class="sound-section-content">${soundDescription.description}</p>
        </div>
        <div class="sound-gesture-section">
            <div class="sound-section-header">
                <span class="sound-section-icon">✋</span>
                <span class="sound-section-title">Hand gesture tip</span>
                <button class="sound-speaker-btn" onclick="playSoundGesture('${sound}')" title="Play gesture">🔊</button>
            </div>
            <p class="sound-section-content">${soundDescription.gesture}</p>
        </div>
    `;
}

function getSoundDescription(sound) {
    const descriptions = {
        'h': { type: 'Fricative', description: 'Breathe out gently through your mouth.', gesture: 'Put your hand in front of your lips and feel the warm air.' },
        'j': { type: 'Approximant', description: 'Lift your tongue close to the roof of your mouth and slide the sound out.', gesture: 'Smile a little as if starting “yes.”' },
        'l': { type: 'Lateral Approximant', description: 'Touch the tip of your tongue just behind your top teeth and let the air flow around the sides.', gesture: 'Point to your top teeth with your finger.' },
        'k': { type: 'Plosive', description: 'Press the back of your tongue against the roof of your mouth, then let the air pop out.', gesture: 'Cover your mouth with your hand to feel the small burst.' },
        'g': { type: 'Plosive', description: 'Do the same as /k/, but turn on your voice.', gesture: 'Put your hand on your throat and feel it buzz.' },
        'sh': { type: 'Fricative', description: 'Put your tongue close to the roof of your mouth and blow air, like telling someone “shhh.”', gesture: 'Hold a finger to your lips.' },
        'th': { type: 'Fricative', description: 'Place your tongue gently between your teeth and blow air out. Gesture: Point to your teeth with your finger.' },
        'ch': { type: 'Affricate', description: 'Start with your tongue blocking the air, then let it go with a quick “ch.”', gesture: 'Clap your hands once to show the quick burst.' },
        'r': { type: 'Approximant', description: 'Curl your tongue a little back in your mouth and use your voice.', gesture: 'Put your hand on your throat to feel the buzz.' },
        's': { type: 'Fricative', description: 'Put your tongue close behind your top teeth and blow air like a hiss.', gesture: 'Move your hand like a snake sliding.' },
        'z': { type: 'Fricative', description: 'Do the same as /s/, but turn on your voice.', gesture: 'Put your hand on your throat to feel the buzz while hissing.' }
    };
    return descriptions[sound];
}

// 단일 입 모양 이미지 업데이트
function updateSingleMouthImage(sound) {
    const mouthImagesGrid = document.getElementById('mouthImagesGrid');
    const soundInfo = document.getElementById('soundInfo');
    mouthImagesGrid.innerHTML = '';
    const imagePath = getMouthImageForSound(sound);
    if (imagePath) {
        const imageItem = document.createElement('div');
        imageItem.className = 'mouth-image-item active';
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = `${sound} mouth shape`;
        const label = document.createElement('div');
        label.className = 'mouth-image-label';
        label.textContent = sound.toUpperCase();
        imageItem.appendChild(img);
        imageItem.appendChild(label);
        mouthImagesGrid.appendChild(imageItem);
        updateSoundInfo(sound);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'mouth-placeholder';
        placeholder.textContent = `No mouth shape for: ${sound}`;
        mouthImagesGrid.appendChild(placeholder);
        soundInfo.innerHTML = '';
    }
}

// 단어에서 첫 번째 소리 추출
function extractFirstSound(word) {
    const word_lower = word.toLowerCase();
    const compoundSounds = ['ch', 'sh', 'th', 'ph', 'wh', 'bl', 'cl', 'fl', 'gl', 'pl', 'sl', 'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'st', 'sp', 'sw', 'sm', 'sn', 'sc', 'sk'];
    for (let sound of compoundSounds) {
        if (word_lower.startsWith(sound)) {
            return sound;
        }
    }
    return word_lower.charAt(0);
}

// 반복재생 상태 관리
let repeatPlaybackState = {};

// 단어 발음 (sidebar용 - 반복재생)
function pronounceWordRepeat(word) {
    const cleanWord = word.replace(/[{}]/g, '');
    const firstSound = extractFirstSound(cleanWord);
    
    // 반복재생 토글 처리
    if (repeatPlaybackState[cleanWord]) {
        // 이미 반복재생 중이면 중지
        stopRepeatPlayback(cleanWord);
        return;
    }
    
    if (firstSound) {
        // 현재 mouth grid의 라벨을 기준으로 인덱스 계산 (상태 의존 제거)
        const labels = Array.from(document.querySelectorAll('.mouth-image-item .mouth-image-label'));
        const sounds = labels.map(el => (el.textContent || '').toLowerCase());
        const soundIndex = sounds.findIndex(s => s === firstSound.toLowerCase());
        if (soundIndex !== -1) {
            const allItems = document.querySelectorAll('.mouth-image-item');
            allItems.forEach(item => item.classList.remove('active'));
            const targetItem = allItems[soundIndex];
            if (targetItem) {
                targetItem.classList.add('active');
                updateSoundInfo(sounds[soundIndex]);
            }
        }
    }
    
    // Highlight the word in sidebar when clicked from sidebar
    if (window.highlightWordInSidebar) {
        window.highlightWordInSidebar(cleanWord);
    }
    
    // 반복재생 시작
    startRepeatPlayback(cleanWord);
}

// 단어 발음 (dialogue용 - 단순 재생)
function pronounceWord(word) {
    const cleanWord = word.replace(/[{}]/g, '');
    const firstSound = extractFirstSound(cleanWord);
    
    if (firstSound) {
        // 현재 mouth grid의 라벨을 기준으로 인덱스 계산 (상태 의존 제거)
        const labels = Array.from(document.querySelectorAll('.mouth-image-item .mouth-image-label'));
        const sounds = labels.map(el => (el.textContent || '').toLowerCase());
        const soundIndex = sounds.findIndex(s => s === firstSound.toLowerCase());
        if (soundIndex !== -1) {
            const allItems = document.querySelectorAll('.mouth-image-item');
            allItems.forEach(item => item.classList.remove('active'));
            const targetItem = allItems[soundIndex];
            if (targetItem) {
                targetItem.classList.add('active');
                updateSoundInfo(sounds[soundIndex]);
            }
        }
    }
    
    // Highlight the word in sidebar when clicked from sidebar
    if (window.highlightWordInSidebar) {
        window.highlightWordInSidebar(cleanWord);
    }
    
    // 단순 재생 (한 번만)
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanWord);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        const wordElement = event && event.target ? event.target : null;
        if (wordElement) {
            wordElement.classList.add('playing');
        }
        utterance.onend = () => {
            if (wordElement) wordElement.classList.remove('playing');
        };
        utterance.onerror = (error) => {
            if (wordElement) wordElement.classList.remove('playing');
            if (window.showNotification) {
                window.showNotification('Error in pronounceWord: ' + error, 'error');
            }
        };
        speechSynthesis.speak(utterance);
    } else {
        if (window.showNotification) {
            window.showNotification('Browser does not support voice playback.', 'warning');
        }
        fetch('/api/pronounce-word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: cleanWord, target_sound: firstSound })
        }).catch(() => {});
    }
}

// 단어 발음 연습 (녹음 팝업 사용)
async function practiceWordPronunciation(word) {
    const cleanWord = word.replace(/[{}]/g, '');
    const firstSound = extractFirstSound(cleanWord);
    
    if (firstSound) {
        // 현재 mouth grid의 라벨을 기준으로 인덱스 계산
        const labels = Array.from(document.querySelectorAll('.mouth-image-item .mouth-image-label'));
        const sounds = labels.map(el => (el.textContent || '').toLowerCase());
        const soundIndex = sounds.findIndex(s => s === firstSound.toLowerCase());
        if (soundIndex !== -1) {
            const allItems = document.querySelectorAll('.mouth-image-item');
            allItems.forEach(item => item.classList.remove('active'));
            const targetItem = allItems[soundIndex];
            if (targetItem) {
                targetItem.classList.add('active');
                updateSoundInfo(sounds[soundIndex]);
            }
        }
    }
    
    // Highlight the word in sidebar
    if (window.highlightWordInSidebar) {
        window.highlightWordInSidebar(cleanWord);
    }
    
    try {
        // interaction.js의 pronounceSentenceWithUserInput 함수를 사용
        if (window.pronounceSentenceWithUserInput) {
            // Store the target word globally for recording
            window.currentPracticeWord = cleanWord;
            // Call with sidebar practice flag
            await window.pronounceSentenceWithUserInput(cleanWord, true);
        } else {
            if (window.showNotification) {
                window.showNotification('Pronunciation practice function not available', 'error');
            }
        }
    } catch (error) {
        console.warn('Practice pronunciation failed:', error);
        if (window.showNotification) {
            window.showNotification('Practice pronunciation failed: ' + error.message, 'error');
        }
    }
}

// 반복재생 시작
function startRepeatPlayback(word) {
    const wordElement = findWordElement(word);
    
    if (!('speechSynthesis' in window)) {
        if (window.showNotification) {
            window.showNotification('Browser does not support voice playback.', 'warning');
        }
        return;
    }
    
    // 반복재생 상태 설정
    repeatPlaybackState[word] = {
        isPlaying: true,
        intervalId: null,
        element: wordElement
    };
    
    // 단어 요소에 반복재생 중임을 표시
    if (wordElement) {
        wordElement.classList.add('playing');
        wordElement.title = 'Click to stop repeat playback';
    }
    
    // 첫 번째 재생
    playWordOnce(word, () => {
        // 첫 번째 재생 완료 후 반복 시작 (2초 간격)
        if (repeatPlaybackState[word] && repeatPlaybackState[word].isPlaying) {
            repeatPlaybackState[word].intervalId = setInterval(() => {
                if (repeatPlaybackState[word] && repeatPlaybackState[word].isPlaying) {
                    playWordOnce(word);
                } else {
                    stopRepeatPlayback(word);
                }
            }, 2000); // 2초 간격으로 반복
        }
    });
}

// 단어 한 번 재생
function playWordOnce(word, callback) {
    if (!repeatPlaybackState[word] || !repeatPlaybackState[word].isPlaying) {
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    
    const wordElement = repeatPlaybackState[word].element;
    if (wordElement) {
        wordElement.classList.add('playing');
    }
    
    utterance.onend = () => {
        if (wordElement) {
            wordElement.classList.remove('playing');
        }
        if (callback) callback();
    };
    
    utterance.onerror = (error) => {
        if (wordElement) {
            wordElement.classList.remove('playing');
        }
        if (window.showNotification) {
            window.showNotification('Error in pronounceWord: ' + error, 'error');
        }
        stopRepeatPlayback(word);
    };
    
    speechSynthesis.speak(utterance);
}

// 반복재생 중지
function stopRepeatPlayback(word) {
    if (repeatPlaybackState[word]) {
        // 타이머 중지
        if (repeatPlaybackState[word].intervalId) {
            clearInterval(repeatPlaybackState[word].intervalId);
        }
        
        // 요소 스타일 복원
        const wordElement = repeatPlaybackState[word].element;
        if (wordElement) {
            wordElement.classList.remove('playing');
            wordElement.title = 'Repeat pronunciation';
        }
        
        // 상태 삭제
        delete repeatPlaybackState[word];
    }
    
    // 현재 재생 중인 음성 중지
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
}

// 단어 요소 찾기 (반복재생 버튼 반환)
function findWordElement(word) {
    const wordItems = document.querySelectorAll('.word-item');
    for (let item of wordItems) {
        const wordText = item.querySelector('.word-text');
        if (wordText && wordText.textContent.trim().toLowerCase() === word.toLowerCase()) {
            return item.querySelector('.word-repeat-btn');
        }
    }
    return null;
}

// 단어 목록 업데이트
function updateWordList(targetWords) {
    const wordList = document.getElementById('wordList');
    const wordCount = document.getElementById('wordCount');
    wordList.innerHTML = '';
    if (targetWords && targetWords.length > 0) {
        wordCount.textContent = `${targetWords.length} words`;
        targetWords.forEach(word => {
            const li = document.createElement('li');
            li.className = 'word-item';
            
            // 단어 텍스트 컨테이너
            const wordText = document.createElement('span');
            wordText.className = 'word-text';
            wordText.textContent = word.replace(/[{}]/g, '');
            
            // 버튼 컨테이너
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'word-buttons';
            
            // 반복재생 버튼 🔊
            const repeatBtn = document.createElement('button');
            repeatBtn.className = 'word-repeat-btn';
            repeatBtn.innerHTML = '🔊';
            repeatBtn.title = 'Repeat pronunciation';
            repeatBtn.onclick = (e) => {
                e.stopPropagation();
                pronounceWordRepeat(word);
            };
            
            // 녹음 버튼 🎤
            const recordBtn = document.createElement('button');
            recordBtn.className = 'word-record-btn';
            recordBtn.innerHTML = '🎤';
            recordBtn.title = 'Practice pronunciation';
            recordBtn.onclick = (e) => {
                e.stopPropagation();
                practiceWordPronunciation(word);
            };
            
            buttonContainer.appendChild(repeatBtn);
            buttonContainer.appendChild(recordBtn);
            
            li.appendChild(wordText);
            li.appendChild(buttonContainer);
            wordList.appendChild(li);
        });
    } else {
        wordCount.textContent = '0 words';
        const li = document.createElement('li');
        li.className = 'word-item';
        li.textContent = 'No words';
        li.style.opacity = '0.5';
        wordList.appendChild(li);
    }
}

// Select mouth shape for a word
function selectMouthShapeForWord(word) {
    const firstSound = window.extractFirstSound ? window.extractFirstSound(word) : word.charAt(0).toLowerCase();
    
    // Find the current mouth images and select the matching one
    const labels = Array.from(document.querySelectorAll('.mouth-image-item .mouth-image-label'));
    const sounds = labels.map(el => (el.textContent || '').toLowerCase());
    const soundIndex = sounds.findIndex(s => s === firstSound.toLowerCase());
    
    if (soundIndex !== -1) {
        const allItems = document.querySelectorAll('.mouth-image-item');
        allItems.forEach(item => item.classList.remove('active'));
        const targetItem = allItems[soundIndex];
        if (targetItem) {
            targetItem.classList.add('active');
            if (window.updateSoundInfo) {
                window.updateSoundInfo(sounds[soundIndex]);
            }
        }
    }
}

// Move word to top of target words list and highlight it
function moveWordToTopOfList(clickedWord) {
    if (!currentStoryState.targetWords || currentStoryState.targetWords.length === 0) {
        return;
    }
    
    // Find the word in target words list (case-insensitive, with or without braces)
    const wordIndex = currentStoryState.targetWords.findIndex(word => {
        const cleanWord = word.replace(/[{}]/g, '');
        return cleanWord.toLowerCase() === clickedWord.toLowerCase();
    });
    
    if (wordIndex > 0) {
        // Move the word to the beginning of the array
        const wordToMove = currentStoryState.targetWords.splice(wordIndex, 1)[0];
        currentStoryState.targetWords.unshift(wordToMove);
        
        // Update the word list display
        if (window.updateWordList) {
            window.updateWordList(currentStoryState.targetWords);
        }
    }
    
    // Highlight the word in the sidebar
    highlightWordInSidebar(clickedWord);
}

// Highlight a specific word in the target words sidebar
function highlightWordInSidebar(targetWord) {
    // Remove any existing highlights
    const allWordItems = document.querySelectorAll('.word-item');
    allWordItems.forEach(item => {
        item.classList.remove('highlighted');
    });
    // Find and highlight the matching word
    allWordItems.forEach(item => {
        const itemText = item.textContent.trim();
        if (itemText.toLowerCase() === targetWord.toLowerCase()) {
            item.classList.add('highlighted');
            
            // Remove highlight after a few seconds
            setTimeout(() => {
                item.classList.remove('highlighted');
            }, 3000);
        }
    });
}

// Highlight words that are present in the current dialogue text
function highlightWordsInDialogue(dialogueText) {
    console.log('highlightWordsInDialogue called with:', dialogueText);
    console.log('currentStoryState.targetWords:', currentStoryState.targetWords);
    
    if (!dialogueText || !currentStoryState.targetWords) {
        console.log('highlightWordsInDialogue: No dialogue text or target words, clearing highlights');
        // Clear all dialogue highlights if no text or no target words
        clearDialogueWordHighlights();
        return;
    }
    
    // Clear existing dialogue highlights
    clearDialogueWordHighlights();
    
    // Find which target words are present in the dialogue text
    const wordsInDialogue = [];
    currentStoryState.targetWords.forEach(targetWord => {
        const cleanTargetWord = targetWord.replace(/[{}]/g, '');
        
        // Create case-insensitive regex for whole words
        const wordRegex = new RegExp(`\\b${escapeRegExp(cleanTargetWord)}\\b`, 'gi');
        
        console.log(`Checking word "${cleanTargetWord}" against text "${dialogueText}"`);
        if (wordRegex.test(dialogueText)) {
            console.log(`Found match for word: ${cleanTargetWord}`);
            wordsInDialogue.push(cleanTargetWord);
        }
    });
    
    console.log('Words found in dialogue:', wordsInDialogue);
    
    // Sort target words to put highlighted words first
    if (wordsInDialogue.length > 0) {
        sortWordsByDialoguePresence(wordsInDialogue);
    }
    
    // Highlight the words in sidebar
    const allWordItems = document.querySelectorAll('.word-item');
    console.log('Found word items:', allWordItems.length);
    allWordItems.forEach((item, index) => {
        const wordText = item.querySelector('.word-text');
        if (wordText) {
            const itemText = wordText.textContent.trim();
            console.log(`Word item ${index}: "${itemText}"`);
            console.log(`Checking against wordsInDialogue:`, wordsInDialogue);
            
            if (wordsInDialogue.some(word => word.toLowerCase() === itemText.toLowerCase())) {
                console.log(`Adding in-dialogue class to word item: ${itemText}`);
                item.classList.add('in-dialogue');
                console.log(`Classes after adding:`, item.className);
            } else {
                console.log(`No match found for word item: ${itemText}`);
            }
        } else {
            console.log(`Word item ${index}: no .word-text element found`);
        }
    });
    
    console.log('Words highlighted in dialogue:', wordsInDialogue);
}

// Sort target words to put dialogue words first
function sortWordsByDialoguePresence(wordsInDialogue) {
    if (!currentStoryState.targetWords || currentStoryState.targetWords.length === 0) {
        return;
    }
    
    // Save original order if not already saved
    if (!currentStoryState.originalTargetWords) {
        currentStoryState.originalTargetWords = [...currentStoryState.targetWords];
    }
    
    // Create a set of words in dialogue for quick lookup (case-insensitive)
    const dialogueWordsSet = new Set(wordsInDialogue.map(word => word.toLowerCase()));
    
    // Sort target words: dialogue words first, then others
    const sortedWords = [...currentStoryState.targetWords].sort((a, b) => {
        const cleanA = a.replace(/[{}]/g, '').toLowerCase();
        const cleanB = b.replace(/[{}]/g, '').toLowerCase();
        
        const aInDialogue = dialogueWordsSet.has(cleanA);
        const bInDialogue = dialogueWordsSet.has(cleanB);
        
        // If one is in dialogue and the other isn't, prioritize the one in dialogue
        if (aInDialogue && !bInDialogue) return -1;
        if (!aInDialogue && bInDialogue) return 1;
        
        // If both are in dialogue or both are not, maintain original order
        return 0;
    });
    
    // Update the current story state with sorted words
    currentStoryState.targetWords = sortedWords;
    
    // Update the word list display
    if (window.updateWordList) {
        window.updateWordList(sortedWords);
    }
}

// Clear dialogue word highlights and restore original order
function clearDialogueWordHighlights() {
    const allWordItems = document.querySelectorAll('.word-item');
    allWordItems.forEach(item => {
        item.classList.remove('in-dialogue');
    });
    
    // Restore original word order if we have the original target words
    if (currentStoryState.originalTargetWords && currentStoryState.originalTargetWords.length > 0) {
        currentStoryState.targetWords = [...currentStoryState.originalTargetWords];
        if (window.updateWordList) {
            window.updateWordList(currentStoryState.targetWords);
        }
    }
}

// 소리 설명 음성 재생 (API 사용)
function playSoundDescription(sound) {
    const soundDescription = getSoundDescription(sound);
    if (!soundDescription) return;
    
    fetch('/api/play-sound-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: soundDescription.description })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Sound description audio played successfully');
        } else {
            console.error('Failed to play sound description:', data.message);
            if (window.showNotification) {
                window.showNotification('Failed to play audio: ' + data.message, 'error');
            }
        }
    })
    .catch(error => {
        console.error('Error playing sound description:', error);
        if (window.showNotification) {
            window.showNotification('Error playing audio: ' + error.message, 'error');
        }
    });
}

// 소리 제스처 음성 재생 (API 사용)
function playSoundGesture(sound) {
    const soundDescription = getSoundDescription(sound);
    if (!soundDescription) return;
    
    fetch('/api/play-sound-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: soundDescription.gesture })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Sound gesture audio played successfully');
        } else {
            console.error('Failed to play sound gesture:', data.message);
            if (window.showNotification) {
                window.showNotification('Failed to play audio: ' + data.message, 'error');
            }
        }
    })
    .catch(error => {
        console.error('Error playing sound gesture:', error);
        if (window.showNotification) {
            window.showNotification('Error playing audio: ' + error.message, 'error');
        }
    });
}

// expose to global (for module script access and HTML inline handlers)
window.toggleCollapsibleSidebar = toggleCollapsibleSidebar;
window.updateMultipleMouthImages = updateMultipleMouthImages;
window.updateSingleMouthImage = updateSingleMouthImage;
window.updateWordList = updateWordList;
window.pronounceWord = pronounceWord;  // dialogue용 단순 재생
window.pronounceWordRepeat = pronounceWordRepeat;  // sidebar용 반복재생
window.practiceWordPronunciation = practiceWordPronunciation;  // sidebar용 녹음 연습
window.extractFirstSound = extractFirstSound;
window.updateSoundInfo = updateSoundInfo;
window.highlightWordInSidebar = highlightWordInSidebar;
window.highlightWordsInDialogue = highlightWordsInDialogue;
window.clearDialogueWordHighlights = clearDialogueWordHighlights;
window.sortWordsByDialoguePresence = sortWordsByDialoguePresence;
window.moveWordToTopOfList = moveWordToTopOfList;
window.selectMouthShapeForWord = selectMouthShapeForWord;
window.stopRepeatPlayback = stopRepeatPlayback;
window.startRepeatPlayback = startRepeatPlayback;
window.playSoundDescription = playSoundDescription;
window.playSoundGesture = playSoundGesture;


