import { API_BASE } from './apiBase';
import { getFirebaseAuth } from './firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';

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

// After a successful Firebase sign in (email/password, Google, or a fresh
// signup), trade the Firebase ID token for the app's session cookie. The
// server verifies the token and returns the profile to store for display.
export async function exchangeIdTokenForSession(firebaseUser) {
  const idToken = await firebaseUser.getIdToken();
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed. Please try again.');
  return saveUser(data.user);
}

// Friendly messages for the Firebase Auth error codes the forms can hit.
export function firebaseErrorMessage(err) {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'That password does not match this email. Please try again.';
    case 'auth/user-not-found':
      return 'No account exists for this email yet. Create one below.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Try logging in instead.';
    case 'auth/weak-password':
      return 'That password is too weak. Use at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a bit and try again.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign in window was closed before finishing.';
    case 'auth/network-request-failed':
      return 'Network trouble reaching the sign in service. Check your connection and try again.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
}

export async function signOut() {
  // Sign out of Firebase too, so the next visit does not silently restore
  // the Firebase session. Guarded: no-op when Firebase is not configured.
  try {
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
  } catch {
    // ignore Firebase sign out failures; the cookie logout still applies
  }
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
