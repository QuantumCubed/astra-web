import { useState, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import { useWs } from '../context/ws';

export function InputBar() {
  const { sendMessage, status } = useWs();
  const [value, setValue] = useState('');
  const connected = status === 'connected';

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || !connected) return;
    sendMessage(trimmed);
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
    <form className="input-bar" onSubmit={handleSubmit}>
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
        className="input-bar__send"
        type="submit"
        disabled={!connected || !value.trim()}
      >
        Send
      </button>
    </form>
  );
}
