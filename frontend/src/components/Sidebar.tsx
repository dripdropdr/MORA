import { useState } from 'react';
import { soundDescriptions, mouthImageForSound } from '../utils/resource';
import { useNotifications } from '../hooks/useNotifications.tsx';
import { playSoundDescription } from '../api/story';

export function MouthShapes({ sounds, userId, storyId, storyMode }: { sounds: string[]; userId: string; storyId: string; storyMode: string; }) {
  const { push: notify } = useNotifications();

  // TTS 함수 - Socket.IO가 자동으로 오디오를 재생하므로 API만 호출
  const onPlayDesc = async (text: string) => {
    try {
      notify('info', '🔊 Generating audio...');
      
      const response = await playSoundDescription({ 
        user_id: userId, 
        story_id: storyId, 
        story_mode: storyMode, 
        description: text 
      });
      
      if (!response.success) {
        notify('error', 'Failed to start audio generation');
      }
      // Socket.IO 리스너(Story.tsx의 onAnyAudioReady)가 자동으로 오디오를 재생함
      
    } catch (error) {
      console.error('TTS error:', error);
      notify('error', 'Audio generation failed');
    }
  }; 
  
  if (!sounds?.length) return null;
    const normalized = sounds.map((s)=>s.toLowerCase());
  
    return (
      <div className="mouth-sidebar">
        <div className="mouth-sidebar-header">
          <div className="mouth-sidebar-title">👄 Mouth Shapes</div>
          <button className="mouth-sidebar-toggle" onClick={(e)=>{(e.currentTarget.closest('.mouth-sidebar') as HTMLElement)?.classList.toggle('collapsed')}}>▶</button>
        </div>
        <div className="mouth-sidebar-content">
          <div id="mouthImagesGrid" className="mouth-images-grid">
            {normalized.map((s, i) => {
              const src = mouthImageForSound(s);
              if (!src) return null;
              return (
                <div key={i} className="mouth-image-item" onClick={()=>selectMouthImage(s, i, onPlayDesc)}>
                  <img src={src} alt={`${s} mouth shape`} />
                  <div className="mouth-image-label">{s.toUpperCase()}</div>
                </div>
              );
            })}
          </div>
          <div id="soundInfo" className="sound-info">
            <h4>🎯 Multiple Target Sounds</h4>
            <p><strong>Total Sounds:</strong> {normalized.length}</p>
            <p><strong>Sounds:</strong> {normalized.map(s=>s.toUpperCase()).join(', ')}</p>
            {normalized[0] && soundDescriptions[normalized[0]] && (
                <p>Click on any mouth image to see detailed information</p>
            )}
        </div>
      </div>
    </div>
  );
}

function selectMouthImage(sound: string, index: number, onPlayDesc: (text: string)=>void) {
  const allItems = document.querySelectorAll('.mouth-image-item');
  allItems.forEach(item => item.classList.remove('active'));
  const selectedItem = document.querySelectorAll('.mouth-image-item')[index];
  if (selectedItem) {
      selectedItem.classList.add('active');
      updateSoundInfo(sound, onPlayDesc);
  }
}

// 소리 정보 업데이트
function updateSoundInfo(sound: string, onPlayDesc: (text: string)=>void) {
  const soundInfo = document.getElementById('soundInfo') as HTMLElement;
  const soundDescription = soundDescriptions[sound];
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
              <button class="sound-speaker-btn" data-type="description" title="Play description">🔊</button>
          </div>
          <p class="sound-section-content">${soundDescription.description}</p>
      </div>
      <div class="sound-gesture-section">
          <div class="sound-section-header">
              <span class="sound-section-icon">✋</span>
              <span class="sound-section-title">Hand gesture tip</span>
              <button class="sound-speaker-btn" data-type="gesture" title="Play gesture">🔊</button>
          </div>
          <p class="sound-section-content">${soundDescription.gesture}</p>
      </div>
  `;
  
  // 이벤트 리스너 추가
  const descriptionBtn = soundInfo.querySelector('.sound-description-section .sound-speaker-btn');
  const gestureBtn = soundInfo.querySelector('.sound-gesture-section .sound-speaker-btn');
  
  if (descriptionBtn) {
      descriptionBtn.addEventListener('click', () => {
          onPlayDesc(soundDescription.description);
      });
  }
  
  if (gestureBtn) {
      gestureBtn.addEventListener('click', () => {
          onPlayDesc(soundDescription.gesture);
      });
  }
}


export function TargetWordsSidebar({ words, onPractice, onRepeatOnce }: {
    words: string[];
    onPractice: (cleanWord: string) => void;
    onRepeatOnce: (cleanWord: string) => void;
  }) {
    const [highlight, setHighlight] = useState<string | null>(null);
    const { push } = useNotifications();
  
    const pronounce = (raw: string) => {
      const clean = raw.replace(/[{}]/g, '');
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'en-US'; u.rate = 0.8; u.pitch = 1.0;
        window.speechSynthesis.speak(u);
        setHighlight(clean);
        onRepeatOnce?.(clean);
      } else {
        push('warning', 'Browser TTS not available.');
      }
    };
  
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">📚 Target Words</div>
          <button className="sidebar-toggle" onClick={(e)=>{(e.currentTarget.closest('.sidebar') as HTMLElement)?.classList.toggle('collapsed')}}>▶</button>
        </div>
        <div className="sidebar-content">
          <div id="wordCount" className="word-count">{words?.length || 0} words</div>
          <ul id="wordList" className="word-list">
            {(words || []).map((w, idx) => {
              const clean = w.replace(/[{}]/g, '');
              return (
                <li key={idx} className={`word-item ${highlight === clean ? 'highlighted' : ''}`} onClick={() => setHighlight(clean)}>
                  <span className="word-text">{clean}</span>
                  <div className="word-buttons">
                    <button className="word-repeat-btn" title="Repeat pronunciation" onClick={(e)=>{ e.stopPropagation(); pronounce(clean) }}>🔊</button>
                    <button className="word-record-btn" title="Practice pronunciation" onClick={(e)=>{ e.stopPropagation(); onPractice(clean); }}>🎤</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }