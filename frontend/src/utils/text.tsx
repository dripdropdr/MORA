import { type JSX } from 'react';

export function convertTargetWordsToButtons(text: string, targetWords: string[], onClickWord: (word: string) => void): JSX.Element {
    const processed: (string | JSX.Element)[] = [];
    
    // convert target words with curly braces to buttons
    const parts = text.split(/(\{[^}]+\})/g);
    parts.forEach((part, i) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        const clean = part.slice(1, -1);
        processed.push(
          <button key={i} className="target-word-btn" onClick={() => onClickWord(clean)}>{clean}</button>
        );
      } else {
        if (part && targetWords.length > 0) {
          const converted = convertPlainTextWords(part, targetWords, onClickWord, i);
          processed.push(...converted);
        } else {
          processed.push(part);
        }
      }
    });
    // 추가: 대사 내 일반 단어를 버튼화하려면 targetWords 전개 후 정규식 치환 로직을 확장
    return <>{processed}</>;
  }

  // 일반 텍스트에서 targetWords를 찾아 버튼으로 변환하는 헬퍼 함수
function convertPlainTextWords(text: string, targetWords: string[], onClickWord: (word: string) => void, baseIndex: number): (string | JSX.Element)[] {
  if (!text || targetWords.length === 0) return [text];
  
  const result: (string | JSX.Element)[] = [];
  let remainingText = text;
  let currentIndex = 0;
  
  // targetWords를 길이 순으로 정렬 (긴 단어부터 매칭하여 부분 매칭 방지)
  const sortedWords = [...targetWords]
    .map(w => w.replace(/[{}]/g, ''))  // 중괄호 제거
    .filter(w => w)  // 빈 문자열 제거
    .sort((a, b) => b.length - a.length);
  
  while (remainingText) { //loop through the text until all words are matched
    let matched = false;
    
    for (const word of sortedWords) { //regex matching for finding target words in the text
      const regex = new RegExp(`\\b(${escapeRegex(word)})\\b`, 'i');
      const match = remainingText.match(regex);
      
      if (match && match.index !== undefined) {
        if (match.index > 0) { result.push(remainingText.substring(0, match.index));}
        
        result.push( // convert matched word to a button
          <button key={`${baseIndex}-${currentIndex++}`} className="target-word-btn" onClick={() => onClickWord(match[1])}
            >{match[1]}</button>
        );
        // continue with the remaining text
        remainingText = remainingText.substring(match.index + match[1].length);
        matched = true;
        break;
      }
    }
    if (!matched) { // if no matched word, add the entire text and exit
      if (remainingText) {
        result.push(remainingText);
      }
      break;
    }
  }
  
  return result.length > 0 ? result : [text];
}

// Word mode: 빈 칸을 발음한 단어 버튼으로 채우는 함수
export function fillBlanksWithPronounced(text: string, pronouncedWords: string[], onClickWord: (word: string) => void): JSX.Element {
  const processed: (string | JSX.Element)[] = [];
  const blankRegex = /_{3,}/g; // 3 or more consecutive underscores
  
  let lastIndex = 0;
  let blankIndex = 0;
  let match;
  
  while ((match = blankRegex.exec(text)) !== null) {
    
    if (match.index > lastIndex) {// add the text before the blank
      processed.push(text.substring(lastIndex, match.index));
    }
    
    if (blankIndex < pronouncedWords.length) { // if there is a pronounced word, fill it with a button, otherwise keep the blank
      const word = pronouncedWords[blankIndex].replace(/[{}]/g, '');
      processed.push(
        <button 
          key={`filled-${blankIndex}`} 
          className="target-word-btn filled-word-btn" 
          onClick={() => onClickWord(word)}
        >
          {word}
        </button>
      );
    } else {
      processed.push(match[0]); // 빈 칸 유지
    }
    
    lastIndex = match.index + match[0].length;
    blankIndex++;
  }
  
  // 나머지 텍스트 추가
  if (lastIndex < text.length) {
    processed.push(text.substring(lastIndex));
  }
  return <>{processed}</>;
}

// regex special character escape helper function
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
  
export function fillFirstBlankWith(word: string, html: string): string {
    return html.replace(/_{3,}/, `<button class="target-word-btn filled-word-btn">${word}</button>`);
  }