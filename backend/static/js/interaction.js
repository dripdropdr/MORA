// Manage destination button states
let destinationButtonStates = {};
let chooseItemButtonStates = {};
let clickButtonStates = {};

// Sentence recording state (MediaRecorder-based, browser-side)
let sentenceMediaRecorder = null;
let sentenceRecordedChunks = [];
let sentenceAudioStream = null;

function setUpInteractionwithButtons(interaction_type, imageData, btn_words, btn_image) {
    updateImage(imageData);
    
    if (interaction_type == 'select_destination') {
        setupDestinationButtons(btn_words, btn_image);
    }
    else if (interaction_type == 'choose') {
        setupChooseItemButtons(btn_words, btn_image);
    }
    else if (interaction_type == 'click') {
        setupClickButtons(btn_words, btn_image);
    }
}

// Setup destination buttons
function setupDestinationButtons(btn_words, btn_image) {
    const container = document.getElementById('destination-buttons-container');
    container.innerHTML = ''; // 기존 버튼들 제거
    container.style.display = 'flex';
    destinationButtonStates = {}; // 상태 초기화
    
    btn_words.forEach((word, index) => {
        const button = document.createElement('div');
        button.className = 'destination-btn';
        button.dataset.word = word;
        button.dataset.index = index;
        button.style.cursor = 'pointer';
        
        // 이미지 요소 생성
        const img = document.createElement('img');
        img.src = 'data:image/png;base64,' + btn_image[index];
        img.alt = word;
        img.style.width = '50px';
        img.style.height = '40px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.pointerEvents = 'none'; // 이미지 자체는 클릭 이벤트를 받지 않도록
        
        // 텍스트 레이블 추가 (선택사항)
        const label = document.createElement('div');
        label.textContent = word;
        label.style.textAlign = 'center';
        label.style.marginTop = '3px';
        label.style.fontSize = '11px';
        label.style.fontWeight = '600';
        
        button.appendChild(img);
        button.appendChild(label);
        
        destinationButtonStates[word] = {
            clickCount: 0,
            element: button
        };
        
        button.addEventListener('click', () => handleDestinationClick(word));
        container.appendChild(button);

    });
}

// Handle destination button click
async function handleDestinationClick(word) {
    // Show destination popup
    function showDestinationPopup(word) {
        const popup = document.getElementById('destination-popup');
        const overlay = document.getElementById('destination-popup-overlay');
        
        // Update popup content
        popup.querySelector('h3').textContent = `🎯 "${word}" Selected!`;
        popup.querySelector('p').textContent = 'If you want to select this, click one more time.';
        
        // Show popup
        overlay.style.display = 'block';
        popup.style.display = 'block';
        
        // Delay for animation
        setTimeout(() => {
            overlay.classList.add('show');
            popup.classList.add('show');
        }, 10);
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            hideDestinationPopup();
        }, 2000);
    }

    // Hide destination popup
    function hideDestinationPopup() {
        const popup = document.getElementById('destination-popup');
        const overlay = document.getElementById('destination-popup-overlay');
        
        overlay.classList.remove('show');
        popup.classList.remove('show');
        
        setTimeout(() => {
            overlay.style.display = 'none';
            popup.style.display = 'none';
        }, 300);
    }

    const state = destinationButtonStates[word];
    if (!state) return;
    
    state.clickCount++;
    
    if (state.clickCount === 1) {
        // First click: Pronounce + Show popup
        state.element.classList.add('clicked-once');
        
        // Pronounce word
        try {
            const userData = getCurrentUserData();
            if (!userData || !userData.currentStory) {
                console.warn('User data not found for pronunciation');
                return;
            }

            const response = await fetch('/api/pronounce-word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    user_id: userData.userId,
                    story_id: userData.currentStory.storyId,
                    story_mode: userData.currentStory.storyMode || 'sentence',
                    word: word,
                    target_sound: userData.currentStory.targetSound || ''
                })
            });
    
            const data = await response.json();
            if (data.success) {
                showNotification(`🔊 "${word}" Pronouncing...`, 'info');
            } else {
                console.warn('Pronounce API error:', data.message);
            }
        } catch (error) {
            console.warn('Pronounce failed:', error);
        }
        
        // Show popup
        showDestinationPopup(word);
        
        // Initialize other buttons' state
        Object.keys(destinationButtonStates).forEach(otherWord => {
            if (otherWord !== word && destinationButtonStates[otherWord].clickCount > 0) {
                destinationButtonStates[otherWord].clickCount = 0;
                destinationButtonStates[otherWord].element.classList.remove('clicked-once');
            }
        });
        
    } else if (state.clickCount >= 2) {
        // Second click: Destination selection completed and proceed to next dialogue
        hideDestinationPopup();
        await selectDestination(word);
    }
}

// Destination selection completed
async function selectDestination(selectedWord) {
    try {
        showNotification(`🎯 Destination "${selectedWord}" selected!`, 'success');
        
        // Hide destination buttons
        const container = document.getElementById('destination-buttons-container');
        container.style.display = 'none';
        // Update destination in current story state
        const currentStoryState = window.currentStoryState || window.getCurrentStoryState?.();
        if (currentStoryState) {
            currentStoryState.destination = selectedWord;
        }
        
        // Check story mode to determine behavior
        const userData = getCurrentUserData();
        const storyMode = userData?.currentStory?.storyMode || 'sentence';
        
        if (storyMode === 'sentence') {
            // Store completion callback for after sentence pronunciation
            window.destinationCompletionCallback = async () => {
                try {
                    // Send destination selection result to server
                    const userData = getCurrentUserData();
                    if (!userData || !userData.currentStory) {
                        console.error('User data not found');
                        return;
                    }

                    const response = await fetch('/api/story/select-destination', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            user_id: userData.userId,
                            story_id: userData.currentStory.storyId,
                            story_mode: userData.currentStory.storyMode || 'sentence',
                            selected_destination: selectedWord 
                        })
                    });

                    const data = await response.json();
                    if (data.success) {
                        updateButtonStates();
                        finalizeTurn(true);
                    } else {
                        showNotification('Destination selection processing error: ' + data.message, 'error');
                    }
                } catch (error) {
                    showNotification('Destination selection error: ' + error.message, 'error');
                }
            };
            
            // Pronounce sentence with selected destination
            const sentence = `I want to go ${selectedWord}.`;
            await pronounceSentenceWithUserInput(sentence);
        } else {
            // Word mode: Show word pronunciation prompt
            try {
                const response = await fetch('/api/pronounce-word', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        user_id: userData.userId,
                        story_id: userData.currentStory.storyId,
                        story_mode: userData.currentStory.storyMode || 'sentence',
                        word: selectedWord,
                        target_sound: userData.currentStory.targetSound || ''
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showNotification(`🔊 "${selectedWord}" Pronouncing...`, 'info');
                }
            } catch (error) {
                console.warn('Pronounce failed:', error);
            }
            
            // Store completion callback for after word pronunciation
            window.destinationCompletionCallback = async () => {
                await completeDestinationSelection(selectedWord);
            };
            
            // Show word pronunciation prompt
            await pronounceSentenceWithUserInput(selectedWord);
        }
        
    } catch (error) {
        showNotification('Destination selection error: ' + error.message, 'error');
    }
}

// Complete destination selection (for word mode)
async function completeDestinationSelection(selectedWord) {
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            console.error('User data not found');
            return;
        }

        const response = await fetch('/api/story/select-destination', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'sentence',
                selected_destination: selectedWord 
            })
        });

        const data = await response.json();
        if (data.success) {
            updateButtonStates();
            finalizeTurn(true);
        } else {
            showNotification('Destination selection processing error: ' + data.message, 'error');
        }
    } catch (error) {
        showNotification('Destination selection error: ' + error.message, 'error');
    }
}

// Default implementation for other interaction types
function setupChooseItemButtons(btn_words, btn_image) {
    const container = document.getElementById('choose-item-buttons-container');
    container.innerHTML = ''; // Remove existing buttons
    container.style.display = 'flex';
    chooseItemButtonStates = {}; // Initialize state
    
    btn_words.forEach((word, index) => {
        const button = document.createElement('div');
        button.className = 'choose-item-btn';
        button.dataset.word = word;
        button.dataset.index = index;
        button.style.cursor = 'pointer';
        
        // Create image element
        const img = document.createElement('img');
        img.src = 'data:image/png;base64,' + btn_image[index];
        img.alt = word;
        
        // Add text label (optional)
        const label = document.createElement('div');
        label.textContent = word;
        
        button.appendChild(img);
        button.appendChild(label);
        
        chooseItemButtonStates[word] = {
            clickCount: 0,
            element: button
        };
        
        button.addEventListener('click', () => handleChooseItemClick(word));
        container.appendChild(button);
    });
}

// Handle choice button click
async function handleChooseItemClick(word) {
    // Show choice popup
    function showChooseItemPopup(word) {
        const popup = document.getElementById('choose-item-popup');
        const overlay = document.getElementById('choose-item-popup-overlay');
        
        // Update popup content
        popup.querySelector('h3').textContent = `🎯 "${word}" Selected!`;
        popup.querySelector('p').textContent = 'If you want to choose this, click one more time.';
        
        // Show popup
        overlay.style.display = 'block';
        popup.style.display = 'block';
        
        // Delay for animation
        setTimeout(() => {
            overlay.classList.add('show');
            popup.classList.add('show');
        }, 10);
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            hideChooseItemPopup();
        }, 2000);
    }

    // Hide choice popup
    function hideChooseItemPopup() {
        const popup = document.getElementById('choose-item-popup');
        const overlay = document.getElementById('choose-item-popup-overlay');
        
        overlay.classList.remove('show');
        popup.classList.remove('show');
        
        setTimeout(() => {
            overlay.style.display = 'none';
            popup.style.display = 'none';
        }, 300);
    }

    const state = chooseItemButtonStates[word];
    if (!state) return;
    
    state.clickCount++;
    
    if (state.clickCount === 1) {
        // First click: Pronounce + Show popup
        state.element.classList.add('clicked-once');
        
        // Pronounce word
        try {
            const userData = getCurrentUserData();
            if (!userData || !userData.currentStory) {
                console.warn('User data not found for pronunciation');
                return;
            }

            const response = await fetch('/api/pronounce-word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    user_id: userData.userId,
                    story_id: userData.currentStory.storyId,
                    story_mode: userData.currentStory.storyMode || 'sentence',
                    word: word,
                    target_sound: userData.currentStory.targetSound || ''
                })
            });
    
            const data = await response.json();
            if (!data.success) {
                console.error('Pronounce API error:', data.message);
            }
        } catch (error) {
            console.error('Pronounce failed:', error);
        }
        
        // 팝업 표시
        showChooseItemPopup(word);
        
        // Initialize other buttons' state
        Object.keys(chooseItemButtonStates).forEach(otherWord => {
            if (otherWord !== word && chooseItemButtonStates[otherWord].clickCount > 0) {
                chooseItemButtonStates[otherWord].clickCount = 0;
                chooseItemButtonStates[otherWord].element.classList.remove('clicked-once');
            }
        });

    } else if (state.clickCount >= 2) {
        // Second click: Choice item completed and proceed to next dialogue
        hideChooseItemPopup();
        await chooseItem(word);
    }
}

// Choice selection completed
async function chooseItem(selectedWord) {
    try {
        showNotification(`🎯 Choose "${selectedWord}"!`, 'success');
        
        // Hide choice buttons
        const container = document.getElementById('choose-item-buttons-container');
        container.style.display = 'none';
        
        // Update chosen item in current story state (similar to destination)
        const currentStoryState = window.currentStoryState || window.getCurrentStoryState?.();
        if (currentStoryState) {
            currentStoryState.chosenItem = selectedWord;
        }
        
        // Check story mode to determine behavior
        const userData = getCurrentUserData();
        const storyMode = userData?.currentStory?.storyMode || 'sentence';
        
        if (storyMode === 'sentence') {
            // Store completion callback for after sentence pronunciation
            window.chooseItemCompletionCallback = async () => {
                try {
                    // Send choice item selection result to server
                    const userData = getCurrentUserData();
                    if (!userData || !userData.currentStory) {
                        showNotification('User data not found', 'error');
                        return;
                    }

                    const response = await fetch('/api/story/choose-item', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            user_id: userData.userId,
                            story_id: userData.currentStory.storyId,
                            story_mode: userData.currentStory.storyMode || 'sentence',
                            chosen_item: selectedWord 
                        })
                    });

                    const data = await response.json();
                    if (data.success) {
                        // Enable next button
                        updateButtonStates();
                        finalizeTurn(true);
                    } else {
                        showNotification('Choice item selection processing error: ' + data.message, 'error');
                    }
                } catch (error) {
                    showNotification('Choice item selection error: ' + error.message, 'error');
                }
            };
            
            // Pronounce sentence with chosen item
            const sentence = `I choose ${selectedWord}.`;
            await pronounceSentenceWithUserInput(sentence);
        } else {
            // Word mode: Send choice selection to server immediately, then show pronunciation
            try {
                const response = await fetch('/api/story/choose-item', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        user_id: userData.userId,
                        story_id: userData.currentStory.storyId,
                        story_mode: userData.currentStory.storyMode || 'sentence',
                        chosen_item: selectedWord 
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showNotification(`✅ Item "${selectedWord}" selection sent to server!`, 'success');
                } else {
                    showNotification('Choice item selection processing error: ' + data.message, 'error');
                    return;
                }
            } catch (error) {
                showNotification('Choice item selection error: ' + error.message, 'error');
                return;
            }
            
            // Then show word pronunciation prompt  
            try {
                const response = await fetch('/api/pronounce-word', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        user_id: userData.userId,
                        story_id: userData.currentStory.storyId,
                        story_mode: userData.currentStory.storyMode || 'sentence',
                        word: selectedWord,
                        target_sound: userData.currentStory.targetSound || ''
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showNotification(`🔊 "${selectedWord}" Pronouncing...`, 'info');
                }
            } catch (error) {
                console.warn('Pronounce failed:', error);
            }
            
            // Store completion callback for after word pronunciation (just for UI state management)
            window.chooseItemCompletionCallback = async () => {
                // No need to send to server again, just update UI
                updateButtonStates();
                finalizeTurn(true);
            };
            
            // Show word pronunciation prompt
            await pronounceSentenceWithUserInput(selectedWord);
        }
        
    } catch (error) {
        showNotification('Choice item selection error: ' + error.message, 'error');
    }
}

// Setup click buttons
function setupClickButtons(btn_words, btn_image) {
    // 랜덤 위치 생성 (버튼이 겹치지 않도록)
    function getRandomPosition() {
        // 이미지 경계 내에서 랜덤 위치 생성 (여백 고려)
        const margin = 10; // 경계로부터의 여백 (%)
        const x = Math.random() * (100 - margin * 2) + margin;
        const y = Math.random() * (100 - margin * 2) + margin;
        
        return { x, y };
    }
    
    const container = document.getElementById('click-buttons-container');
    const screenOverlay = document.getElementById('click-screen-overlay');
    
    container.innerHTML = ''; // 기존 버튼들 제거
    container.style.display = 'block';
    clickButtonStates = {}; // 상태 초기화
    
    // 랜덤 위치에 버튼들 생성
    btn_words.forEach((word, index) => {
        const button = document.createElement('div');
        button.className = 'click-btn';
        button.dataset.word = word;
        button.dataset.index = index;
        
        // 이미지 요소 생성
        const img = document.createElement('img');
        img.src = 'data:image/png;base64,' + btn_image[index];
        img.alt = word;
        
        // 텍스트 레이블 추가
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = word;
        
        button.appendChild(img);
        button.appendChild(label);
        
        // 상태 초기화
        clickButtonStates[word] = {
            clickCount: 0,
            element: button,
            practiced: false
        };
        
        // 랜덤 위치 설정 (이미지 경계 내에서)
        const randomPosition = getRandomPosition();
        button.style.left = randomPosition.x + '%';
        button.style.top = randomPosition.y + '%';
        
        // 버튼 클릭 이벤트
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // 화면 클릭 이벤트 방지
            handleClickButtonClick(word, button);
        });
        
        container.appendChild(button);
    });
    
    // 화면 클릭 이벤트 (아이템이 아닌 곳을 클릭했을 때)
    screenOverlay.addEventListener('click', () => {
        handleScreenClick(btn_words);
    });
    
    // Next 버튼 활성화 (클릭 인터랙션에서는 항상 활성화)
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.innerHTML = '⏭️ Next dialogue';
    }
    
    // 입력 섹션 숨기기
    const inputSection = document.getElementById('input-section');
    if (inputSection) {
        inputSection.style.display = 'none';
    }
}

// Handle click button click
async function handleClickButtonClick(word, buttonElement) {
    // Show click item popup
    function showClickItemPopup(word) {
        const popup = document.getElementById('click-item-popup');
        const overlay = document.getElementById('click-item-popup-overlay');
        
        // Update popup content
        popup.querySelector('h3').textContent = `🎯 "${word}" Selected!`;
        popup.querySelector('p').textContent = 'If you want to practice this, click one more time.';
        
        // Show popup
        overlay.style.display = 'block';
        popup.style.display = 'block';
        
        // Delay for animation
        setTimeout(() => {
            overlay.classList.add('show');
            popup.classList.add('show');
        }, 10);
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            hideClickItemPopup();
        }, 2000);
    }

    // Hide click item popup
    function hideClickItemPopup() {
        const popup = document.getElementById('click-item-popup');
        const overlay = document.getElementById('click-item-popup-overlay');
        
        overlay.classList.remove('show');
        popup.classList.remove('show');
        
        setTimeout(() => {
            overlay.style.display = 'none';
            popup.style.display = 'none';
        }, 300);
    }

    const state = clickButtonStates[word];
    if (!state) return;
    
    state.clickCount++;
    
    if (state.clickCount === 1) {
        // First click: Pronounce + Show popup
        state.element.classList.add('clicked-once');
        
        // 버튼 애니메이션
        buttonElement.classList.add('clicked');
        setTimeout(() => {
            buttonElement.classList.remove('clicked');
        }, 400);
        
        // Pronounce word
        try {
            const userData = getCurrentUserData();
            if (!userData || !userData.currentStory) {
                console.warn('User data not found for pronunciation');
                return;
            }

            const response = await fetch('/api/pronounce-word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    user_id: userData.userId,
                    story_id: userData.currentStory.storyId,
                    story_mode: userData.currentStory.storyMode || 'sentence',
                    word: word,
                    target_sound: userData.currentStory.targetSound || ''
                })
            });

            const data = await response.json();
            if (data.success) {
                showNotification(`🔊 "${word}" Pronouncing...`, 'info');
            } else {
                console.warn('Pronounce API error:', data.message);
            }
        } catch (error) {
            console.warn('Pronounce failed:', error);
        }
        
        // Show popup
        showClickItemPopup(word);
        
        // Initialize other buttons' state
        Object.keys(clickButtonStates).forEach(otherWord => {
            if (otherWord !== word && clickButtonStates[otherWord].clickCount > 0) {
                clickButtonStates[otherWord].clickCount = 0;
                clickButtonStates[otherWord].element.classList.remove('clicked-once');
            }
        });
        
    } else if (state.clickCount >= 2) {
        // Second click: Show pronunciation practice interface
        hideClickItemPopup();
        await practiceClickItem(word);
    }
}

// Practice click item (show pronunciation interface)
async function practiceClickItem(selectedWord) {
    try {
        showNotification(`🎯 Practice "${selectedWord}"!`, 'success');
        
        // Check story mode to determine behavior
        const userData = getCurrentUserData();
        const storyMode = userData?.currentStory?.storyMode || 'sentence';
        
        window.clickItemCompletionCallback = async () => {
            // Mark this item as practiced (add visual feedback)
            const state = clickButtonStates[selectedWord];
            if (state && state.element) {
                state.element.classList.add('practiced');
                state.practiced = true;
            }
            
            // Show completion message for this specific item
            showNotification(`✅ "${selectedWord}" practice completed!`, 'success');
            
            // Check if all items have been practiced (optional)
            const allItemsPracticed = Object.values(clickButtonStates).every(state => state.practiced);
            if (allItemsPracticed) {
                showNotification(`🎉 All items practiced! You can continue to next dialogue.`, 'success');
                // Only now enable next button
                updateButtonStates();
            }
            // Don't call updateButtonStates() for individual item completion
        };
        
        if (storyMode === 'sentence') {
            // Show sentence pronunciation prompt
            const sentence = `I can see ${selectedWord}.`;
            await pronounceSentenceWithUserInput(sentence);
        } else {
            // Word mode: Show word pronunciation prompt
            await pronounceSentenceWithUserInput(selectedWord);
        }
        
    } catch (error) {
        console.error('Click item practice error: ' + error.message, 'error');
    }
}

// Handle screen click (when clicking on non-item)
async function handleScreenClick(availableItems) {
    // 랜덤하게 아이템 선택
    const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
    
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            showNotification('User data not found', 'error');
            return;
        }

        const response = await fetch('/api/story/explore-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user_id: userData.userId,
                story_id: userData.currentStory.storyId,
                story_mode: userData.currentStory.storyMode || 'sentence',
                item: randomItem,
                available_items: availableItems
            })
        });

        const data = await response.json();
        if (data.success && data.dialogue) {
            // 캐릭터가 아이템에 대해 말하는 대사 표시
            showDialogue(data.dialogue.character, data.dialogue.text);
            
            // 오디오 생성이 시작되면 상태 업데이트
            if (data.dialogue.audio_generating) {
                showAudioStatus(true, data.dialogue.character);
            }
        } else {
            console.warn('Explore item API error:', data.message);
        }
    } catch (error) {
        console.error('Screen click processing error:', error);
    }
}

// Show sentence pronunciation prompt with recording interface
async function pronounceSentenceWithUserInput(sentence, isSidebarPractice = false) {
    try {
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            console.warn('User data not found for sentence pronunciation');
            return;
        }

        // Extract target word from sentence
        let targetWord = null;
        const storyMode = userData?.currentStory?.storyMode || 'sentence';
        if (storyMode === 'word') {
            // For word mode, the sentence is just the word itself
            targetWord = sentence;
        } else {
            // For sentence mode, extract word from patterns
            const wordMatch = sentence.match(/I can see (\w+)\.|I choose (\w+)\.|I want to go (\w+)\./);
            if (wordMatch) {
                targetWord = wordMatch[1] || wordMatch[2] || wordMatch[3];
            }
        }
        
        // Store target word globally for recording
        window.currentPracticeWord = targetWord;

        // Show sentence pronunciation prompt
        showSentencePronunciationPrompt(sentence, isSidebarPractice);
        
    } catch (error) {
        console.warn('Sentence pronunciation prompt failed:', error);
        showNotification(`❌ Failed to show sentence pronunciation prompt: ${error.message}`, 'error');
    }
}

// Show sentence pronunciation prompt modal
function showSentencePronunciationPrompt(sentence, isSidebarPractice = false) {
    // Remove existing prompt if any
    const existingOverlay = document.querySelector('.sentence-pronunciation-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Create prompt overlay
    const overlay = document.createElement('div');
    overlay.className = 'sentence-pronunciation-overlay';
    
    // Create prompt content inside overlay
    overlay.innerHTML = `
        <div class="sentence-pronunciation-prompt">
            <div class="sentence-pronunciation-header">
                <h3>🎤 Follow the sentence and say it!</h3>
                <button class="close-prompt-btn" onclick="hideSentencePronunciationPrompt()">×</button>
            </div>
            <div class="sentence-pronunciation-content">
                <div class="target-sentence">
                    <p class="sentence-label">Follow the sentence and say it:</p>
                    <p class="sentence-text">"${sentence}"</p>
                </div>
                <div class="recording-controls">
                    <button id="sentence-record-btn" class="record-btn" onclick="toggleSentenceRecording('${sentence}')">
                        🎤 Start recording
                    </button>
                    <div class="recording-status" id="sentence-recording-status" style="display: none;">
                        <span class="recording-indicator">🔴 Recording...</span>
                        <p class="recording-instruction">Click again to stop recording</p>
                    </div>
                </div>
                <div class="pronunciation-result" id="sentence-pronunciation-result" style="display: none;">
                    <p class="result-label">Recognized sentence:</p>
                    <p class="result-text" id="sentence-result-text"></p>
                    <div class="result-actions">
                        <button class="retry-btn" onclick="retrySentenceRecording('${sentence}')">🔄 Retry</button>
                        <button class="confirm-btn" onclick="confirmSentencePronunciation(${isSidebarPractice})">✅ Good!</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add to DOM
    document.body.appendChild(overlay);
    
    // Show with animation
    setTimeout(() => {
        overlay.classList.add('show');
    }, 10);
}

// Hide sentence pronunciation prompt
function hideSentencePronunciationPrompt() {
    const overlay = document.querySelector('.sentence-pronunciation-overlay');
    
    if (overlay) {
        overlay.classList.remove('show');
        
        setTimeout(() => {
            if (overlay && overlay.parentNode) {
                overlay.remove();
            }
        }, 300);
    }
}

// Toggle sentence recording
async function toggleSentenceRecording(sentence) {
    const recordBtn = document.getElementById('sentence-record-btn');
    const recordingStatus = document.getElementById('sentence-recording-status');
    const pronunciationResult = document.getElementById('sentence-pronunciation-result');

    try {
        if (recordBtn.classList.contains('recording')) {
            // Stop browser recording
            if (sentenceMediaRecorder && sentenceMediaRecorder.state !== 'inactive') {
                sentenceMediaRecorder.stop();
            }
            if (sentenceAudioStream) {
                sentenceAudioStream.getTracks().forEach(t => t.stop());
                sentenceAudioStream = null;
            }

            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '🎤 Start recording';
            recordingStatus.style.display = 'none';
            
            showNotification('🎤 Stop recording and processing...', 'info');

            // Create blob and upload to server for transcription
            if (!sentenceRecordedChunks.length) {
                showNotification('No audio recorded', 'warning');
                return;
            }
            const audioBlob = new Blob(sentenceRecordedChunks, { type: 'audio/webm' });
            sentenceRecordedChunks = [];

            const userData = getCurrentUserData();
            if (!userData || !userData.currentStory) {
                showNotification('User data not found', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('user_id', userData.userId);
            formData.append('story_id', userData.currentStory.storyId);
            formData.append('story_mode', userData.currentStory.storyMode || 'sentence');

            const res = await fetch('/api/story/audio/upload-and-transcribe', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success && data.transcribed_text) {
                document.getElementById('sentence-result-text').textContent = `"${data.transcribed_text}"`;
                pronunciationResult.style.display = 'block';
                showNotification('🎤 Speech recognition completed!', 'success');
                window.currentTranscribedSentence = data.transcribed_text;
            } else {
                showNotification('Speech recognition error: ' + (data.error || 'Unknown error'), 'error');
            }
        } else {
            // Start browser recording
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '⏹️ Stop recording';
            recordingStatus.style.display = 'block';
            pronunciationResult.style.display = 'none';

            try {
                sentenceAudioStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        sampleRate: 44100,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (e) {
                // Fallback simpler constraints
                sentenceAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            let options = {};
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/wav'
            ];
            for (const mt of mimeTypes) {
                if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mt)) {
                    options.mimeType = mt;
                    break;
                }
            }
            if (options.mimeType && options.mimeType.includes('webm')) {
                options.audioBitsPerSecond = 128000;
            }

            sentenceRecordedChunks = [];
            sentenceMediaRecorder = new MediaRecorder(sentenceAudioStream, options);
            sentenceMediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) sentenceRecordedChunks.push(e.data);
            };
            sentenceMediaRecorder.start(100);
            showNotification('🎤 Recording started! Click again to stop.', 'success');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        const recordBtn = document.getElementById('sentence-record-btn');
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '🎤 Start recording';
        const recordingStatus = document.getElementById('sentence-recording-status');
        recordingStatus.style.display = 'none';
    }
}

// Retry sentence recording
function retrySentenceRecording(sentence) {
    const pronunciationResult = document.getElementById('sentence-pronunciation-result');
    pronunciationResult.style.display = 'none';
    
    // Reset recording button
    const recordBtn = document.getElementById('sentence-record-btn');
    recordBtn.classList.remove('recording');
    recordBtn.innerHTML = '🎤 Start recording';
    
    window.currentTranscribedSentence = null;
}

// Confirm sentence pronunciation
async function confirmSentencePronunciation(isSidebarPractice = false) {
    const transcribedText = window.currentTranscribedSentence;
    if (!transcribedText) {
        showNotification('Recognized text not found.', 'error');
        return;
    }
    
    try {
        showNotification('🔄 Processing sentence...', 'info');
        
        const userData = getCurrentUserData();
        if (!userData || !userData.currentStory) {
            showNotification('User data not found', 'error');
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
                input: transcribedText,
                retry_count: 0,
                sidebar_practice: isSidebarPractice
            })
        });

        const data = await response.json();
        if (data.success) {
            showNotification('✅ Sentence pronunciation successfully processed!', 'success');
            hideSentencePronunciationPrompt();
            
            // Check if this is sidebar practice (target word learning)
            if (isSidebarPractice) {
                // For sidebar practice, just close the popup and show success message
                showNotification('🎯 Target word practice completed!', 'success');
                return; // Don't proceed with story progression
            }
            
            // Process next dialogue if available (only for story interactions)
            if (data.next_dialogue) {
                // Update dialogue index from server response
                if (typeof data.next_dialogue.current_dialogue !== 'undefined') {
                    const currentStoryState = window.currentStoryState || window.getCurrentStoryState?.();
                    if (currentStoryState) {
                        currentStoryState.dialogueId = data.next_dialogue.current_dialogue;
                    }
                }
                if (typeof data.next_dialogue.total_dialogues !== 'undefined') {
                    const currentStoryState = window.currentStoryState || window.getCurrentStoryState?.();
                    if (currentStoryState) {
                        currentStoryState.totalDialogues = data.next_dialogue.total_dialogues;
                    }
                }
                
                processDialogueData(data.next_dialogue, 'sentencePronunciation');
            }
            
            // Call completion callbacks if they exist (only for story interactions)
            if (window.destinationCompletionCallback) {
                await window.destinationCompletionCallback();
                window.destinationCompletionCallback = null;
            } else if (window.chooseItemCompletionCallback) {
                await window.chooseItemCompletionCallback();
                window.chooseItemCompletionCallback = null;
            } else if (window.clickItemCompletionCallback) {
                await window.clickItemCompletionCallback();
                window.clickItemCompletionCallback = null;
            } else {
                // Fallback: Update button states and finalize turn (only for story interactions)
                updateButtonStates();
                finalizeTurn(false);
            }
        } else {
            if (data.retry_required && data.missing_words) {
                const missingWordsText = data.missing_words.join(', ');
                showNotification(`Please include these words in your response: ${missingWordsText}. Try again!`, 'warning');
            } else {
                console.error('Sentence processing error: ' + data.message, 'error');
            }
        }
    } catch (error) {
        console.error('Sentence processing error: ' + error.message, 'error');
    }
}

// Hide all interaction buttons
function clearAllInteractionButtons() {
    // Hide destination buttons
    const destinationContainer = document.getElementById('destination-buttons-container');
    if (destinationContainer) {
        destinationContainer.style.display = 'none';
    }
    // Hide click buttons
    const clickContainer = document.getElementById('click-buttons-container');
    if (clickContainer) {
        clickContainer.style.display = 'none';
    }
}


window.clearAllInteractionButtons = clearAllInteractionButtons;
window.handleClickButtonClick = handleClickButtonClick;
window.handleScreenClick = handleScreenClick;
window.handleChooseItemClick = handleChooseItemClick;
window.handleDestinationClick = handleDestinationClick;
window.setupClickButtons = setupClickButtons;
window.setupChooseItemButtons = setupChooseItemButtons;
window.setupDestinationButtons = setupDestinationButtons;
window.setUpInteractionwithButtons = setUpInteractionwithButtons;
window.pronounceSentenceWithUserInput = pronounceSentenceWithUserInput;
window.showSentencePronunciationPrompt = showSentencePronunciationPrompt;
window.hideSentencePronunciationPrompt = hideSentencePronunciationPrompt;
window.toggleSentenceRecording = toggleSentenceRecording;
window.retrySentenceRecording = retrySentenceRecording;
window.confirmSentencePronunciation = confirmSentencePronunciation;
window.completeDestinationSelection = completeDestinationSelection;
window.practiceClickItem = practiceClickItem;