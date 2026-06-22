# astra-web

Browser client for [Astra](../astra) — a local, low-latency home AI server. TypeScript/React SPA communicating with the Rust server over a single WebSocket connection.

## Setup

```bash
npm install
npm run dev       # http://localhost:5173
```

The server must be running at `ws://localhost:3000/ws`. Override with a `VITE_WS_URL` env var in `.env.local`.

## Key implementation notes

**Streaming:** The server sends `text_chunk` frames with `done: false` while the model is generating. Each frame appends to the in-progress message. When `done: true` arrives the message is sealed. A `pendingIdRef` tracks the active message ID across frames.

**Reconnection:** `WsClient` automatically reconnects every 2 seconds after an unexpected close. Calling `disconnect()` disables reconnection.

**WebSocket URL:** Defaults to `ws://localhost:3000/ws`. Set `VITE_WS_URL` in `.env.local` to point at a different host.

**`handleMessage` defined inside `useEffect`:** This is intentional — keeps the callback's closure fresh and avoids the need to list it as a dependency.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```
