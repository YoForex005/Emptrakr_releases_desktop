/**
 * src/config.ts — Centralized configuration for the Desktop App (Renderer)
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth for the backend API URL.
 * Uses Vite's env variable system (import.meta.env).
 */

const DEFAULT_API_BASE = import.meta.env.DEV
    ? 'http://localhost:3005/api'
    : 'https://api.emptrakr.com/api';

const DEFAULT_WEB_BASE = 'https://emptrakr.com';

export const API_BASE = import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE;
export const WEB_BASE = import.meta.env.VITE_WEB_BASE ?? DEFAULT_WEB_BASE;
