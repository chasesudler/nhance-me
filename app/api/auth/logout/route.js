import { sessionCookieHeader } from '@/lib/server';

export const runtime = 'nodejs';

export async function POST() {
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookieHeader('', { clear: true }) } });
}
