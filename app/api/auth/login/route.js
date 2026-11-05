import { signSession, sessionCookieHeader, isValidEmail, checkRateLimit, rateLimitedResponse } from '@/lib/server';

export const runtime = 'nodejs';

// Firebase Auth is the identity provider: the client signs in with Firebase
// (email/password or Google) and sends the resulting ID token here. The
// server verifies the token against Firebase, then issues the app's own
// signed httpOnly session cookie, which is what the API routes gate on.
//
// Verification without firebase-admin: call the Identity Toolkit lookup
// endpoint with the project API key. An invalid or expired token returns no
// user, and a token minted for a different project is rejected by Google.
async function verifyFirebaseIdToken(idToken) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return { configured: false };
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return { configured: true, user: null };
    const data = await res.json().catch(() => ({}));
    const user = Array.isArray(data.users) ? data.users[0] : null;
    if (!user || !isValidEmail(user.email || '')) return { configured: true, user: null };
    return {
      configured: true,
      user: {
        email: user.email.trim().toLowerCase(),
        name: user.displayName || user.email.split('@')[0],
      },
    };
  } catch {
    return { configured: true, user: null };
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`login:${ip}`, 30, 60 * 60 * 1000)) return rateLimitedResponse();

    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      return Response.json(
        { error: 'Sign in is not configured yet. Add the Firebase settings, then try again.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const idToken = typeof body.idToken === 'string' ? body.idToken : '';
    if (!idToken) {
      return Response.json({ error: 'Missing sign in token. Please sign in again.' }, { status: 400 });
    }

    const { configured, user } = await verifyFirebaseIdToken(idToken);
    if (!configured) {
      return Response.json(
        { error: 'Sign in is not configured yet. Add the Firebase settings, then try again.' },
        { status: 503 }
      );
    }
    if (!user) {
      return Response.json({ error: 'That sign in could not be verified. Please try again.' }, { status: 401 });
    }

    const token = signSession(user.email);

    return Response.json(
      { ok: true, user },
      { headers: { 'Set-Cookie': sessionCookieHeader(token) } }
    );
  } catch {
    return Response.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
