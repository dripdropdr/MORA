// frontend/src/pages/Story.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getStoryState, 
  nextDialogue as apiNextDialogue, 
  sendUserInput as apiSendUserInput, 
  nextScene as apiNextScene,
  selectDestination as apiSelectDestination,
  chooseItem as apiChooseItem,
  exploreItem as apiExploreItem,
  pronounceWord as apiPronounceWord,
  uploadAndTranscribe
} from '../api/story';
import { getUserData } from '../utils/storage';
import { useStorySocket } from '../hooks/useStorySocket';
import { useAudio, useRecording } from '../hooks/useAudioandRecord';

import { TargetWordsSidebar, MouthShapes } from '../components/Sidebar';
import { DialogueText } from '../components/DialogueText';
import { InteractionLayer } from '../components/InteractionLayer';
import { PronunciationModal } from '../components/PronunciationModal';
import { NotificationsProvider, useNotifications } from '../hooks/useNotifications.tsx';
import { NotificationHost } from '../components/NotificationHost.tsx';
import { firstSoundOf } from '../utils/resource';

import type { DialogueResponse, StoryStateResponse } from '../types/story';
import '../styles/Story.css';
import '../styles/sidebar.css';

function StoryInner() {
  const nav = useNavigate();
  const { playFromUrl } = useAudio();
  const { push: notify } = useNotifications();

  const userData = useMemo(() => getUserData(), []);
  const [storyInfo, setStoryInfo] = useState<StoryStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogueOverlay, setDialogueOverlay] = useState<{ character?: string; text?: string; prompt?: string; wordsInDialogue?: string[] } | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [input, setInput] = useState('');
  const [wordsInDialogue, setWordsInDialogue] = useState<string[]>([]);
  const [pronouncedWords, setPronounced] = useState<string[]>([]);
  const [pronunciationModal, setPronunciationModal] = useState<{ sentence: string; isSidebarPractice: boolean; onSuccess?: () => void } | null>(null);

  const userId = userData?.userId;
  const storyId = userData?.currentStory?.storyId;
  const storyMode = userData?.currentStory?.storyMode || 'sentence';

  useEffect(() => {
    if (!userId || !storyId) {
      nav('/start');
      return;
    }
    (async () => {
      try {
        const data = await getStoryState({ user_id: userId, story_id: storyId, story_mode: storyMode });
        if (!data.success) {
          nav('/start');
          return;
        }
        setStoryInfo(data);
        primeOverlayFromState(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [nav, userId, storyId, storyMode]);

  // Setup the dialogue/interaction based on the story state
  const primeOverlayFromState = (data: StoryStateResponse) => {
    const turn = data.story_info?.current_turn;
    if (turn?.type === 'character_dialogue') {
      setDialogueOverlay({ character: turn.character, text: turn.text });
    } else if (turn?.type === 'user_turn') {
      const words = turn.words_in_dialogue || [];
      setWordsInDialogue(words);
      setPronounced([]);
      setDialogueOverlay({ 
        character: 'Instruction', 
        prompt: turn.prompt, 
        text: turn.text,
        wordsInDialogue: words
      });
    } else {
      setDialogueOverlay(null);
    }
  };

  const handleStoryStateUpdate = useCallback((d: any) => {
    setStoryInfo((prev) => prev ? { 
      ...prev, 
      story_info: { 
        ...prev.story_info, 
        current_dialogue: d.current_dialogue,
        has_next_dialogue: d.has_next_dialogue,
        is_scene_complete: d.is_scene_complete,
        has_next_scene: d.has_next_scene,
        is_story_complete: d.is_story_complete
      } 
    } as any : prev);
  }, []);

  const handleAudioStatusUpdate = useCallback((d: any) => {
    setStatusText(d.audio_generating ? `🎵 Generating: ${d.current_audio_task || ''}` : '');
  }, []);

  const handleAnyAudioReady = useCallback(async (url: string) => {
    await playFromUrl(url);
    setStatusText('');
  }, [playFromUrl]);

  const { emitRequestStoryUpdate } = useStorySocket({
    onStoryStateUpdate: handleStoryStateUpdate,
    onAudioStatusUpdate: handleAudioStatusUpdate,
    onAnyAudioReady: handleAnyAudioReady,
  });

  useEffect(() => {
    if (userId && storyId) {
      emitRequestStoryUpdate({ user_id: userId, story_id: storyId, story_mode: storyMode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, storyId, storyMode]);

  // If user click the next dialogue button, request next dialogue from the server
  const nextDialogue = async () => {
    if (!userId || !storyId) return;
    setStatusText('⏭️ Next dialogue...');
    const data = await apiNextDialogue({ user_id: userId, story_id: storyId, story_mode: storyMode });
    handleDialogue(data, 'next');
    setStatusText('');
  };

  // Send user input to the server
  const sendUserInput = async () => {
    if (!userId || !storyId || !input.trim()) return;
    
    // Word mode: 빈칸 채우기 로직
    if (storyMode === 'word' && wordsInDialogue.length > 0) {
      const matched = wordsInDialogue.find(w => w.replace(/[{}]/g, '').toLowerCase() === input.toLowerCase());
      
      if (matched) {
        // 단어 맞음: 빈칸 채우기
        setPronounced(prev => [...prev, matched]);
        setWordsInDialogue(prev => prev.filter(w => w !== matched));
        setInput('');
        notify('success', `Great! Word "${matched.replace(/[{}]/g, '')}" added.`);
        
        // 모든 단어를 발음했는지 확인
        const remaining = wordsInDialogue.filter(w => w !== matched);
        if (remaining.length === 0) {
          // 모든 단어 완료: 서버에 전송
          const allWords = [...pronouncedWords, matched].map(w => w.replace(/[{}]/g, '')).join(' ');
          setStatusText('✉️ Processing all words...');
          const data = await apiSendUserInput({ user_id: userId, story_id: storyId, story_mode: storyMode, input: allWords });
          if (data?.success && data?.next_dialogue) {
            handleDialogue(data.next_dialogue as DialogueResponse, 'input');
            setInput('');
            setStatusText('');
            notify('success', 'All words completed!');
          }
        }
        return;
      } else {
        // 틀린 단어
        notify('warning', `Please say one of: ${wordsInDialogue.map(w => w.replace(/[{}]/g, '')).join(', ')}`);
        return;
      }
    }
    
    // Sentence mode 또는 일반 입력
    setStatusText('✉️ Processing...');
    const data = await apiSendUserInput({ user_id: userId, story_id: storyId, story_mode: storyMode, input });
    
    if (data?.success && data?.next_dialogue) {
      handleDialogue(data.next_dialogue as DialogueResponse, 'input');
      setInput('');
      setStatusText('');
      return;
    }
    
    // Retry 필요 (missing words)
    if (data?.retry_required && data?.missing_words) {
      notify('warning', `Please include: ${data.missing_words.join(', ')}`);
      setStatusText('');
      return;
    }
    
    setStatusText('');
  };

  // If user click the next scene button, request next scene from the server
  const goNextScene = async () => {
    if (!userId || !storyId) return;
    setStatusText('🎬 Moving to next scene...');
    const data = await apiNextScene({ user_id: userId, story_id: storyId, story_mode: storyMode });
    if (data?.success) {
      // 씬 정보 반영
      const refreshed = await getStoryState({ user_id: userId, story_id: storyId, story_mode: storyMode });
      if (refreshed.success) {
        setStoryInfo(refreshed);
        primeOverlayFromState(refreshed);
      }
    }
    setStatusText('');
  };

  // Setup the dialogue/interaction based on the dialogue response from the server
  const handleDialogue = (data: DialogueResponse, _ctx: 'next' | 'input') => {
    if (data.type === 'character_dialogue') {
      setDialogueOverlay({ character: data.character, text: data.text });
      setStoryInfo((s) => s ? ({
        ...s,
        story_info: { 
          ...s.story_info, 
          current_dialogue: data.current_dialogue ?? s.story_info.current_dialogue, 
          total_dialogues_in_scene: data.total_dialogues ?? s.story_info.total_dialogues_in_scene,
          has_next_dialogue: data.has_next_dialogue ?? s.story_info.has_next_dialogue,
          is_scene_complete: data.is_scene_complete ?? s.story_info.is_scene_complete,
          has_next_scene: data.has_next_scene ?? s.story_info.has_next_scene,
          is_story_complete: data.is_story_complete ?? s.story_info.is_story_complete
        },
        image: data.image || s.image  // Update image for character dialogue
      }) : s);
    } else if (data.type === 'user_turn') {
      const words = data.words_in_dialogue || [];
      setWordsInDialogue(words);
      setPronounced([]);
      setDialogueOverlay({ 
        character: 'Instruction', 
        prompt: data.prompt, 
        text: data.text,
        wordsInDialogue: words
      });
      setStoryInfo((s) => s ? ({
        ...s,
        story_info: { 
          ...s.story_info, 
          current_dialogue: data.current_dialogue ?? s.story_info.current_dialogue, 
          total_dialogues_in_scene: data.total_dialogues ?? s.story_info.total_dialogues_in_scene,
          has_next_dialogue: data.has_next_dialogue ?? s.story_info.has_next_dialogue,
          is_scene_complete: data.is_scene_complete ?? s.story_info.is_scene_complete,
          has_next_scene: data.has_next_scene ?? s.story_info.has_next_scene,
          is_story_complete: data.is_story_complete ?? s.story_info.is_story_complete,
          current_turn: data as any
        },
        image: data.image || s.image,
        btn_words: data.btn_words || s.btn_words,
        btn_image: data.btn_image || s.btn_image
      }) : s);
    } else if (data.type === 'scene_complete') {
      setStatusText('🎉 Scene complete!');
      notify('info', 'Current scene is completed!');
    }
  };

  // 인터랙션 핸들러들
  const handleSelectDestination = async (dest: string) => {
    if (!userId || !storyId) return;
    
    // Sentence mode: 발음 프롬프트 표시
    if (storyMode === 'sentence') {
      const sentence = `I want to go ${dest}.`;
      setPronunciationModal({ 
        sentence, 
        isSidebarPractice: false,
        onSuccess: async () => {
          // 발음 완료 후 서버에 선택 전송
          try {
            const data = await apiSelectDestination({ user_id: userId, story_id: storyId, story_mode: storyMode, selected_destination: dest });
            if (data?.success) {
              notify('success', `Destination "${dest}" selected!`);
              if (data.next_dialogue) {
                handleDialogue(data.next_dialogue as DialogueResponse, 'input');
              }
            }
          } catch (e) {
            notify('error', 'Failed to select destination');
          }
        }
      });
      return;
    }
    
    // Word mode: 바로 서버 전송 후 단어 발음 프롬프트
    setStatusText(`🎯 Selecting destination: ${dest}...`);
    try {
      const data = await apiSelectDestination({ user_id: userId, story_id: storyId, story_mode: storyMode, selected_destination: dest });
      if (data?.success) {
        notify('success', `Destination "${dest}" selected!`);
        if (data.next_dialogue) {
          handleDialogue(data.next_dialogue as DialogueResponse, 'input');
        }
        // Word 발음 프롬프트
        setPronunciationModal({ sentence: dest, isSidebarPractice: false });
      }
    } catch (e) {
      notify('error', 'Failed to select destination');
    } finally {
      setStatusText('');
    }
  };

  const handleChooseItem = async (item: string) => {
    if (!userId || !storyId) return;
    
    // 먼저 단어 발음
    try {
      await apiPronounceWord({ user_id: userId, story_id: storyId, story_mode: storyMode, word: item });
    } catch (e) {
      console.error('Pronounce error:', e);
    }
    
    // Sentence mode: 발음 프롬프트 표시
    if (storyMode === 'sentence') {
      const sentence = `I choose ${item}.`;
      setPronunciationModal({ 
        sentence, 
        isSidebarPractice: false,
        onSuccess: async () => {
          try {
            const data = await apiChooseItem({ user_id: userId, story_id: storyId, story_mode: storyMode, chosen_item: item });
            if (data?.success) {
              notify('success', `Item "${item}" chosen!`);
              if (data.next_dialogue) {
                handleDialogue(data.next_dialogue as DialogueResponse, 'input');
              }
            }
          } catch (e) {
            notify('error', 'Failed to choose item');
          }
        }
      });
      return;
    }
    
    // Word mode: 서버 전송 후 단어 발음 프롬프트
    setStatusText(`🎯 Choosing item: ${item}...`);
    try {
      const data = await apiChooseItem({ user_id: userId, story_id: storyId, story_mode: storyMode, chosen_item: item });
      if (data?.success) {
        notify('success', `Item "${item}" chosen!`);
        if (data.next_dialogue) {
          handleDialogue(data.next_dialogue as DialogueResponse, 'input');
        }
        setPronunciationModal({ sentence: item, isSidebarPractice: false });
      }
    } catch (e) {
      notify('error', 'Failed to choose item');
    } finally {
      setStatusText('');
    }
  };

  const handleExploreItem = async (item: string) => {
    if (!userId || !storyId) return;
    const available_items = storyInfo?.btn_words || [];
    setStatusText(`🔍 Exploring: ${item}...`);
    try {
      const data = await apiExploreItem({ user_id: userId, story_id: storyId, story_mode: storyMode, item, available_items });
      if (data?.success && data.dialogue) {
        notify('success', `Exploring "${item}"`);
        // 탐색 대사 표시
        setDialogueOverlay({ character: data.dialogue.character, text: data.dialogue.text });
        
        // 탐색 후 발음 프롬프트 표시
        const sentence = storyMode === 'sentence' ? `I can see ${item}.` : item;
        setPronunciationModal({ sentence, isSidebarPractice: false });
      }
    } catch (e) {
      notify('error', 'Failed to explore item');
    } finally {
      setStatusText('');
    }
  };

  // Need to set up the target word sidebar using firstsound
  const handleWordClick = async (word: string) => {
    if (!userId || !storyId) return;
    const firstSound = firstSoundOf(word);
    try {
      await apiPronounceWord({ user_id: userId, story_id: storyId, story_mode: storyMode, word, target_sound: firstSound });
      notify('info', `Pronouncing: ${word}`);
    } catch (e) {
      console.error('Pronounce error:', e);
    }
  };

  const handleWordChoiceClick = (word: string) => {
    // Word mode에서 words_in_dialogue 버튼 클릭 시 input에 채움
    setInput(word);
  };

  // 녹음 업로드 함수
  const uploadRecording = async (blob: Blob) => {
    if (!userId || !storyId) return;
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');
    fd.append('user_id', userId);
    fd.append('story_id', storyId);
    fd.append('story_mode', storyMode);
    try {
      const data = await uploadAndTranscribe(fd);
      if (data?.success && data.transcribed_text) {
        setInput(data.transcribed_text);
        notify('success', '🎤 Speech recognized!');
      } else {
        notify('error', 'Transcription failed');
      }
    } catch (e) {
      notify('error', 'Upload failed');
    }
  };

  const { recording, start: startRec, stop: stopRec } = useRecording(uploadRecording);

  const toggleRecording = async () => {
    if (recording) {
      await stopRec();
    } else {
      try {
        await startRec();
        notify('info', '🎤 Recording... Click again to stop.');
      } catch (e: any) {
        notify('error', `Recording failed: ${e.message}`);
      }
    }
  };

  if (!userId || !storyId) return null;
  if (loading) return <div className="container"><div className="header"><h1>Loading...</h1></div></div>;

  const imgSrc = storyInfo?.image ? `data:image/png;base64,${storyInfo.image}` : undefined;
  const targetSounds = (storyInfo?.story_info?.target_sounds || [])
    .map(s => s.replace('words_with_', '').replace('_initial', '').replace('_final', ''));

  // Calculate button states based on progress flags
  const canProceedToNextDialogue = storyInfo?.story_info?.has_next_dialogue ?? false;
  const canProceedToNextScene = (storyInfo?.story_info?.is_scene_complete ?? false) && 
                                 (storyInfo?.story_info?.has_next_scene ?? false);
  const isStoryComplete = storyInfo?.story_info?.is_story_complete ?? false;
  // Calculate input section visibility based on current turn type. Input section should be enabled only for user_turn without interaction
  const currentTurn = storyInfo?.story_info?.current_turn;
  const canShowInputSection = currentTurn?.type === 'user_turn' && !currentTurn?.interaction;

  return (
    <div className="container" id="main-container">
      <div className="header">
        <div className="header-actions">
          <a href="/start" className="header-btn"><span>🏁</span><span>Back to Start</span></a>
          <a href="/recordings" className="header-btn"><span>🎤</span><span>Recordings</span></a>
        </div>
      </div>

      <div className="main-layout">
        {/* 왼쪽: Target Words */}
        <div className="left-sidebar">
          <TargetWordsSidebar
            words={storyInfo?.story_info?.target_words || []}
            onPractice={(clean) => { 
              setPronunciationModal({ sentence: clean, isSidebarPractice: true }); 
            }}
            onRepeatOnce={(_clean) => { /* 선택적 상태 표시 */ }}
          />
        </div>

        <div className="story-main">
          <div id="story-container" className="story-container">
            <div className="image-container">
              {!imgSrc && <div id="placeholder-image" className="placeholder-image">Let's start the story!</div>}
              {imgSrc && <img id="story-image" className="story-image" alt="Story" src={imgSrc} />}
              
              <DialogueText
                character={dialogueOverlay?.character}
                text={dialogueOverlay?.text}
                prompt={dialogueOverlay?.prompt}
                wordsInDialogue={dialogueOverlay?.wordsInDialogue}
                pronouncedWords={pronouncedWords}
                targetWords={storyInfo?.story_info?.target_words || []}
                onClickWord={handleWordClick}
                onSelectWordChoice={handleWordChoiceClick}
              />
              
              <InteractionLayer
                mode={storyInfo?.story_info?.current_turn?.interaction}
                words={storyInfo?.btn_words}
                btnImage={storyInfo?.btn_image}
                onSelectDestination={handleSelectDestination}
                onChooseItem={handleChooseItem}
                onExplore={handleExploreItem}
              />
            </div>

            <div className="controls-container">
              <div 
                id="input-section" 
                className="input-section" 
                style={{ display: canShowInputSection ? 'block' : 'none' }}
              >
                <div className="input-area">
                  <input 
                    type="text" 
                    id="user-input" 
                    className="user-input" 
                    placeholder="Type your answer or use voice..." 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendUserInput()}
                    disabled={!canShowInputSection}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={sendUserInput}
                    disabled={!canShowInputSection}
                  >
                    Send
                  </button>
                  <button 
                    className={`voice-btn ${recording ? 'recording' : ''}`}
                    title={recording ? 'Stop recording' : 'Start recording'}
                    onClick={toggleRecording}
                    disabled={!canShowInputSection}
                  >
                    {recording ? '⏹️' : '🎤'}
                  </button>
                </div>
              </div>

              <div className="button-group">
                <button 
                  id="next-btn" 
                  className="btn btn-primary" 
                  onClick={nextDialogue}
                  disabled={!canProceedToNextDialogue || isStoryComplete}
                >
                  ⏭️ Next dialogue
                </button>
                <button 
                  id="next-scene-btn" 
                  className="btn btn-secondary" 
                  onClick={goNextScene}
                  disabled={!canProceedToNextScene || isStoryComplete}
                >
                  🎬 Next scene
                </button>
              </div>

              {isStoryComplete && (
                <div className="story-complete-message" style={{ 
                  textAlign: 'center', 
                  padding: '20px', 
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#4CAF50'
                }}>
                  🎉 Story completed! Great job!
                </div>
              )}

              {statusText && (
                <div id="status-section" className="status-section">
                  <div className="status-text" id="status-text">{statusText}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: Mouth Shapes */}
        <div className="right-sidebar">
          <MouthShapes sounds={targetSounds} userId={userId} storyId={storyId} storyMode={storyMode}/>
        </div>
      </div>
      
      {/* 발음 모달 */}
      {pronunciationModal && userId && storyId && (
        <PronunciationModal
          sentence={pronunciationModal.sentence}
          userId={userId}
          storyId={storyId}
          storyMode={storyMode}
          isSidebarPractice={pronunciationModal.isSidebarPractice}
          onClose={() => setPronunciationModal(null)}
          onSuccess={async () => {
            // 인터랙션에서 전달한 커스텀 콜백 실행
            if (pronunciationModal.onSuccess) {
              await pronunciationModal.onSuccess();
            }
            setPronunciationModal(null);
          }}
        />
      )}
    </div>
  );
}

export function Story() {
  return (
    <NotificationsProvider>
      <StoryInner />
      <NotificationHost />
    </NotificationsProvider>
  );
}