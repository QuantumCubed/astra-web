import { useState, useRef, useEffect, useCallback } from 'react';
import { useWs } from '../context/ws';
import { startCapture, type CaptureHandle } from '../audio/capture';
import { playF32Audio } from '../audio/playback';

export type AudioState = 'idle' | 'recording' | 'processing' | 'playing';

export function useAudio() {
  const { sendBinary, sendAudioEnd, ttsAudio, consumeTtsAudio, clearSpeakingId } = useWs();
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const captureRef = useRef<CaptureHandle | null>(null);

  useEffect(() => {
    if (ttsAudio === null) return;
    setAudioState('playing');
    consumeTtsAudio();
    playF32Audio(ttsAudio.buffer, ttsAudio.sampleRate, () => {
      clearSpeakingId();
      setAudioState('idle');
    });
  }, [ttsAudio, consumeTtsAudio, clearSpeakingId]);

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
