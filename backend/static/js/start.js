// Check if user is logged in
function checkUserLogin() {
    const userData = getCurrentUserData();
    if (!userData || !userData.userId) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

// Get current user data from localStorage
function getCurrentUserData() {
    try {
        const userData = JSON.parse(localStorage.getItem('rp_user_data'));
        return userData;
    } catch (e) {
        return null;
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    if (!checkUserLogin()) return;
    
    // Show current user info
    const userData = getCurrentUserData();
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `<p>👤 Logged in as: <strong>${userData.userId}</strong> | <button onclick="logout()" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">Logout</button></p>`;
    document.body.insertBefore(userInfo, document.body.firstChild);
    
    loadStoryList();
});

async function loadStoryList() {
    const userData = getCurrentUserData();
    if (!userData || !userData.userId) {
        showError('User data not found for loading stories');
        return;
    }

    const storiesContainer = document.getElementById('stories-list');
    if (!storiesContainer) return;

    // Show loading
    storiesContainer.innerHTML = '<div class="loading-message">Loading available stories...</div>';

    try {
        // Load stories from API
        const response = await fetch('/api/stories');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load stories');
        }

        // Load user's available stories from registered_users
        const userStories = userData.stories || [];
        
        if (userStories.length === 0) {
            storiesContainer.innerHTML = '<div class="error-message">No stories available for this user.</div>';
            return;
        }

        // Clear loading message
        storiesContainer.innerHTML = '';
        
        // Create story items using API data
        userStories.forEach(storyId => {
            const storyData = data.stories.find(s => s.id === storyId);
            const storyItem = createStoryItem(storyId, storyData);
            storiesContainer.appendChild(storyItem);
        });
    } catch (error) {
        console.error('Failed to load stories:', error);
        storiesContainer.innerHTML = '<div class="error-message">Failed to load stories. Please try again.</div>';
    }
}

function createStoryItem(storyId, storyData) {
    const storyItem = document.createElement('div');
    storyItem.className = 'story-item';
    storyItem.dataset.storyId = storyId;
    
    // Use story title from API data or fallback to default
    const storyTitle = storyData?.title || `Story ${storyId.replace('story_', '')}`;
    // const storyDescription = `Interactive story adventure with pronunciation practice`;
    
    storyItem.innerHTML = `
        <div class="story-header">
            <h3 class="story-title">${storyTitle}</h3>
            <span class="story-id">${storyId}</span>
        </div>
        <div class="story-details">
            <div class="story-targets">
                <div class="target-section">
                    <h4 class="target-title">🎯 Target Words</h4>
                    <div class="story-words" id="words-${storyId}">
                        <span class="word-tag">Loading...</span>
                    </div>
                </div>
                <div class="target-section">
                    <h4 class="target-title">🔊 Target Sounds</h4>
                    <div class="story-sounds" id="sounds-${storyId}">
                        <span class="sound-tag">Loading...</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="story-modes">
            <div class="mode-option" data-mode="sentence" data-story="${storyId}">
                <div class="mode-title">📝 Sentence Mode</div>
                <div class="mode-description">Practice full sentences</div>
            </div>
            <div class="mode-option" data-mode="word" data-story="${storyId}">
                <div class="mode-title">🔤 Word Mode</div>
                <div class="mode-description">Practice individual words</div>
            </div>
        </div>
        <button class="start-button" onclick="startStory('${storyId}')" disabled>
            🚀 Start Story
        </button>
    `;
    
    // Add click handlers for mode selection
    const modeOptions = storyItem.querySelectorAll('.mode-option');
    modeOptions.forEach(option => {
        option.addEventListener('click', () => selectMode(storyId, option.dataset.mode));
    });
    
    // Load story words after DOM element is created and added
    requestAnimationFrame(() => {
        loadStoryWords(storyId);
    });
    
    return storyItem;
}

function selectMode(storyId, mode) {
    // Remove selection from all modes in this story
    const storyItem = document.querySelector(`[data-story-id="${storyId}"]`);
    const modeOptions = storyItem.querySelectorAll('.mode-option');
    modeOptions.forEach(option => option.classList.remove('selected'));
    
    // Select the clicked mode
    const selectedOption = storyItem.querySelector(`[data-mode="${mode}"]`);
    selectedOption.classList.add('selected');
    
    // Enable start button
    const startButton = storyItem.querySelector('.start-button');
    startButton.disabled = false;
    startButton.dataset.mode = mode;
}

async function startStory(storyId) {
    const storyItem = document.querySelector(`[data-story-id="${storyId}"]`);
    const startButton = storyItem.querySelector('.start-button');
    const selectedMode = startButton.dataset.mode;
    
    if (!selectedMode) {
        alert('Please select a practice mode first.');
        return;
    }
    
    const userData = getCurrentUserData();
    if (!userData || !userData.userId) {
        alert('User data not found. Please login again.');
        window.location.href = '/login';
        return;
    }

    // Show loading state
    startButton.disabled = true;
    startButton.innerHTML = '<span class="loading"></span> Starting story...';

    try {
        const response = await fetch('/api/story/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: userData.userId, 
                story_id: storyId, 
                story_mode: selectedMode 
            })
        });
        
        const initData = await response.json();
        if (!initData.success) throw new Error(initData.message || 'Failed to initialize story');

        // Save minimal story data to localStorage (avoid large scene data)
        const newStoryData = {
            userId: initData.user_id,
            storyId: storyId,
            sceneId: initData.story_info?.current_scene_id || null,
            dialogueId: initData.story_info?.current_dialogue || 0,
            totalDialogues: initData.story_info?.total_dialogues_in_scene || 0,
            storyMode: selectedMode,
            selectedDestination: initData.story_info?.selected_destination || null
            // Note: Removed large data like targetWords, targetSounds, current_scene, lastTurn
            // These will be loaded from server when needed
        };

        // Update user data with minimal story info
        userData.currentStory = newStoryData;
        try {
            localStorage.setItem('rp_user_data', JSON.stringify(userData));
        } catch (error) {
            console.warn('Failed to save story data to localStorage:', error);
            // Continue anyway - data will be loaded from server
        }

        // Redirect to main app
        window.location.href = '/';
        
    } catch (error) {
        console.error('Story initialization error:', error);
        alert('Failed to start the story: ' + error.message);
        startButton.disabled = false;
        startButton.innerHTML = '🚀 Start Story';
    }
}

async function loadStoryWords(storyId) {
    try {
        const wordsContainer = document.getElementById(`words-${storyId}`);
        const soundsContainer = document.getElementById(`sounds-${storyId}`);
        
        if (!wordsContainer && !soundsContainer) {
            return;
        }
        
        // Try to load from API
        try {
            const response = await fetch(`/api/stories`);
            const data = await response.json();
            
            if (data.success) {
                const story = data.stories.find(s => s.id === storyId);
                
                if (story) {
                    // Load target words
                    if (wordsContainer && story.target_words) {
                        const targetWords = story.target_words.map(word => 
                            word.replace(/[{}]/g, '') // Remove curly braces
                        );
                        wordsContainer.innerHTML = targetWords.slice(0, 6).map(word => 
                            `<span class="word-tag">${word}</span>`
                        ).join('');
                        
                        if (targetWords.length > 6) {
                            wordsContainer.innerHTML += `<span class="word-tag more">+${targetWords.length - 6} more</span>`;
                        }
                    }
                    
                    // Load target sounds from API data
                    if (soundsContainer && story.target_sounds) {
                        loadTargetSounds(story.target_sounds, soundsContainer);
                    }
                    return;
                }
            }
        } catch (apiError) {
            console.warn('Failed to load from API, using fallback:', apiError);
        }
        
        // Fallback to sample data
        if (wordsContainer) {
            const sampleWords = ['lizard', 'lighthouse', 'rainforest', 'library'];
            wordsContainer.innerHTML = sampleWords.map(word => 
                `<span class="word-tag">${word}</span>`
            ).join('');
        }
        
        if (soundsContainer) {
            // Fallback target sounds based on story ID
            let sampleSounds = ['Various sounds'];
            if (storyId.includes('850518')) {
                sampleSounds = ['L SOUND', 'R SOUND'];
            } else if (storyId.includes('967781')) {
                sampleSounds = ['CH SOUND', 'R SOUND'];
            }
            
            soundsContainer.innerHTML = sampleSounds.map(sound => 
                `<span class="sound-tag">${sound}</span>`
            ).join('');
        }
        
    } catch (error) {
        console.warn('Failed to load story words:', error);
    }
}

function loadTargetSounds(targetSounds, soundsContainer) {
    if (!soundsContainer || !targetSounds) {
        return;
    }
    
    if (targetSounds.length > 0) {
        // Convert theme names to readable format
        const readableSounds = targetSounds.map(theme => {
            return theme
                .replace('words_with_', '')
                .replace('_initial', ' sound')
                .replace('_', ' ')
                .toUpperCase();
        });
        
        const htmlContent = readableSounds.map(sound => 
            `<span class="sound-tag">${sound}</span>`
        ).join('');
        soundsContainer.innerHTML = htmlContent;
    } else {
        soundsContainer.innerHTML = '<span class="sound-tag">No target sounds</span>';
    }
}

function showError(message) {
    const storiesContainer = document.getElementById('stories-list');
    if (storiesContainer) {
        storiesContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }
}


// Logout function
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

// Export functions to window
window.logout = logout;
window.startStory = startStory;
window.selectMode = selectMode;