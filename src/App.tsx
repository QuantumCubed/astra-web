import { WsProvider } from './context/ws';
import { StatusBar } from './components/StatusBar';
import { ChatView } from './components/ChatView';
import { InputBar } from './components/InputBar';
import './index.css';

export default function App() {
  return (
    <WsProvider>
      <div className="layout">
        <StatusBar />
        <ChatView />
        <InputBar />
      </div>
    </WsProvider>
  );
}
