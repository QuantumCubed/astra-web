import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { WsClient, type ConnectionStatus } from '../ws/client';
import type { ClientMessage, ServerMessage } from '../types/protocol';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending?: boolean;
};

type WsContextValue = {
  status: ConnectionStatus;
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
};

const WsContext = createContext<WsContextValue | null>(null);

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws';

let _idCounter = 0;
function uid(): string {
  // crypto.randomUUID requires a secure context (HTTPS/localhost); fall back
  // to a monotonic counter + timestamp when serving over plain HTTP on LAN.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

export function WsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const clientRef = useRef<WsClient | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  useEffect(() => {
    function handleMessage(msg: ServerMessage) {
      switch (msg.type) {
        case 'text_chunk': {
          const { content, done } = msg.payload;
          if (pendingIdRef.current === null) {
            const id = uid();
            pendingIdRef.current = id;
            setMessages(prev => [
              ...prev,
              { id, role: 'assistant', content, pending: !done },
            ]);
          } else {
            const id = pendingIdRef.current;
            setMessages(prev =>
              prev.map(m =>
                m.id === id
                  ? { ...m, content: m.content + content, pending: !done }
                  : m,
              ),
            );
          }
          if (done) pendingIdRef.current = null;
          break;
        }
        case 'tool_call':
          setMessages(prev => [
            ...prev,
            {
              id: uid(),
              role: 'system',
              content: `Calling tool: ${msg.payload.name}`,
            },
          ]);
          break;
        case 'tool_result':
          setMessages(prev => [
            ...prev,
            {
              id: uid(),
              role: 'system',
              content: `${msg.payload.name} → ${msg.payload.result}`,
            },
          ]);
          break;
        case 'error':
          setMessages(prev => [
            ...prev,
            {
              id: uid(),
              role: 'system',
              content: `Error [${msg.payload.code}]: ${msg.payload.message}`,
            },
          ]);
          break;
      }
    }

    const client = new WsClient(WS_URL, {
      onStatusChange: setStatus,
      onMessage: handleMessage,
    });
    clientRef.current = client;
    client.connect();
    return () => client.disconnect();
  }, []);

  const sendMessage = useCallback((content: string) => {
    const msg: ClientMessage = { type: 'text_message', payload: { content } };
    clientRef.current?.send(msg);
    setMessages(prev => [
      ...prev,
      { id: uid(), role: 'user', content },
    ]);
  }, []);

  return (
    <WsContext.Provider value={{ status, messages, sendMessage }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (ctx === null) throw new Error('useWs must be used inside WsProvider');
  return ctx;
}
