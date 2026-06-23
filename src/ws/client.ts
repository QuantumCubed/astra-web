import type { ClientMessage, ServerMessage } from '../types/protocol';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type Callbacks = {
  onMessage: (msg: ServerMessage) => void;
  onBinaryMessage: (data: ArrayBuffer) => void;
  onStatusChange: (status: ConnectionStatus) => void;
};

export class WsClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  constructor(
    private readonly url: string,
    private readonly callbacks: Callbacks,
  ) {}

  connect(): void {
    this.shouldReconnect = true;
    this.open();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendBinary(data: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private open(): void {
    this.callbacks.onStatusChange('connecting');
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => this.callbacks.onStatusChange('connected');

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.callbacks.onBinaryMessage(event.data);
        return;
      }
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        this.callbacks.onMessage(msg);
      } catch {
        // malformed frame — discard
      }
    };

    ws.onerror = () => this.callbacks.onStatusChange('error');

    ws.onclose = () => {
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.open(), 2000);
      } else {
        this.callbacks.onStatusChange('disconnected');
      }
    };

    this.ws = ws;
  }
}
