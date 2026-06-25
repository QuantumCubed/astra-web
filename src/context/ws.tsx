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
import { startTtsStream, enqueueChunk, endTtsStream } from '../audio/playback';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  pending?: boolean;
};

type WsContextValue = {
  status: ConnectionStatus;
  messages: ChatMessage[];
  sendMessage: (content: string, voiceResponse?: boolean) => void;
  sendBinary: (data: Uint8Array) => void;
  sendAudioEnd: () => void;
  speakingId: string | null;
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
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const clientRef = useRef<WsClient | null>(null);

  // Normal streaming state (non-voice requests).
  const pendingIdRef = useRef<string | null>(null);

  // Voice-response state. For voice replies the transcript is NOT streamed from
  // text_chunk; instead each sentence is revealed in lockstep with its audio, driven by
  // `tts_sentence` markers scheduled on the audio clock (see handleBinaryMessage).
  // text_chunk is still accumulated as a fallback for the no-audio / error cases.
  const expectingTtsRef = useRef(false);
  const ttsTextRef = useRef('');
  const voiceMsgIdRef = useRef<string | null>(null);
  const ttsSampleRateRef = useRef(0);
  const pendingSentenceRef = useRef<string | null>(null);

  useEffect(() => {
    function appendSentence(id: string, text: string) {
      setMessages(prev =>
        prev.map(m =>
          m.id === id
            ? { ...m, content: m.content === '' ? text : `${m.content} ${text}` }
            : m,
        ),
      );
    }

    function handleMessage(msg: ServerMessage) {
      switch (msg.type) {
        case 'text_chunk': {
          const { content, done } = msg.payload;

          // Voice mode: keep the text only as a fallback; the visible transcript is
          // driven by tts_sentence markers in sync with the audio. Show an empty
          // pending bubble early so the user sees Astra "thinking".
          if (expectingTtsRef.current) {
            if (voiceMsgIdRef.current === null) {
              const id = uid();
              voiceMsgIdRef.current = id;
              setMessages(prev => [
                ...prev,
                { id, role: 'assistant', content: '', pending: true },
              ]);
            }
            ttsTextRef.current += content;
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

        case 'tts_start': {
          ttsSampleRateRef.current = msg.payload.sample_rate;
          startTtsStream(msg.payload.sample_rate);
          // Reuse the "thinking" bubble if text_chunk already created one, else make it.
          const id = voiceMsgIdRef.current ?? uid();
          voiceMsgIdRef.current = id;
          setSpeakingId(id);
          setMessages(prev =>
            prev.some(m => m.id === id)
              ? prev
              : [...prev, { id, role: 'assistant', content: '', pending: true }],
          );
          break;
        }

        case 'tts_sentence':
          // Hold this sentence's text; it's revealed when its first audio chunk plays.
          pendingSentenceRef.current = msg.payload.text;
          break;

        case 'tts_end': {
          const id = voiceMsgIdRef.current;
          expectingTtsRef.current = false;
          // Drop the speaking indicator once the last queued chunk finishes playing.
          endTtsStream(() => setSpeakingId(null));
          if (id !== null) {
            // Markers are revealing text in sync with audio; just clear the cursor.
            setMessages(prev => prev.map(m => (m.id === id ? { ...m, pending: false } : m)));
          } else if (ttsTextRef.current) {
            // No audio was produced — fall back to showing the buffered text.
            const text = ttsTextRef.current;
            setMessages(prev => [
              ...prev,
              { id: uid(), role: 'assistant', content: text, pending: false },
            ]);
          }
          ttsTextRef.current = '';
          voiceMsgIdRef.current = null;
          pendingSentenceRef.current = null;
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

        case 'error': {
          // Reveal whatever text we buffered so it isn't lost, then show the error.
          const id = voiceMsgIdRef.current;
          if (id !== null && ttsTextRef.current) {
            const text = ttsTextRef.current;
            setMessages(prev =>
              prev.map(m => (m.id === id ? { ...m, content: text, pending: false } : m)),
            );
          }
          expectingTtsRef.current = false;
          ttsTextRef.current = '';
          voiceMsgIdRef.current = null;
          pendingSentenceRef.current = null;
          setSpeakingId(null);
          setMessages(prev => [
            ...prev,
            { id: uid(), role: 'system', content: `Error [${msg.payload.code}]: ${msg.payload.message}` },
          ]);
          break;
        }
      }
    }

    // Each binary frame is a PCM chunk. Schedule it gapless on the audio clock; if it's
    // the first chunk of a new sentence, reveal that sentence's transcript exactly when
    // the chunk starts playing (delayMs from now), keeping text and speech in sync.
    function handleBinaryMessage(data: ArrayBuffer) {
      const rate = ttsSampleRateRef.current;
      if (rate === 0) return; // no tts_start seen yet
      const delayMs = enqueueChunk(data, rate);
      const sentence = pendingSentenceRef.current;
      const id = voiceMsgIdRef.current;
      if (sentence !== null && id !== null) {
        pendingSentenceRef.current = null;
        window.setTimeout(() => appendSentence(id, sentence), delayMs);
      }
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
      voiceMsgIdRef.current = null;
      pendingSentenceRef.current = null;
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
    voiceMsgIdRef.current = null;
    pendingSentenceRef.current = null;
  }, []);

  return (
    <WsContext.Provider value={{ status, messages, sendMessage, sendBinary, sendAudioEnd, speakingId }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (ctx === null) throw new Error('useWs must be used inside WsProvider');
  return ctx;
}
