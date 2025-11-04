// frontend/src/hooks/useAudio.ts
import { useRef, useState, useCallback } from 'react';

export function useAudio() {
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const playFromUrl = useCallback(async (url: string) => {
    try {
      // Convert relative URL to absolute backend URL
      const backendUrl = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
      const fullUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;
      console.log('[Audio] Playing from:', fullUrl);
      
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
        currentAudioRef.current = null;
      }
      const a = new Audio(fullUrl);
      currentAudioRef.current = a;
      await a.play();
      console.log('[Audio] ✓ Playing successfully');
    } catch (e) {
      console.error('[Audio] ✗ Error playing audio:', e);
    }
  }, []);

  return { playFromUrl };
}

export function useRecording(uploadFn: (blob: Blob) => Promise<any>) {
    const [recording, setRecording] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
  
    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined });
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' });
        await uploadFn(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current = mr;
      mr.start(100);
      setRecording(true);
    }
  
    async function stop() {
      mediaRecorder.current?.stop();
      setRecording(false);
    }
  
    return { recording, start, stop };
  }