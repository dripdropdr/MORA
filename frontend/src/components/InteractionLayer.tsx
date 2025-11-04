// src/components/InteractionLayer.tsx
import { useState } from 'react';

export function InteractionLayer({ 
  mode, 
  words, 
  btnImage, 
  onSelectDestination, 
  onChooseItem, 
  onExplore 
}: {
  mode?: 'select_destination' | 'choose' | 'click';
  words?: string[] | null;
  btnImage?: string | null;
  onSelectDestination?: (w: string) => void;
  onChooseItem?: (w: string) => void;
  onExplore?: (w: string) => void;
}) {
  const [clickedOnce, setClickedOnce] = useState<string | null>(null);

  if (!mode) return null;

  // Select Destination 인터랙션 (목적지 선택)
  if (mode === 'select_destination' && words?.length) {
    const handleDestinationClick = (w: string) => {
      if (clickedOnce === w) {
        // 두 번째 클릭: 선택 확정
        onSelectDestination?.(w);
        setClickedOnce(null);
      } else {
        // 첫 번째 클릭: 확인 팝업 표시
        setClickedOnce(w);
        // 3초 후 자동 해제
        setTimeout(() => setClickedOnce(null), 3000);
      }
    };

    return (
      <>
        <div id="destination-buttons-container" className="destination-buttons-container">
          {words.map((w, i) => (
            <button
              key={i}
              className={`destination-btn ${clickedOnce === w ? 'clicked-once' : ''}`}
              onClick={() => handleDestinationClick(w)}
            >
              {w}
            </button>
          ))}
        </div>
        {clickedOnce && (
          <>
            <div className="destination-popup-overlay show" />
            <div className="destination-popup show">
              <h3>🎯 Destination Selected!</h3>
              <p>If you want to select this destination, click one more time.</p>
            </div>
          </>
        )}
      </>
    );
  }

  // Choose Item 인터랙션 (아이템 선택 - 이미지 버튼)
  if (mode === 'choose' && words?.length && btnImage) {
    // btnImage는 base64 배열 형태로 전달됨
    let imageArray: string[] = [];
    try {
      // btnImage가 배열인지 딕셔너리인지 확인
      const parsed = JSON.parse(btnImage);
      if (Array.isArray(parsed)) {
        imageArray = parsed;
      } else {
        // 딕셔너리 형태면 words 순서대로 추출
        imageArray = words.map(w => parsed[w] || '');
      }
    } catch (e) {
      // JSON 파싱 실패 시 btnImage가 이미 문자열이라고 가정
      console.error('Failed to parse btnImage:', e);
    }

    const handleChooseClick = (w: string) => {
      if (clickedOnce === w) {
        onChooseItem?.(w);
        setClickedOnce(null);
      } else {
        setClickedOnce(w);
        setTimeout(() => setClickedOnce(null), 3000);
      }
    };

    return (
      <>
        <div id="choose-item-buttons-container" className="choose-item-buttons-container">
          {words.map((w, i) => {
            const imgData = imageArray[i];
            const imgSrc = imgData ? `data:image/png;base64,${imgData}` : undefined;

            return (
              <button
                key={i}
                className={`choose-item-btn ${clickedOnce === w ? 'clicked-once' : ''}`}
                onClick={() => handleChooseClick(w)}
              >
                {imgSrc && <img src={imgSrc} alt={w} />}
                <div>{w}</div>
              </button>
            );
          })}
        </div>
        {clickedOnce && (
          <>
            <div className="choose-item-popup-overlay show" />
            <div className="choose-item-popup show">
              <h3>🎯 Choose Item Selected!</h3>
              <p>If you want to select this item, click one more time.</p>
            </div>
          </>
        )}
      </>
    );
  }

  // Click 인터랙션 (화면 클릭 - 이미지 버튼)
  if (mode === 'click' && words?.length && btnImage) {
    let imageArray: string[] = [];
    try {
      const parsed = JSON.parse(btnImage);
      if (Array.isArray(parsed)) {
        imageArray = parsed;
      } else {
        imageArray = words.map(w => parsed[w] || '');
      }
    } catch (e) {
      console.error('Failed to parse btnImage:', e);
    }

    const handleClickExplore = (w: string) => {
      if (clickedOnce === w) {
        onExplore?.(w);
        setClickedOnce(null);
      } else {
        setClickedOnce(w);
        setTimeout(() => setClickedOnce(null), 3000);
      }
    };

    // 랜덤 위치 생성 함수
    const getRandomPosition = (index: number) => {
      const margin = 10;
      const seed = index * 137.508; // 고정 시드로 일관성 유지
      const x = ((seed * 9.123) % (100 - margin * 2)) + margin;
      const y = ((seed * 7.456) % (100 - margin * 2)) + margin;
      return { x, y };
    };

    return (
      <>
        <div id="click-buttons-container" className="click-buttons-container">
          {words.map((w, i) => {
            const imgData = imageArray[i];
            const imgSrc = imgData ? `data:image/png;base64,${imgData}` : undefined;
            const pos = getRandomPosition(i);

            return (
              <button
                key={i}
                className={`click-btn ${clickedOnce === w ? 'clicked-once' : ''}`}
                onClick={() => handleClickExplore(w)}
                style={{
                  position: 'absolute',
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                }}
              >
                {imgSrc && <img src={imgSrc} alt={w} />}
                <span className="label">{w}</span>
              </button>
            );
          })}
          <div id="click-screen-overlay" className="click-screen-overlay" />
        </div>
        {clickedOnce && (
          <>
            <div className="click-item-popup-overlay show" />
            <div className="click-item-popup show">
              <h3>🎯 Click Item Selected!</h3>
              <p>If you want to practice this word, click one more time.</p>
            </div>
          </>
        )}
      </>
    );
  }

  return null;
}
