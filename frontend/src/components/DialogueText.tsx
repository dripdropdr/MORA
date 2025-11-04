// src/components/DialogueText.tsx
import { useMemo } from 'react';
import { convertTargetWordsToButtons, fillBlanksWithPronounced } from '../utils/text.tsx';

export function DialogueText({ 
  character, 
  prompt, 
  text, 
  wordsInDialogue,
  pronouncedWords,
  targetWords, 
  onClickWord,
  onSelectWordChoice
}: {
  character?: string; 
  prompt?: string; 
  text?: string; 
  wordsInDialogue?: string[];
  pronouncedWords?: string[];
  targetWords: string[]; 
  onClickWord: (w: string) => void;
  onSelectWordChoice?: (w: string) => void;
}) {
  const content = useMemo(() => {
    const base = text || prompt || '';
    // Word mode: if there is a blank and there are pronounced words, fill the blank with the pronounced words
    if (pronouncedWords && pronouncedWords.length > 0 && /_{3,}/.test(base)) {
      return fillBlanksWithPronounced(base, pronouncedWords, onClickWord);
    }
    // convert target words to buttons
    return convertTargetWordsToButtons(base, targetWords, onClickWord);
  }, [text, prompt, targetWords, onClickWord]);

  const isVisible = !!(text || prompt);

  return (
    <div id="dialogue-overlay" className={`dialogue-overlay ${isVisible ? 'show' : ''}`}>
      <div className="dialogue-content">
        <div id="dialogue-character" className="dialogue-character">
          {character || ''}
        </div>
        <div id="dialogue-text" className="dialogue-text">
          {/* Word Mode: words_in_dialogue 버튼들을 먼저 표시 */}
          {wordsInDialogue && wordsInDialogue.length > 0 && (
            <div className="words-in-dialogue-buttons">
              {wordsInDialogue.map((word, i) => {
                const cleanWord = word.replace(/[{}]/g, '');
                return (
                  <button
                    key={i}
                    className="word-choice-btn"
                    onClick={() => onSelectWordChoice?.(cleanWord)}
                  >
                    {cleanWord}
                  </button>
                );
              })}
            </div>
          )}
          {/* 대사/프롬프트 텍스트 (target words는 버튼으로 변환) */}
          {content}
        </div>
      </div>
    </div>
  );
}