import { useAudio, type AudioState } from '../hooks/useAudio';

const LABELS: Record<AudioState, string> = {
  idle:       'Mic',
  recording:  'Stop',
  processing: '...',
  playing:    'Playing',
};

export function VoiceButton() {
  const { audioState, startRecording, stopRecording } = useAudio();
  const busy = audioState === 'processing' || audioState === 'playing';

  function handleClick() {
    if (audioState === 'idle') void startRecording();
    else if (audioState === 'recording') void stopRecording();
  }

  return (
    <button
      type="button"
      className={`voice-btn voice-btn--${audioState}`}
      onClick={handleClick}
      disabled={busy}
      aria-label={audioState === 'recording' ? 'Stop recording' : 'Start recording'}
    >
      {LABELS[audioState]}
    </button>
  );
}
