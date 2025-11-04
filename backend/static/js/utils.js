// Handle keyboard event
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        submitUserInput();
    }
}

// *** Story state-related utils ***
// Common function to finalize turn
function finalizeTurn(saveState = true) {
    // updateStatusBar();
    if (saveState) {
        saveStoryState();
    }
}
// Redirect to start page with overlay
function redirectToStartWithOverlay(message = 'No session found. Redirecting to start page...') {
    try {
        const placeholderImage = document.getElementById('placeholder-image');
        const storyImage = document.getElementById('story-image');
        if (placeholderImage) {
            placeholderImage.classList.remove('expanded');
            placeholderImage.style.display = 'flex';
            placeholderImage.textContent = message;
        }
        if (storyImage) {
            storyImage.style.display = 'none';
        }
        showNotification(message, 'info');
    } catch (e) { /* ignore */ }
    setTimeout(() => { window.location.href = '/start'; }, 1200);
}

// *** Regex-related utils ***
// Extract sound from theme
function extractSoundFromTheme(theme) {
    // Extract sound from theme string
    const soundMatch = theme.match(/words_with_([a-z_]+)_/);
    if (soundMatch) {
        return soundMatch[1];
    }
    return null;
}
// Helper function to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// *** UI-related utils ***
// Update image
function updateImage(imageData) {
    const storyImage = document.getElementById('story-image');
    const placeholderImage = document.getElementById('placeholder-image');
    
    storyImage.src = 'data:image/png;base64,' + imageData;
    storyImage.style.display = 'block';
    placeholderImage.style.display = 'none';
    
    // Expand the placeholder-image
    placeholderImage.classList.add('expanded');
}

// Common function to update next button state
function updateButtonStates() {
    // console.log('update next button state in updateButtonStates');
    const nextBtn = document.getElementById('next-btn');
    const nextSceneBtn = document.getElementById('next-scene-btn');
    const currentState = window.currentStoryState || window.getCurrentStoryState?.();
    
    if (nextBtn && currentState) {
        // If current dialogue is less than total dialogues, enable next dialogue button 
        if (currentState.dialogueId < currentState.totalDialogues) { // TODO Logic: 
            nextBtn.style.display = 'block';
            nextBtn.disabled = false;
            nextBtn.innerHTML = '⏭️ Next dialogue';
            nextSceneBtn.style.display = 'none';
        } else {
            // If all dialogues in the scene are completed, enable next scene button
            nextBtn.disabled = true;
            nextBtn.style.display = 'none';
            nextBtn.innerHTML = '⏭️ Next dialogue';
            nextSceneBtn.disabled = false;
            nextSceneBtn.style.display = 'block';
            nextSceneBtn.innerHTML = '🎬 Next scene';
        }
    }
}
// Show notification on the web page
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}   

window.handleKeyPress = handleKeyPress;
window.finalizeTurn = finalizeTurn;
window.extractSoundFromTheme = extractSoundFromTheme;
window.showNotification = showNotification;
window.escapeRegExp = escapeRegExp;
window.updateButtonStates = updateButtonStates;
window.updateImage = updateImage;
window.redirectToStartWithOverlay = redirectToStartWithOverlay;