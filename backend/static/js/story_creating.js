
let selectedTemplate = null;
let selectedSounds = [];
let configuredStoryData = null;
let editedWords = {}; // 수정된 단어들을 저장
const maxSounds = 4;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    loadStoryList();
    loadTemplates();
    loadSoundCategories();
});

// Internal functions - no need to expose to window
// Only functions called from HTML onclick handlers need to be exposed

// 기존 스토리 목록 로드
async function loadStoryList() {
    try {
        const response = await fetch('/api/stories');
        const data = await response.json();
        
        const storyList = document.getElementById('storyList');
        storyList.innerHTML = '';

        data.stories.forEach(story => {
            const storyCard = createStoryCard(story);
            storyList.appendChild(storyCard);
        });
    } catch (error) {
        console.error('Story list loading error:', error);
    }
}

// 스토리 카드 생성
function createStoryCard(story) {
    const card = document.createElement('div');
    card.className = `story-card ${story.status}`;
    
    card.innerHTML = `
        <div class="story-info">
            <div class="story-title">${story.title}</div>
            <div class="story-details">
                <!-- <div>Template: ${story.template}</div> -->
                <div>${story.target_words.map(word => word.replace(/[{}]/g, '')).join(', ')}</div>
            </div>
        </div>
        <div class="story-status status-${story.status}">
            ${story.status === 'creating' ? 'Creating' : 'Completed'}
        </div>
    `;
    
    return card;
}

// 템플릿 로드
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        
        const templateGrid = document.getElementById('templateGrid');
        templateGrid.innerHTML = '';

        data.templates.forEach(template => {
            const templateCard = createTemplateCard(template);
            templateGrid.appendChild(templateCard);
        });
    } catch (error) {
        console.error('Template loading error:', error);
    }
}

// 템플릿 카드 생성
function createTemplateCard(template) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.dataset.templateId = template.id;
    
    card.innerHTML = `
        <div class="template-icon">${template.icon}</div>
        <div class="template-title">${template.title}</div>
        <div class="template-desc">${template.description}</div>
    `;
    
    card.addEventListener('click', () => selectTemplate(template));
    return card;
}

// 템플릿 선택
function selectTemplate(template) {
    // 기존 선택 해제
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // 새 템플릿 선택
    document.querySelector(`[data-template-id="${template.id}"]`).classList.add('selected');
    selectedTemplate = template;
    
    updateButtons();
}

// 발음 카테고리 로드
async function loadSoundCategories() {
    try {
        const response = await fetch('/api/sound-categories');
        const data = await response.json();
        
        const soundCategories = document.getElementById('soundCategories');
        soundCategories.innerHTML = '';

        Object.entries(data.categories).forEach(([category, info]) => {
            const categoryDiv = createSoundCategory(category, info);
            soundCategories.appendChild(categoryDiv);
        });
    } catch (error) {
        console.error('Sound category loading error:', error);
    }
}

// 발음 카테고리 생성
function createSoundCategory(category, info) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'sound-category';
    
    // // 카테고리 제목 추가
    // const titleDiv = document.createElement('div');
    // titleDiv.className = 'sound-category-title';
    // titleDiv.textContent = info.display_name;
    // categoryDiv.appendChild(titleDiv);
    
    // 발음 버튼
    const soundBtn = document.createElement('button');
    soundBtn.className = 'sound-btn';
    soundBtn.textContent = info.display_name;
    soundBtn.dataset.soundKey = category;
    soundBtn.addEventListener('click', () => toggleSound(category));
    categoryDiv.appendChild(soundBtn);
    
    return categoryDiv;
}

// 발음 토글
function toggleSound(soundKey) {
    const soundBtn = event.target;
    
    if (soundBtn.classList.contains('selected')) {
        // 발음 선택 해제
        soundBtn.classList.remove('selected');
        selectedSounds = selectedSounds.filter(s => s !== soundKey);
    } else {
        // 발음 선택
        if (selectedSounds.length >= maxSounds) {
            alert(`You can select up to ${maxSounds} sounds.`);
            return;
        }
        soundBtn.classList.add('selected');
        selectedSounds.push(soundKey);
    }
    
    updatePreview();
    updateButtons();
}

// 미리보기 업데이트
function updatePreview() {
    const previewSection = document.getElementById('previewSection');
    const configWords = document.getElementById('configWords');
    
    if (selectedSounds.length > 0) {
        configWords.innerHTML = '';
        selectedSounds.forEach(sound => {
            const soundSpan = document.createElement('span');
            soundSpan.className = 'config-word';
            soundSpan.textContent = sound;
            configWords.appendChild(soundSpan);
        });
        previewSection.style.display = 'block';
    } else {
        previewSection.style.display = 'none';
    }
}

// 버튼 업데이트
function updateButtons() {
    const configureBtn = document.getElementById('configureBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    const canConfigure = selectedTemplate && selectedSounds.length > 0;
    const canSubmit = configuredStoryData !== null;
    
    configureBtn.disabled = !canConfigure;
    submitBtn.disabled = !canSubmit;
}

// Configure Words 버튼 클릭
document.getElementById('configureBtn').addEventListener('click', async function() {
    if (!selectedTemplate || selectedSounds.length === 0) {
        alert('Please select a template and sounds.');
        return;
    }

    const configureBtn = document.getElementById('configureBtn');
    const loading = document.getElementById('loading');

    // UI 상태 변경
    configureBtn.disabled = true;
    loading.style.display = 'block';
    loading.querySelector('p').textContent = 'Configuring words...';

    try {
        const response = await fetch('/api/story/configure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                template_id: selectedTemplate.id,
                target_sounds: selectedSounds
            })
        });

        const data = await response.json();

        if (data.success) {
            configuredStoryData = data.story_data;
            showConfiguredWords(data.story_data);
            updateButtons();
        } else {
            alert('Word configuration failed: ' + data.message);
        }
    } catch (error) {
        console.error('Word configuration error:', error);
        alert('An error occurred while configuring words.');
    } finally {
        loading.style.display = 'none';
        configureBtn.disabled = false;
    }
});

// Configure된 스토리 요소들 표시
function showConfiguredWords(storyData) {
    const configuredPreviewSection = document.getElementById('configuredPreviewSection');
    const storyElements = document.getElementById('storyElements');
    
    storyElements.innerHTML = '';
    editedWords = {}; // 수정된 단어 초기화
    
    // Characters
    if (storyData.characters && storyData.characters.length > 0) {
        const characterCategoryContainer = createElementCategory('👥 Characters', 'character');
        storyData.characters.forEach(character => {
            if (character.name.startsWith('{') && character.name.endsWith('}')) {
                const wordSpan = createEditableWordSpan(
                    character.name, 
                    character.name.replace(/[{}]/g, ''), 
                    'element-word character editable'
                );
                characterCategoryContainer.appendChild(wordSpan);
            }
        });
        storyElements.appendChild(characterCategoryContainer.parentElement);
    }
    
    // Places
    if (storyData.places && storyData.places.length > 0) {
        const placeCategoryContainer = createElementCategory('🏠 Places', 'place');
        storyData.places.forEach(place => {
            if (place.name.startsWith('{') && place.name.endsWith('}')) {
                const wordSpan = createEditableWordSpan(
                    place.name, 
                    place.name.replace(/[{}]/g, ''), 
                    'element-word place editable'
                );
                placeCategoryContainer.appendChild(wordSpan);
            }
        });
        storyElements.appendChild(placeCategoryContainer.parentElement);
    }
    
    // Target Words (from scenes)
    const targetWords = new Set();
    if (storyData.scenes) {
        storyData.scenes.forEach(scene => {
            if (scene.target_words) {
                scene.target_words.forEach(word => {
                    if (word.startsWith('{') && word.endsWith('}')) {
                        targetWords.add(word);
                    }
                });
            }
        });
    }
    
    if (targetWords.size > 0) {
        const targetWordCategoryContainer = createElementCategory('🎯 Target Words', 'target-word');
        targetWords.forEach(word => {
            const wordSpan = createEditableWordSpan(
                word, 
                word.replace(/[{}]/g, ''), 
                'element-word target-word editable'
            );
            targetWordCategoryContainer.appendChild(wordSpan);
        });
        storyElements.appendChild(targetWordCategoryContainer.parentElement);
    }
    
    // Interaction Words (from dialogue prompts)
    const interactionWords = new Set();
    if (storyData.scenes) {
        storyData.scenes.forEach(scene => {
            if (scene.dialogue_templates) {
                scene.dialogue_templates.forEach(dialogue => {
                    const matches = dialogue.prompt.match(/\{interaction_word[^}]*\}/g);
                    if (matches) {
                        matches.forEach(match => interactionWords.add(match));
                    }
                });
            }
        });
    }
    
    if (interactionWords.size > 0) {
        const interactionWordCategoryContainer = createElementCategory('⚡ Interaction Words', 'interaction-word');
        interactionWords.forEach(word => {
            const wordSpan = createEditableWordSpan(
                word, 
                word.replace(/[{}]/g, ''), 
                'element-word interaction-word editable'
            );
            interactionWordCategoryContainer.appendChild(wordSpan);
        });
        storyElements.appendChild(interactionWordCategoryContainer.parentElement);
    }
    
    configuredPreviewSection.style.display = 'block';
}

// 요소 카테고리 생성
function createElementCategory(title, type) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'element-category';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'element-category-title';
    titleDiv.innerHTML = `<span class="element-category-icon">${title.split(' ')[0]}</span><span>${title.split(' ').slice(1).join(' ')}</span>`;
    
    const wordsDiv = document.createElement('div');
    wordsDiv.className = 'element-words';
    
    categoryDiv.appendChild(titleDiv);
    categoryDiv.appendChild(wordsDiv);
    
    return wordsDiv; // wordsDiv를 반환하여 단어들을 추가할 수 있도록 함
}

// 편집 가능한 단어 스팬 생성
function createEditableWordSpan(placeholder, displayText, className) {
    const wordSpan = document.createElement('span');
    wordSpan.className = className;
    wordSpan.textContent = displayText;
    wordSpan.dataset.placeholder = placeholder;
    
    // 더블클릭 이벤트로 편집 모드 진입
    wordSpan.addEventListener('dblclick', function() {
        enterEditMode(wordSpan, placeholder);
    });
    
    return wordSpan;
}

// 편집 모드 진입
function enterEditMode(wordSpan, placeholder) {
    if (wordSpan.classList.contains('editing')) return;
    
    const currentText = wordSpan.textContent;
    wordSpan.classList.add('editing');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = currentText;
    
    wordSpan.innerHTML = '';
    wordSpan.appendChild(input);
    
    input.focus();
    input.select();
    
    // Enter 키나 포커스 아웃으로 편집 완료
    const finishEdit = () => {
        const newValue = input.value.trim();
        if (newValue && newValue !== currentText) {
            editedWords[placeholder] = newValue;
            wordSpan.textContent = newValue;
        } else {
            wordSpan.textContent = currentText;
        }
        wordSpan.classList.remove('editing');
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEdit();
        } else if (e.key === 'Escape') {
            wordSpan.textContent = currentText;
            wordSpan.classList.remove('editing');
        }
    });
    
    input.addEventListener('blur', finishEdit);
}



// 스토리 생성 제출
document.getElementById('submitBtn').addEventListener('click', async function() {
    if (!configuredStoryData) {
        alert('Please configure words first.');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const successMessage = document.getElementById('successMessage');

    // UI 상태 변경
    submitBtn.disabled = true;
    loading.style.display = 'block';
    loading.querySelector('p').textContent = 'Creating story with images...';
    successMessage.style.display = 'none';

    try {
        // 수정된 단어들을 스토리 데이터에 적용
        const updatedStoryData = applyEditedWords(configuredStoryData);
        
        const response = await fetch('/api/story/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                story_data: updatedStoryData
            })
        });

        const data = await response.json();

        if (data.success) {
            successMessage.style.display = 'block';
            
            // 스토리 목록 새로고침
            setTimeout(() => {
                loadStoryList();
            }, 1000);
            
            // 폼 리셋
            resetForm();
        } else {
            alert('Story creation failed: ' + data.message);
        }
    } catch (error) {
        console.error('Story creation error:', error);
        alert('An error occurred while creating the story.');
    } finally {
        loading.style.display = 'none';
        submitBtn.disabled = false;
    }
});

// 수정된 단어들을 스토리 데이터에 적용
function applyEditedWords(storyData) {
    if (Object.keys(editedWords).length === 0) {
        return storyData; // 수정된 단어가 없으면 원본 반환
    }

    const updatedData = JSON.parse(JSON.stringify(storyData)); // 깊은 복사

    // Characters 업데이트
    if (updatedData.characters) {
        updatedData.characters.forEach(character => {
            if (editedWords[character.name]) {
                character.name = editedWords[character.name];
            }
        });
    }

    // Places 업데이트
    if (updatedData.places) {
        updatedData.places.forEach(place => {
            if (editedWords[place.name]) {
                place.name = editedWords[place.name];
            }
        });
    }

    // Scenes 업데이트
    if (updatedData.scenes) {
        updatedData.scenes.forEach(scene => {
            // Scene characters 업데이트
            if (scene.characters) {
                scene.characters = scene.characters.map(char => {
                    return editedWords[char] || char;
                });
            }

            // Scene places 업데이트
            if (scene.places) {
                scene.places = scene.places.map(place => {
                    return editedWords[place] || place;
                });
            }

            // Scene target_words 업데이트
            if (scene.target_words) {
                scene.target_words = scene.target_words.map(word => {
                    return editedWords[word] || word;
                });
            }

            // Scene description 업데이트
            if (scene.description) {
                Object.keys(editedWords).forEach(placeholder => {
                    scene.description = scene.description.replace(placeholder, editedWords[placeholder]);
                });
            }

            // Dialogue templates 업데이트
            if (scene.dialogue_templates) {
                scene.dialogue_templates.forEach(dialogue => {
                    // Character 업데이트
                    if (editedWords[dialogue.character]) {
                        dialogue.character = editedWords[dialogue.character];
                    }

                    // Prompt 업데이트
                    if (dialogue.prompt) {
                        Object.keys(editedWords).forEach(placeholder => {
                            dialogue.prompt = dialogue.prompt.replace(placeholder, editedWords[placeholder]);
                        });
                    }
                });
            }
        });
    }

    return updatedData;
}

// 폼 리셋
function resetForm() {
    // 템플릿 선택 해제
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
    selectedTemplate = null;

    // 발음 선택 해제
    document.querySelectorAll('.sound-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    selectedSounds = [];

    // 미리보기 숨기기
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('configuredPreviewSection').style.display = 'none';

    // Configure된 데이터 초기화
    configuredStoryData = null;
    editedWords = {};

    // 버튼 비활성화
    updateButtons();
}