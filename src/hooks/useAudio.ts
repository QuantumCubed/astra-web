import { useState, useRef, useEffect, useCallback } from 'react';
import { useWs } from '../context/ws';
import { startCapture, type CaptureHandle } from '../audio/capture';

export type AudioState = 'idle' | 'recording' | 'processing' | 'playing';

export function useAudio() {
  const { sendBinary, sendAudioEnd, speakingId } = useWs();
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const captureRef = useRef<CaptureHandle | null>(null);

  // TTS playback now streams chunk-by-chunk inside the WS context; mirror the speaking
  // indicator here so the UI can reflect a "playing" state.
  useEffect(() => {
    if (speakingId !== null) {
      setAudioState('playing');
    } else {
      setAudioState(s => (s === 'playing' ? 'idle' : s));
    }
  }, [speakingId]);

  const startRecording = useCallback(async () => {
    if (audioState !== 'idle') return;
    try {
      setAudioState('recording');
      captureRef.current = await startCapture();
    } catch {
      // user denied mic permission or API not available
      setAudioState('idle');
    }
  }, [audioState]);

  const stopRecording = useCallback(async () => {
    if (audioState !== 'recording' || captureRef.current === null) return;
    setAudioState('processing');
    const pcm = await captureRef.current.stop();
    captureRef.current = null;
    sendBinary(pcm);
    sendAudioEnd();
  }, [audioState, sendBinary, sendAudioEnd]);

  return { audioState, startRecording, stopRecording };
}
