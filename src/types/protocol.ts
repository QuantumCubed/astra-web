export type ClientMessage = {
  request_id?: string;
  type: 'text_message';
  payload: { content: string };
};

export type ServerMessage =
  | { request_id?: string; type: 'text_chunk';   payload: { content: string; done: boolean } }
  | { request_id?: string; type: 'tool_call';    payload: { name: string; args: unknown } }
  | { request_id?: string; type: 'tool_result';  payload: { name: string; result: string } }
  | { request_id?: string; type: 'error';        payload: { message: string; code: string } };
