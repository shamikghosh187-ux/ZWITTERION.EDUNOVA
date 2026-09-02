import crypto from 'node:crypto';

const DEFAULT_EMAIL = 'admin@school1.demo';
const DEFAULT_PASSWORD = 'Demo1234!';

function secret() {
  return process.env.ZWITTERION_SESSION_SECRET || 'change-this-session-secret-before-production';
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signAdminSession(email) {
  const payload = {
    sub: email,
    role: 'SCHOOL_ADMIN',
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };

  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAdminSession(request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  if (!token || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');

  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.role !== 'SCHOOL_ADMIN') return null;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function configuredAdminCredentials() {
  return {
    email: (process.env.ZWITTERION_ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase(),
    password: process.env.ZWITTERION_ADMIN_PASSWORD || DEFAULT_PASSWORD,
  };
}
