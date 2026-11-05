// Firebase client setup for Nhance Me.
//
// Config comes from the NEXT_PUBLIC_FIREBASE_* env vars, set in the Vercel
// dashboard (never committed). Initialization is lazy and fully guarded:
// when the config is missing (local builds, CI, a fresh clone) nothing here
// throws, `isFirebaseConfigured` is false, and the auth screens can show a
// clear "sign in is not set up yet" message instead of crashing.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

let cachedAuth = null;

// Returns the Firebase Auth instance, or null when Firebase is not
// configured. Safe to call on the server during prerendering: it returns
// null there too instead of initializing a server side app.
export function getFirebaseAuth() {
  if (!isFirebaseConfigured) return null;
  if (typeof window === 'undefined') return null;
  if (cachedAuth) return cachedAuth;
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch {
    return null;
  }
}
