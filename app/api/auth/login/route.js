import { signSession, sessionCookieHeader, isValidEmail, checkRateLimit, rateLimitedResponse } from '@/lib/server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`login:${ip}`, 30, 60 * 60 * 1000)) return rateLimitedResponse();

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!isValidEmail(email)) {
      return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    // Demo auth: any valid email signs in. Swap this check for a real
    // credential verification (Firebase Auth, Clerk, Supabase) before launch.
    const token = signSession(email);
    const user = { email, name: email.split('@')[0] };

    return Response.json(
      { ok: true, user },
      { headers: { 'Set-Cookie': sessionCookieHeader(token) } }
    );
  } catch {
    return Response.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
