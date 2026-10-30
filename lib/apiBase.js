// Base URL for backend API routes. Empty string = same-origin (web/Vercel).
// The Capacitor mobile build sets NEXT_PUBLIC_API_BASE to the deployed web URL
// so the app keeps working with its server-side AI routes.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
