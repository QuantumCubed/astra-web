---
name: ts-review
description: Review TypeScript/React code for type safety, conventions, and correctness. Invoke with a file path, directory, or no argument for the entire src/. Reports findings in conversation.
---

You are performing a TypeScript/React code review. The user is actively learning, so every finding must include a clear explanation of WHY it is a problem — not just what it is. Do not fix anything. Report only.

## Step 1 — Determine scope

- If `$ARGUMENTS` is a file path: review that file only.
- If `$ARGUMENTS` is a directory: review all `.ts` and `.tsx` files in that directory.
- If `$ARGUMENTS` is empty: review all `.ts` and `.tsx` files under `src/`.

Read every file in scope before proceeding.

## Step 2 — Review against these categories

### Type Safety
- `any` outside of integration boundaries (raw WebSocket frames before parsing) — flag each one and explain the risk
- Type assertions (`as X`) without a runtime guard — flag and explain why this is dangerous
- Missing or overly broad return type annotations on exported functions
- Discriminated union arms that are not exhaustively handled (missing cases in switch/if chains)

### React Patterns
- Direct state mutation (setting object properties instead of calling setState with a new object)
- Missing dependency arrays on `useEffect` or incorrect dependencies
- Heavy computation inside render without `useMemo`
- Unstable function references passed as props without `useCallback` where it matters
- Key prop issues in lists (missing, or using array index on a list that can reorder)

### WebSocket / Async
- Missing error handling on WebSocket `onmessage` or `send` calls
- State updates inside async callbacks without checking if the component is still mounted
- Missing cleanup in `useEffect` for subscriptions, timers, or WebSocket listeners

### Structure and Conventions
- Component files exporting more than one component
- Business logic mixed into components (should live in hooks or utility modules)
- `console.log` left in production paths
- Hardcoded server addresses that should come from environment variables
- Functions doing more than one clear thing (flag, do not refactor)

## Step 3 — Report in conversation

Give the user a summary table:

| Severity | Count |
|----------|-------|
| Critical | N |
| Warning  | N |
| Suggestion | N |

Then list findings using this format:

**[Critical / Warning / Suggestion]** `src/path/to/file.tsx` line N  
**Issue:** what the problem is  
**Why:** explanation for someone learning React/TypeScript  
**Direction:** a hint toward the fix without writing the code

Ask if they want to discuss any specific finding.
