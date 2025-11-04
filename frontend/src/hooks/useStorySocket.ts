// socket connection to the backend

import { useEffect, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

interface Events {
    onStoryStateUpdate?: (data: any) => void;
    onAudioStatusUpdate?: (data: any) => void;
    onAnyAudioReady?: (url: string) => void;
  }

export function useStorySocket({onStoryStateUpdate, onAudioStatusUpdate, onAnyAudioReady}: Events) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL || '';
    const s = io(url, { transports: ['websocket'] });
    setSocket(s);

    console.log('[Socket.IO] Connecting...');
    
    s.on('connect', () => {
      console.log('[Socket.IO] Connected!');
    });

    s.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
    });

    s.on('story_state_update', (d) => {
      console.log('[Socket.IO] story_state_update:', d);
      onStoryStateUpdate?.(d);
    });
    
    s.on('audio_status_update', (d) => {
      console.log('[Socket.IO] audio_status_update:', d);
      onAudioStatusUpdate?.(d);
    });
    
    s.on('audio_ready', (d: any) => {
      console.log('[Socket.IO] audio_ready:', d);
      if (d?.audio_url) {
        console.log('[Socket.IO] Playing audio from:', d.audio_url);
        onAnyAudioReady?.(d.audio_url);
      }
    });
    
    s.on('word_audio_ready', (d: any) => {
      console.log('[Socket.IO] word_audio_ready:', d);
      if (d?.audio_url) {
        onAnyAudioReady?.(d.audio_url);
      }
    });
    
    s.on('exploration_audio_ready', (d: any) => {
      console.log('[Socket.IO] exploration_audio_ready:', d);
      if (d?.audio_url) {
        onAnyAudioReady?.(d.audio_url);
      }
    });
    
    s.on('user_voice_ready', (d: any) => {
      console.log('[Socket.IO] user_voice_ready:', d);
      if (d?.audio_url) {
        onAnyAudioReady?.(d.audio_url);
      }
    });

    return () => { 
      console.log('[Socket.IO] Cleanup - closing socket');
      try { s.close(); } catch { /* ignore */ } 
    };
  }, [onStoryStateUpdate, onAudioStatusUpdate, onAnyAudioReady]);

  const emitRequestStoryUpdate = useCallback((payload: { user_id: string; story_id: string; story_mode: string }) => {
    socket?.emit('request_story_update', payload);
  }, [socket]);

  return { emitRequestStoryUpdate };
}