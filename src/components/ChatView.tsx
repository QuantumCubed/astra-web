import { useEffect, useRef } from 'react';
import { useWs } from '../context/ws';

export function ChatView() {
  const { messages } = useWs();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-view">
      {messages.length === 0 && (
        <p className="chat-view__empty">Say something to Astra.</p>
      )}
      {messages.map(msg => (
        <div key={msg.id} className={`message message--${msg.role}`}>
          <span className="message__role">
            {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Astra' : null}
          </span>
          <p className="message__content">
            {msg.content}
            {msg.pending && <span className="cursor" aria-hidden>▌</span>}
          </p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
