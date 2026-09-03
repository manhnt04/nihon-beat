import { Redis } from '@upstash/redis';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const redis = Redis.fromEnv();
const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'hanzibeat_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;
type User = { id: string; name: string; email: string; passwordHash: string; createdAt: string };

const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase().slice(0, 120);
const publicUser = (user: User) => ({ id: user.id, name: user.name, email: user.email });
const sign = (value: string) => createHmac('sha256', process.env.AUTH_SECRET!).update(value).digest('base64url');
const createSession = (user: User) => {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};
const readCookies = (header = '') => Object.fromEntries(header.split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter((parts) => parts.length === 2));
const readSession = (request: any) => {
  try {
    const token = readCookies(request.headers.cookie)[COOKIE_NAME];
    if (!token) return null;
    const [payload, signature] = token.split('.');
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature ?? '');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? String(data.id) : null;
  } catch { return null; }
};
const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
};
const verifyPassword = async (password: string, stored: string) => {
  const [salt, hash] = stored.split(':');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};
const setSessionCookie = (response: any, value: string, maxAge: number) => response.setHeader('Set-Cookie', `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  if (!process.env.AUTH_SECRET) return response.status(500).json({ error: 'Máy chủ chưa cấu hình đăng nhập.' });
  if (request.method === 'GET') {
    const userId = readSession(request);
    const user = userId ? await redis.get<User>(`hanzibeat:user:${userId}`) : null;
    return response.status(200).json({ user: user ? publicUser(user) : null });
  }
  if (request.method !== 'POST') return response.status(405).json({ error: 'Không hỗ trợ.' });

  const action = String(request.body?.action ?? '');
  if (action === 'logout') {
    setSessionCookie(response, '', 0);
    return response.status(200).json({ ok: true });
  }
  const address = String(request.headers['x-forwarded-for'] ?? request.socket?.remoteAddress ?? 'guest').split(',')[0];
  const rateKey = `hanzibeat:auth-rate:${address}`;
  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, 60);
  if (attempts > 12) return response.status(429).json({ error: 'Bạn thao tác quá nhanh. Hãy thử lại sau.' });

  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password ?? '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) {
    return response.status(400).json({ error: 'Email hoặc mật khẩu không hợp lệ.' });
  }
  const emailKey = `hanzibeat:user-email:${email}`;
  if (action === 'register') {
    const name = String(request.body?.name ?? '').trim().replace(/[<>]/g, '').slice(0, 24);
    if (name.length < 2) return response.status(400).json({ error: 'Tên cần ít nhất 2 ký tự.' });
    if (await redis.exists(emailKey)) return response.status(409).json({ error: 'Email này đã được đăng ký.' });
    const id = crypto.randomUUID();
    const user: User = { id, name, email, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
    await redis.set(`hanzibeat:user:${id}`, user);
    await redis.set(emailKey, id);
    setSessionCookie(response, createSession(user), SESSION_SECONDS);
    return response.status(201).json({ user: publicUser(user) });
  }
  if (action === 'login') {
    const id = await redis.get<string>(emailKey);
    const user = id ? await redis.get<User>(`hanzibeat:user:${id}`) : null;
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return response.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }
    setSessionCookie(response, createSession(user), SESSION_SECONDS);
    return response.status(200).json({ user: publicUser(user) });
  }
  return response.status(400).json({ error: 'Thao tác không hợp lệ.' });
}
