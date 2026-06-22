# Learning Log

The user is actively learning TypeScript, React, and frontend architecture. When you explain a concept during development, log it to the learning note so they have a permanent reference.

## When to log

Log an entry when you explain any of the following for the first time or in meaningful depth:
- A TypeScript concept (type narrowing, generics, discriminated unions, utility types, strict mode, etc.)
- A React pattern (hooks, component lifecycle, context, state management, refs, effects, etc.)
- A WebSocket or async pattern relevant to the client
- A frontend architecture or design pattern (component boundaries, data flow, state colocation, etc.)
- A browser API that required explanation

Do NOT log:
- Trivial syntax reminders
- Things already logged in this note
- General conversation that does not involve a concrete concept

## How to log

After explaining the concept in conversation, append an entry to `obsidian/Astra/Learning/concepts.md` using this format:

```
## <Concept Name>
**Date:** YYYY-MM-DD
**Context:** <one sentence — what we were building when this came up>
**Source:** Claude

<The same plain-English explanation you gave in conversation. 2-5 sentences. No code unless it is essential to the explanation.>

---
```

Update the `updated` frontmatter date when you add an entry. Do not rewrite existing entries.
