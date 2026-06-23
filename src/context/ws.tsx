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

export type TtsAudio = { buffer: ArrayBuffer; sampleRate: number };

type WsContextValue = {
  status: ConnectionStatus;
  messages: ChatMessage[];
  sendMessage: (content: string, voiceResponse?: boolean) => void;
  sendBinary: (data: Uint8Array) => void;
  sendAudioEnd: () => void;
  ttsAudio: TtsAudio | null;
  consumeTtsAudio: () => void;
  speakingId: string | null;
  clearSpeakingId: () => void;
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
  const [ttsAudio, setTtsAudio] = useState<TtsAudio | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const clientRef = useRef<WsClient | null>(null);

  // Normal streaming state (non-voice requests).
  const pendingIdRef = useRef<string | null>(null);

  // Voice-response buffering: text is held until tts_end so text and audio
  // reveal in the same React render (simultaneous reveal).
  const expectingTtsRef = useRef(false);
  const ttsTextRef = useRef('');
  const bufferedMsgIdRef = useRef<string | null>(null);

  // Accumulate binary frames; server sends one frame per TTS response but
  // the WebSocket layer could fragment it in principle.
  const ttsBufferRef = useRef<ArrayBuffer[]>([]);

  // Flush buffered text into the placeholder message without starting audio.
  // Used as a safety valve when audio fails or an error arrives mid-stream.
  const flushBufferedText = useRef<(() => void) | null>(null);

  useEffect(() => {
    flushBufferedText.current = () => {
      if (!expectingTtsRef.current || bufferedMsgIdRef.current === null) return;
      const id = bufferedMsgIdRef.current;
      const text = ttsTextRef.current;
      expectingTtsRef.current = false;
      ttsTextRef.current = '';
      bufferedMsgIdRef.current = null;
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, content: text, pending: false } : m),
      );
    };
  });

  useEffect(() => {
    function handleMessage(msg: ServerMessage) {
      switch (msg.type) {
        case 'text_chunk': {
          const { content, done } = msg.payload;

          if (expectingTtsRef.current) {
            // Buffering mode: accumulate without revealing yet.
            if (bufferedMsgIdRef.current === null) {
              const id = uid();
              bufferedMsgIdRef.current = id;
              setMessages(prev => [
                ...prev,
                { id, role: 'assistant', content: '', pending: true },
              ]);
            }
            ttsTextRef.current += content;
            // If TTS never arrives (shouldn't happen), flush on error instead.
            break;
          }

          // Normal streaming path.
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

        case 'transcript':
          setMessages(prev => [
            ...prev,
            { id: uid(), role: 'user', content: msg.payload.text },
          ]);
          break;

        case 'tts_end': {
          const parts = ttsBufferRef.current;
          if (parts.length === 0) break;
          const total = parts.reduce((n, b) => n + b.byteLength, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const part of parts) {
            merged.set(new Uint8Array(part), offset);
            offset += part.byteLength;
          }
          ttsBufferRef.current = [];

          const id = bufferedMsgIdRef.current;
          const text = ttsTextRef.current;
          expectingTtsRef.current = false;
          ttsTextRef.current = '';
          bufferedMsgIdRef.current = null;

          // Reveal buffered text and start audio in the same render.
          if (id !== null) {
            setSpeakingId(id);
            setMessages(prev =>
              prev.map(m => m.id === id ? { ...m, content: text, pending: false } : m),
            );
          }
          setTtsAudio({ buffer: merged.buffer, sampleRate: msg.payload.sample_rate });
          break;
        }

        case 'tool_call':
          setMessages(prev => [
            ...prev,
            { id: uid(), role: 'system', content: `Calling tool: ${msg.payload.name}` },
          ]);
          break;

        case 'tool_result':
          setMessages(prev => [
            ...prev,
            { id: uid(), role: 'system', content: `${msg.payload.name} → ${msg.payload.result}` },
          ]);
          break;

        case 'error':
          // If TTS was expected, reveal whatever text arrived so it isn't lost.
          flushBufferedText.current?.();
          setMessages(prev => [
            ...prev,
            { id: uid(), role: 'system', content: `Error [${msg.payload.code}]: ${msg.payload.message}` },
          ]);
          break;
      }
    }

    function handleBinaryMessage(data: ArrayBuffer) {
      ttsBufferRef.current.push(data);
    }

    const client = new WsClient(WS_URL, {
      onStatusChange: setStatus,
      onMessage: handleMessage,
      onBinaryMessage: handleBinaryMessage,
    });
    clientRef.current = client;
    client.connect();
    return () => client.disconnect();
  }, []);

  const sendMessage = useCallback((content: string, voiceResponse?: boolean) => {
    const msg: ClientMessage = { type: 'text_message', payload: { content, voice_response: voiceResponse } };
    clientRef.current?.send(msg);
    setMessages(prev => [...prev, { id: uid(), role: 'user', content }]);
    if (voiceResponse) {
      expectingTtsRef.current = true;
      ttsTextRef.current = '';
      bufferedMsgIdRef.current = null;
    }
  }, []);

  const sendBinary = useCallback((data: Uint8Array) => {
    clientRef.current?.sendBinary(data);
  }, []);

  const sendAudioEnd = useCallback(() => {
    const msg: ClientMessage = { type: 'audio_end' };
    clientRef.current?.send(msg);
    expectingTtsRef.current = true;
    ttsTextRef.current = '';
    bufferedMsgIdRef.current = null;
  }, []);

  const consumeTtsAudio = useCallback(() => {
    setTtsAudio(null);
  }, []);

  const clearSpeakingId = useCallback(() => {
    setSpeakingId(null);
  }, []);

  return (
    <WsContext.Provider value={{ status, messages, sendMessage, sendBinary, sendAudioEnd, ttsAudio, consumeTtsAudio, speakingId, clearSpeakingId }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (ctx === null) throw new Error('useWs must be used inside WsProvider');
  return ctx;
}
