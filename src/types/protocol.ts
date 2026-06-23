// Outbound (client → server)
export type ClientMessage =
  | { request_id?: string; type: 'text_message'; payload: { content: string; voice_response?: boolean } }
  | { request_id?: string; type: 'audio_end' };

// Inbound (server → client) — binary frames carry raw f32 LE PCM (TTS audio)
export type ServerMessage =
  | { request_id?: string; type: 'text_chunk';   payload: { content: string; done: boolean } }
  | { request_id?: string; type: 'transcript';   payload: { text: string } }
  | { request_id?: string; type: 'tts_end'; payload: { sample_rate: number; channels: number; format: string } }
  | { request_id?: string; type: 'tool_call';    payload: { name: string; args: unknown } }
  | { request_id?: string; type: 'tool_result';  payload: { name: string; result: string } }
  | { request_id?: string; type: 'error';        payload: { message: string; code: string } };
