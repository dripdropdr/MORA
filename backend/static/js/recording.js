let currentAudio = null;
let currentPlayBtn = null;

// Get current user data from localStorage
function getCurrentUserData() {
    try {
        const userData = JSON.parse(localStorage.getItem('rp_user_data'));
        return userData;
    } catch (e) {
        return null;
    }
}

// Get current user ID (can be obtained from API response or localStorage)
function getCurrentUserId() {
    const userData = getCurrentUserData();
    return userData ? userData.userId : 'unknown';
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

// Load recordings list when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (!checkUserLogin()) return;
    
    // Show user info
    const userData = getCurrentUserData();
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; z-index: 1000; font-size: 14px; backdrop-filter: blur(10px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);';
    userInfo.innerHTML = `<span>👤 ${userData.userId}</span> | <button onclick="logout()" style="background: #dc3545; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">Logout</button>`;
    document.body.appendChild(userInfo);
    
    loadRecordings();
});

// Load recordings list
async function loadRecordings() {
    try {
        showLoading();
        hideError();

        const userData = getCurrentUserData();
        if (!userData || !userData.userId) {
            showError('User not logged in');
            return;
        }

        const response = await fetch(`/api/recordings/list?user_id=${encodeURIComponent(userData.userId)}`);
        const data = await response.json();

        if (data.success) {
            if (data.user_id) { // Save user ID to global variable
                window.currentUserId = data.user_id;
            }
            if (data.recordings.length === 0) {
                showNoRecordings();
            } else {
                // Load pronunciation analysis data
                await loadPronunciationAnalysis(userData.userId);
                displayRecordings(data.recordings);
                showContent();
            }
        } else {
            showError(data.error || data.message || 'Cannot load recordings list.');
        }
    } catch (error) {
        console.error('Recordings list load error:', error);
        showError('Server connection error occurred.');
    }
}

// Load pronunciation analysis data
async function loadPronunciationAnalysis(userId) {
    try {
        const response = await fetch(`/api/recordings/pronunciation-analysis?user_id=${encodeURIComponent(userId)}`);
        const data = await response.json();
        
        if (data.success) {
            // Store analysis data globally for use in UI
            window.pronunciationAnalysis = data.all_stories_analysis || {};
        } else {
            console.warn('Could not load pronunciation analysis:', data.error);
            window.pronunciationAnalysis = {};
        }
    } catch (error) {
        console.error('Pronunciation analysis load error:', error);
        window.pronunciationAnalysis = {};
    }
}

// Display recordings list
function displayRecordings(recordings) {
    const container = document.getElementById('recordings-list');
    container.innerHTML = '';

    recordings.forEach(story => {
        const storySection = createStorySection(story);
        container.appendChild(storySection);
    });
}

// Create story section
function createStorySection(story) {
    const section = document.createElement('div');
    section.className = 'story-section';

    const header = document.createElement('div');
    header.className = 'story-header';
    
    // Create target sounds display
    const targetSoundsHtml = createTargetSoundsDisplay(story.target_sounds);
    
    // Create statistics display
    const statisticsHtml = createStatisticsDisplay(story.pronunciation_statistics, story.target_words);
    
    // Create accuracy pie chart
    const accuracyStats = calculateAccuracyStats(story.story_id, story.story_modes);
    const pieChartHtml = accuracyStats ? createAccuracyPieChart(accuracyStats) : '';
    
    header.innerHTML = `
        <div class="story-header-content">
            ${targetSoundsHtml}
            <div class="story-main-info">
                <h3>📚 ${story.story_title || `Story ${story.story_id}`}</h3>
                <p>${story.total_recordings} recordings total</p>
                ${statisticsHtml}
            </div>
            ${pieChartHtml ? `<div class="story-accuracy-stats">${pieChartHtml}</div>` : ''}
        </div>
    `;

    const content = document.createElement('div');
    content.className = 'story-content';

    if (story.story_modes.length === 0) {
        content.innerHTML = '<p class="no-transcription">No recordings in this story.</p>';
    } else {
        story.story_modes.forEach(storyMode => {
            const modeSection = createModeSection(storyMode, story.story_id, story.target_words);
            content.appendChild(modeSection);
        });
    }

    // Toggle content when header is clicked
    header.addEventListener('click', () => {
        content.classList.toggle('active');
    });
    section.appendChild(header);
    section.appendChild(content);
    return section;
}

// Clean word for grouping
function cleanWordForGrouping(word) {
    if (!word) return 'Unknown';
    return word
        .toLowerCase()
        .replace(/[{}]/g, '')
        .replace(/[.,!?;:"']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Create target sounds display
function createTargetSoundsDisplay(targetSounds) {
    if (!targetSounds || targetSounds.length === 0) {
        return '';
    }
    
    // Convert target sound names to display format
    const soundDisplayMap = {
        'words_with_l_initial': 'L initial',
        'words_with_r_initial': 'R initial',
        'words_with_ch_initial': 'CH initial',
        'words_with_sh_initial': 'SH initial',
        'words_with_th_initial': 'TH initial',
        'words_with_s_initial': 'S initial',
        'words_with_z_initial': 'Z initial',
        'words_with_f_initial': 'F initial',
        'words_with_v_initial': 'V initial',
        'words_with_p_initial': 'P initial',
        'words_with_b_initial': 'B initial',
        'words_with_t_initial': 'T initial',
        'words_with_d_initial': 'D initial',
        'words_with_k_initial': 'K initial',
        'words_with_g_initial': 'G initial',
        'words_with_m_initial': 'M initial',
        'words_with_n_initial': 'N initial',
        'words_with_ng_initial': 'NG initial',
        'words_with_w_initial': 'W initial',
        'words_with_y_initial': 'Y initial',
        'words_with_h_initial': 'H initial'
    };
    
    const displaySounds = targetSounds.map(sound => {
        return soundDisplayMap[sound] || sound.replace('words_with_', '').replace('_initial', '').toUpperCase();
    });
    
    return `<div class="target-sounds">
        <div class="sounds-container">
            ${displaySounds.map(sound => `<span class="sound-badge">${sound}</span>`).join('')}
        </div>
    </div>`;
}

// Calculate pronunciation accuracy statistics for a story based on distance labels
function calculateAccuracyStats(storyId, recordings) {
    if (!window.pronunciationAnalysis || !window.pronunciationAnalysis[storyId]) {
        return null;
    }
    
    const storyAnalysis = window.pronunciationAnalysis[storyId];
    const stats = {
        excellent: 0,
        good: 0,
        fair: 0,
        needsPractice: 0,
        total: 0
    };
    
    // Process all recordings to get their distance labels
    recordings.forEach(storyMode => {
        storyMode.recordings.forEach(recording => {
            const modeKey = storyMode.story_mode === 'word' ? 'word_mode' : 'sentence_mode';
            const modeAnalysis = storyAnalysis.analysis[modeKey];
            
            if (!modeAnalysis) return;
            
            // Find matching recording in analysis data
            const recordingName = recording.filename.replace('.wav', '');
            const analysisData = modeAnalysis[recordingName];
            
            if (!analysisData || !analysisData.length) return;
            
            // Get the best (lowest) distance from all target words in this recording
            const distances = analysisData.map(item => item.distance).filter(d => d !== Infinity);
            if (distances.length === 0) return;
            
            const bestDistance = Math.min(...distances);
            const label = getDistanceLabel(bestDistance);
            
            stats.total++;
            switch(label) {
                case 'Excellent':
                    stats.excellent++;
                    break;
                case 'Good':
                    stats.good++;
                    break;
                case 'Fair':
                    stats.fair++;
                    break;
                case 'Needs Practice':
                    stats.needsPractice++;
                    break;
            }
        });
    });
    
    return stats.total > 0 ? stats : null;
}

// Create pie chart for pronunciation accuracy
function createAccuracyPieChart(stats) {
    if (!stats || stats.total === 0) {
        return '';
    }
    
    const { excellent, good, fair, needsPractice, total } = stats;
    
    // Calculate percentages and angles
    const excellentPercent = (excellent / total * 100);
    const goodPercent = (good / total * 100);
    const fairPercent = (fair / total * 100);
    const needsPracticePercent = (needsPractice / total * 100);
    
    // Calculate cumulative angles for SVG path
    let currentAngle = 0;
    const segments = [];
    
    const colors = {
        excellent: '#4CAF50',
        good: '#8BC34A', 
        fair: '#FF9800',
        needsPractice: '#F44336'
    };
    
    const data = [
        { label: 'Excellent', count: excellent, percent: excellentPercent, color: colors.excellent },
        { label: 'Good', count: good, percent: goodPercent, color: colors.good },
        { label: 'Fair', count: fair, percent: fairPercent, color: colors.fair },
        { label: 'Needs Practice', count: needsPractice, percent: needsPracticePercent, color: colors.needsPractice }
    ];
    
    // Create SVG paths for each segment
    data.forEach(segment => {
        if (segment.count === 0) return;
        
        const angle = (segment.percent / 100) * 360;
        const endAngle = currentAngle + angle;
        
        // Convert angles to radians
        const startAngleRad = (currentAngle * Math.PI) / 180;
        const endAngleRad = (endAngle * Math.PI) / 180;
        
        // Calculate path coordinates
        const radius = 30;
        const centerX = 35;
        const centerY = 35;
        
        const x1 = centerX + radius * Math.cos(startAngleRad);
        const y1 = centerY + radius * Math.sin(startAngleRad);
        const x2 = centerX + radius * Math.cos(endAngleRad);
        const y2 = centerY + radius * Math.sin(endAngleRad);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');
        
        segments.push({
            path: pathData,
            color: segment.color,
            label: segment.label,
            count: segment.count,
            percent: segment.percent.toFixed(1)
        });
        
        currentAngle = endAngle;
    });
    
    const svgPaths = segments.map(segment => 
        `<path d="${segment.path}" fill="${segment.color}" stroke="white" stroke-width="1" 
               title="${segment.label}: ${segment.count} (${segment.percent}%)"></path>`
    ).join('');
    
    const legendItems = segments.map(segment =>
        `<div class="legend-item">
            <span class="legend-color" style="background-color: ${segment.color}"></span>
            <span class="legend-text">${segment.label}: ${segment.count}</span>
        </div>`
    ).join('');
    
    return `
        <div class="accuracy-chart">
            <div class="chart-container">
                <svg width="70" height="70" viewBox="0 0 70 70">
                    ${svgPaths}
                </svg>
                <div class="chart-total">${total}</div>
            </div>
            <div class="chart-legend">
                ${legendItems}
            </div>
        </div>
    `;
}

// Create statistics display
function createStatisticsDisplay(pronunciationStats, targetWords) {
    if (!pronunciationStats || !targetWords || targetWords.length === 0) {
        return '';
    }
    
    const statsItems = [];
    
    // Create array of words with their counts for sorting
    const wordsWithCounts = targetWords.map(word => {
        const cleanWord = word.replace(/[{}]/g, '').trim().toLowerCase();
        const count = pronunciationStats[cleanWord] || 0;
        const displayWord = word.replace(/[{}]/g, '').trim();
        
        return {
            displayWord,
            count,
            originalWord: word
        };
    });
    
    // Sort by pronunciation count (descending - highest to lowest)
    wordsWithCounts.sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count; // Primary sort: by count (descending)
        }
        return a.displayWord.localeCompare(b.displayWord); // Secondary sort: alphabetically
    });
    
    wordsWithCounts.forEach(({ displayWord, count }) => {
        // Create color coding based on pronunciation count
        let colorClass = 'stat-low';
        if (count >= 5) {
            colorClass = 'stat-high';
        } else if (count >= 2) {
            colorClass = 'stat-medium';
        }
        
        statsItems.push(`<span class="pronunciation-stat ${colorClass}">${displayWord}: ${count}</span>`);
    });
    
    return `<div class="pronunciation-statistics">
        <div class="stats-label">📊 Pronunciation Count:</div>
        <div class="stats-items">${statsItems.join('')}</div>
    </div>`;
}

// Group recordings by target_word (deprecated - keeping for backward compatibility)
function groupRecordingsByTargetWord(recordings, targetWords) {
    const groups = {};
    
    // Create mapping of clean target words to display words
    const cleanToDisplayMapping = {};
    if (targetWords) {
        targetWords.forEach(word => {
            const cleanWord = cleanWordForGrouping(word);
            if (!cleanToDisplayMapping[cleanWord]) {
                // Use clean form without braces for display
                cleanToDisplayMapping[cleanWord] = word.replace(/[{}]/g, '').trim();
            }
        });
    }
    
    recordings.forEach(recording => {
        // Priority: target_word > transcription > 'Unknown'
        let sourceWord = recording.target_word || recording.transcription || 'Unknown';
        const cleanWord = cleanWordForGrouping(sourceWord);
        
        // Determine display word
        let displayWord = cleanToDisplayMapping[cleanWord] || cleanWord;
        
        // Capitalize first letter if not 'unknown'
        if (displayWord !== 'unknown' && displayWord !== 'Unknown') {
            displayWord = displayWord.charAt(0).toUpperCase() + displayWord.slice(1);
        } else {
            displayWord = 'Unknown';
        }
        
        // Create group if it doesn't exist
        if (!groups[displayWord]) {
            groups[displayWord] = [];
        }
        groups[displayWord].push(recording);
    });
    
    return groups;
}

// Create mode section
function createModeSection(storyMode, storyId, targetWords) {
    
    const section = document.createElement('div');
    section.className = 'mode-section';

    const header = document.createElement('div');
    header.className = 'mode-header';
    header.innerHTML = `
        <h4>🎯 ${storyMode.story_mode} mode</h4>
        <p>${storyMode.total_recordings} recordings</p>
    `;

    const content = document.createElement('div');
    content.className = 'mode-content';

    if (storyMode.recordings.length === 0) {
        content.innerHTML = '<p class="no-transcription">No recordings in this mode.</p>';
    } else {
        // Both word-mode and sentence-mode: simple list format
        storyMode.recordings.forEach(recording => {
            const recordingItem = createRecordingItem(recording, storyId, storyMode.story_mode, targetWords);
            content.appendChild(recordingItem);
        });
    }

    // Toggle content when header is clicked
    header.addEventListener('click', () => {
        content.classList.toggle('active');
    });

    section.appendChild(header);
    section.appendChild(content);

    return section;
}

// Create word section (word-mode)
function createWordSection(targetWord, recordings, storyId, storyMode) {
    const section = document.createElement('div');
    section.className = 'word-section';

    const header = document.createElement('div');
    header.className = 'word-header';
    header.innerHTML = `
        <h5>🔤 "${targetWord}" (${recordings.length} recordings)</h5>
    `;

    const content = document.createElement('div');
    content.className = 'word-content';

    recordings.forEach(recording => {
        const recordingItem = createRecordingItem(recording, storyId, storyMode, null);
        content.appendChild(recordingItem);
    });

    // Toggle content when header is clicked
    header.addEventListener('click', () => {
        content.classList.toggle('active');
    });

    section.appendChild(header);
    section.appendChild(content);

    return section;
}

// Create recording item
function createRecordingItem(recording, storyId, storyMode, targetWords) {
    const item = document.createElement('div');
    item.className = 'recording-item';

    const timestamp = formatTimestamp(recording.timestamp);
    const fileSize = formatFileSize(recording.size);

    // New file path structure: user_ID/story_ID/mode_MODE/filename.wav
    // But check for legacy session format for backward compatibility
    const userData = getCurrentUserData();
    const userId = userData ? userData.userId : 'unknown';
    
    // Try new format first, fallback to old format
    let audioPath = `user_${userId}/story_${storyId}/mode_${storyMode}/${recording.filename}`;
    // Check if this is from legacy session directory
    if (recording.filepath && recording.filepath.includes('session_')) {
        audioPath = `session_${userId}/story_${storyId}/mode_${storyMode}/${recording.filename}`;
    }

    // Get distance information for this recording
    const distanceInfo = getDistanceInfo(recording, storyId, storyMode);

    // Compact header with timestamp and target word
    const headerSection = `
        <div class="recording-header">
            <div class="recording-meta">
                <span class="timestamp">🕒 ${timestamp}</span>
                ${recording.target_word ? `<span class="target-word">🎯 ${recording.target_word}</span>` : ''}
                ${distanceInfo ? distanceInfo : ''}
            </div>
            <button class="play-btn" onclick="playAudio('${audioPath}', this)">▶ Play</button>
        </div>
    `;

    // Show prompt for sentence mode (more compact)
    const promptSection = (storyMode === 'sentence' && recording.prompt) ? 
        `<div class="prompt-section">
            <span class="prompt-label">💬</span>
            <span class="prompt-text">${recording.prompt}</span>
        </div>` : '';

    // Compact transcription section with side-by-side layout
    const transcriptionSection = `
        <div class="transcription-section">
            <div class="transcription-row">
                <div class="transcription-item text-transcription">
                    <span class="transcription-label">📝</span>
                    <span class="transcription-content">
                        ${recording.transcription ? recording.transcription : 'No text transcription yet.'}
                    </span>
                </div>
            </div>
            <div class="transcription-row">
                <div class="transcription-item phoneme-transcription">
                    <span class="transcription-label">🔤</span>
                    <span class="transcription-content">
                        ${recording.phoneme_transcription ? 
                            recording.phoneme_transcription : 
                            (recording.transcription ? '🔄 Processing...' : 'No phoneme transcription yet.')
                        }
                    </span>
                </div>
            </div>
        </div>
    `;

    item.innerHTML = `
        ${headerSection}
        ${promptSection}
        ${transcriptionSection}
    `;

    return item;
}

// Get distance information for a recording
function getDistanceInfo(recording, storyId, storyMode) {
    if (!window.pronunciationAnalysis || !window.pronunciationAnalysis[storyId]) {
        return '';
    }
    
    const storyAnalysis = window.pronunciationAnalysis[storyId];
    const modeKey = storyMode === 'word' ? 'word_mode' : 'sentence_mode';
    const modeAnalysis = storyAnalysis.analysis[modeKey];
    
    if (!modeAnalysis) {
        return '';
    }
    
    // Find matching recording in analysis data
    const recordingName = recording.filename.replace('.wav', '');
    const analysisData = modeAnalysis[recordingName];
    
    if (!analysisData || !analysisData.length) {
        return '';
    }
    
    // Get the best (lowest) distance from all target words in this recording
    const distances = analysisData.map(item => item.distance).filter(d => d !== Infinity);
    if (distances.length === 0) {
        return '';
    }
    
    const bestDistance = Math.min(...distances);
    const distanceColor = getDistanceColor(bestDistance);
    const distanceLabel = getDistanceLabel(bestDistance);
    
    return `<span class="distance-info ${distanceColor}" title="Pronunciation accuracy: ${bestDistance.toFixed(2)}">
        📊 ${distanceLabel}
    </span>`;
}

// Get color class based on distance value
function getDistanceColor(distance) {
    if (distance <= 0.1) {
        return 'distance-excellent';  // Green
    } else if (distance <= 1.0) {
        return 'distance-good';       // Yellow-green
    } else if (distance <= 2.0) {
        return 'distance-fair';       // Orange
    } else {
        return 'distance-poor';       // Red
    }
}

// Get human-readable label for distance
function getDistanceLabel(distance) {
    if (distance <= 0.1) {
        return 'Excellent';
    } else if (distance <= 1.0) {
        return 'Good';
    } else if (distance <= 2.0) {
        return 'Fair';
    } else {
        return 'Needs Practice';
    }
}

// Play audio
function playAudio(filepath, button) {
    // Stop previous audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (currentPlayBtn) {
        currentPlayBtn.textContent = '▶ Play';
        currentPlayBtn.classList.remove('playing');
    }
    
    // Play new audio
    const userData = getCurrentUserData();
    const audioUrl = userData ? 
        `/api/recordings/audio/${filepath}?user_id=${encodeURIComponent(userData.userId)}` :
        `/api/recordings/audio/${filepath}`;
    currentAudio = new Audio(audioUrl);
    currentPlayBtn = button;

    button.textContent = '⏸ Stop';
    button.classList.add('playing');

    currentAudio.addEventListener('ended', () => {
        button.textContent = '▶ Play';
        button.classList.remove('playing');
        currentAudio = null;
        currentPlayBtn = null;
    });

    currentAudio.addEventListener('error', () => {
        button.textContent = '▶ Play';
        button.classList.remove('playing');
        currentAudio = null;
        currentPlayBtn = null;
        alert('Cannot play audio file.');
    });

    currentAudio.play();
}

// Format timestamp
function formatTimestamp(timestamp) {
    try {
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        const hour = timestamp.substring(9, 11);
        const minute = timestamp.substring(11, 13);
        const second = timestamp.substring(13, 15);
        
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    } catch (e) {
        return timestamp;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// UI state management functions
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('no-recordings').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function showContent() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    document.getElementById('no-recordings').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function showNoRecordings() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    document.getElementById('no-recordings').style.display = 'block';
    document.getElementById('error').style.display = 'none';
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    document.getElementById('no-recordings').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = message;
}

function hideError() {
    document.getElementById('error').style.display = 'none';
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

// Export functions
window.logout = logout;
window.playAudio = playAudio;