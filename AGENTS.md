# EmpTrakr Desktop Agent Instructions

## Package manager

Use npm with the repository `package-lock.json`: `npm ci`, `npm run dev`, `npm run build`.

## Project boundaries

- Renderer source belongs in `src/`; Electron main/preload/tracking code belongs in `electron/`.
- Keep the renderer, Electron IPC boundary, and backend API as separate layers.
- The local development renderer uses `127.0.0.1:5174`; its local backend API uses `localhost:5005/api`.
- Keep release configuration and generated artifacts out of unrelated application commits.

## Quality and security

- Use explicit renderer, IPC, and API payload types; do not add `any` for `window.electronAPI` or external responses.
- Expose the smallest possible validated preload API. Validate IPC payloads in the main process.
- Never log access tokens, passwords, deep-link URLs, device codes, screenshots, or sensitive activity data.
- Keep timers, tracking, screenshot delivery, and updater actions in small focused services with bounded retries and contextual error handling.
- Use `async`/`await`; parallelize only independent work and preserve ordering for telemetry and lifecycle events.
- Measure CPU, memory, network, and queue behavior before optimizing capture/tracking code. Do not drop, reorder, or duplicate telemetry while optimizing.

## Verification

- Run `npm run build` after TypeScript or renderer/main-process changes.
- Add focused Node tests for pure timer, API, IPC, queue, and retry logic before changing behavior.

## Commit attribution

AI-authored commits must include:
```
Co-Authored-By: Codex <noreply@openai.com>
```
