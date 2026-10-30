import { API_BASE } from './apiBase';

export const demoUserKey = 'nhanceme_user';

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(demoUserKey) || 'null');
  } catch {
    return null;
  }
}

// Stores the user profile returned by /api/auth/login for UI display.
// The real gate is the httpOnly session cookie set by the server.
export function saveUser(user) {
  if (!user) return null;
  const profile = { ...user, plan: 'Launch Demo', savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(demoUserKey, JSON.stringify(profile));
  } catch {
    // ignore storage failures (private mode etc.)
  }
  return profile;
}

export async function signOut() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
  } catch {
    // ignore network failures on logout
  }
  try {
    localStorage.removeItem(demoUserKey);
  } catch {
    // ignore
  }
  window.location.href = '/login';
}

export function requireUser(router) {
  const user = getUser();
  if (!user) {
    router.replace('/login');
    return null;
  }
  return user;
}
