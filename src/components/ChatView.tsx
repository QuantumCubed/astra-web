import { useEffect, useRef } from 'react';
import { useWs } from '../context/ws';

export function ChatView() {
  const { messages, speakingId } = useWs();
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
        <div key={msg.id} className={`message message--${msg.role}${msg.id === speakingId ? ' message--speaking' : ''}`}>
          <span className="message__role">
            {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Astra' : null}
            {msg.id === speakingId && (
              <span className="speaking-wave" aria-label="speaking">
                <span /><span /><span />
              </span>
            )}
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
