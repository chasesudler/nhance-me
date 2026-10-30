import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { put } from '@vercel/blob';

const COOKIE_NAME = 'nhance_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret() {
  const secret = process.env.NHANCE_API_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    console.warn('[nhance-me] NHANCE_API_SECRET is not set; sessions are signed with an ephemeral key. Set NHANCE_API_SECRET in production.');
  }
  return secret || 'nhance-me-dev-secret-change-me';
}

function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function b64urlDecode(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}

export function signSession(email) {
  const payload = b64urlEncode({ email, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS });
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = b64urlDecode(payload);
    if (!data.email || data.exp < Date.now()) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return verifySession(decodeURIComponent(match.slice(COOKIE_NAME.length + 1)));
}

export function sessionCookieHeader(token, { clear = false } = {}) {
  const parts = [`${COOKIE_NAME}=${clear ? '' : encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  parts.push(clear ? 'Max-Age=0' : `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  return parts.join('; ');
}

export function unauthorized() {
  return Response.json({ error: 'Please log in to use this feature.' }, { status: 401 });
}

// --- Simple in-memory rate limiter (best effort; resets per serverless instance) ---
const buckets = new Map();
export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function rateLimitedResponse() {
  return Response.json({ error: 'Too many requests. Please wait a bit and try again.' }, { status: 429 });
}

// --- Data URI handling ---
export function parseDataUri(dataUri) {
  if (typeof dataUri !== 'string') return null;
  const match = dataUri.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

export async function uploadImageToBlob(dataUri, filename, maxBytes = 12 * 1024 * 1024) {
  const parsed = parseDataUri(dataUri);
  if (!parsed) throw new Error('The image upload was not a valid image data URL.');
  const buffer = Buffer.from(parsed.base64, 'base64');
  if (buffer.length > maxBytes) {
    throw new Error('That image is too large to process. Try a smaller photo.');
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const err = new Error('Image hosting is not connected yet. Add BLOB_READ_WRITE_TOKEN in Vercel Environment Variables, then redeploy.');
    err.status = 503;
    throw err;
  }
  const blob = await put(filename, buffer, { access: 'public', contentType: parsed.contentType });
  return blob.url;
}

export function uniqueImageName(prefix, ext = 'jpg') {
  return `${prefix}-${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
}

export function safeMessage(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value;
  try {
    const s = JSON.stringify(value);
    if (s && s !== '{}' && s !== 'null') return s;
  } catch {
    // ignore
  }
  return fallback;
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
