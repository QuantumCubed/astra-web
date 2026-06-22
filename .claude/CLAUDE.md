# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`astra-web` is the browser client for Astra — a local, low-latency home AI server. This repo is purely frontend: a TypeScript/React SPA that communicates with the Astra Rust server over a single WebSocket connection.

The server lives at `E:\Coding-Stuff\astra`. Refer to it for protocol definitions, server behaviour, and architectural context. If this file and the server source disagree on the protocol, the server source wins — flag the discrepancy.

**Transport:** all server communication is WebSocket. Never suggest HTTP polling or SSE. Voice will be added as binary WebSocket frames over the same connection when Phase 3 lands on the server.

## Commands

> These assume a Vite + React + TypeScript project. Update once the stack is finalised.

```bash
npm run dev          # start dev server (Vite default: http://localhost:5173)
npm run build        # production build
npm run preview      # preview production build locally
npm run typecheck    # tsc --noEmit (add this script if not present)
npm test             # run tests
npm run lint         # eslint
```

## WebSocket Protocol

The client connects to `ws://<server>:3000/ws`. All messages are JSON frames matching this schema (from `src/backend/protocol.rs` in the server repo):

```typescript
// Outbound (client → server)
type ClientMessage = {
  request_id?: string;
  type: "text_message";
  payload: { content: string };
};

// Inbound (server → client)
type ServerMessage =
  | { request_id?: string; type: "text_chunk";   payload: { content: string; done: boolean } }
  | { request_id?: string; type: "tool_call";    payload: { name: string; args: unknown } }
  | { request_id?: string; type: "tool_result";  payload: { name: string; result: string } }
  | { request_id?: string; type: "error";        payload: { message: string; code: string } };
```

Binary frames are reserved for audio (Phase 3, not yet implemented server-side).

## Architecture

```
src/
├── main.tsx              — React entry point
├── App.tsx               — root component, WebSocket connection lifecycle
├── ws/
│   └── client.ts         — WebSocket wrapper (connect, send, receive, reconnect)
├── components/
│   ├── ChatView.tsx      — message thread display
│   ├── InputBar.tsx      — text input and send controls
│   └── StatusBar.tsx     — connection state indicator
└── types/
    └── protocol.ts       — TypeScript types for the WS message schema above
```

> This is the intended initial structure. Update this section as the actual structure diverges.

## Conventions

- **TypeScript strict mode on.** No `any` except at integration boundaries (raw WS frames before parsing).
- **Naming:** `camelCase` for variables/functions, `PascalCase` for components and types, `SCREAMING_SNAKE_CASE` for constants.
- **Components:** function components only. No class components.
- **State:** local `useState`/`useReducer` first. Reach for a store only when prop drilling spans more than two levels.
- **WebSocket lifecycle:** connection belongs at the App level. Pass send function and message stream downward via context, not prop drilling.
- **Error handling:** parse inbound WS frames defensively — the server may send unexpected shapes. Don't trust `any`.
- **No comments** unless the WHY is non-obvious.
