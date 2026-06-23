import { useState, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { useWs } from '../context/ws';
import { VoiceButton } from './VoiceButton';

export function InputBar() {
  const { sendMessage, status } = useWs();
  const [value, setValue] = useState('');
  const [voiceResponse, setVoiceResponse] = useState(false);
  const connected = status === 'connected';

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || !connected) return;
    sendMessage(trimmed, voiceResponse);
    setValue('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <div className="input-bar">
      <VoiceButton />
      <form className="input-bar__form" onSubmit={handleSubmit}>
        <textarea
          className="input-bar__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={connected ? 'Message Astra…' : 'Waiting for connection…'}
          rows={1}
          disabled={!connected}
        />
        <button
          type="button"
          className={`input-bar__voice-toggle${voiceResponse ? ' input-bar__voice-toggle--on' : ''}`}
          onClick={() => setVoiceResponse(v => !v)}
          title={voiceResponse ? 'Voice response on' : 'Voice response off'}
          disabled={!connected}
        >
          Voice
        </button>
        <button
          className="input-bar__send"
          type="submit"
          disabled={!connected || !value.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
