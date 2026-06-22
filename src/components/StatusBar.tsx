import { useWs, type ChatMessage } from '../context/ws';
import type { ConnectionStatus } from '../ws/client';

// re-export so consumers can import from one place
export type { ChatMessage };

const LABELS: Record<ConnectionStatus, string> = {
  connecting:   'Connecting…',
  connected:    'Connected',
  disconnected: 'Disconnected',
  error:        'Connection error — retrying…',
};

export function StatusBar() {
  const { status } = useWs();
  return (
    <div className={`status-bar status-bar--${status}`}>
      <span className="status-bar__dot" />
      <span>{LABELS[status]}</span>
    </div>
  );
}
