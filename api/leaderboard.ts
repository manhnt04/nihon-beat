import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const allowedLevels = new Set(['0', '1', '2', '3']);
const allowedModes = new Set(['audition', 'typing']);

const boardKey = (level: string, mode: string) =>
  `hanzibeat:leaderboard:${level}:${mode}`;

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET') {
    const level = String(request.query.level ?? '0');
    const mode = String(request.query.mode ?? 'audition');
    if (!allowedLevels.has(level) || !allowedModes.has(mode)) {
      return response.status(400).json({ error: 'Bộ lọc không hợp lệ.' });
    }
    const raw = (await redis.zrange(boardKey(level, mode), 0, 49, {
      rev: true,
      withScores: true,
    })) as Array<string | number>;
    const entries = [];
    for (let index = 0; index < raw.length; index += 2) {
      try {
        const player =
          typeof raw[index] === 'string'
            ? JSON.parse(String(raw[index]))
            : raw[index];
        entries.push({ ...player, score: Number(raw[index + 1]) });
      } catch {
        // Ignore malformed legacy entries.
      }
    }
    return response.status(200).json({ entries });
  }

  if (request.method === 'POST') {
    const name = String(request.body?.name ?? '').trim().slice(0, 20);
    const playerId = String(request.body?.playerId ?? '').trim().slice(0, 128);
    const level = String(request.body?.level ?? '');
    const mode = String(request.body?.mode ?? '');
    const score = Math.floor(Number(request.body?.score));
    const correct = Math.floor(Number(request.body?.correct));
    if (
      name.length < 2 ||
      !allowedLevels.has(level) ||
      !allowedModes.has(mode) ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1_000_000 ||
      !Number.isFinite(correct) ||
      correct < 0 ||
      correct > 20
    ) {
      return response.status(400).json({ error: 'Điểm gửi lên không hợp lệ.' });
    }

    const address = String(
      request.headers['x-forwarded-for'] ?? request.socket?.remoteAddress ?? 'guest',
    ).split(',')[0];
    const rateKey = `hanzibeat:rate:${address}`;
    const attempts = await redis.incr(rateKey);
    if (attempts === 1) await redis.expire(rateKey, 60);
    if (attempts > 8) {
      return response.status(429).json({ error: 'Bạn gửi điểm quá nhanh.' });
    }

    const safePlayerId = playerId.replace(/[^a-zA-Z0-9_-]/g, '');
    const member = JSON.stringify({
      id: safePlayerId || crypto.randomUUID(),
      name: name.replace(/[<>]/g, ''),
      correct,
      createdAt: new Date().toISOString(),
    });
    const key = boardKey(level, mode);
    if (safePlayerId) {
      const existing = (await redis.zrange(key, 0, -1, {
        withScores: true,
      })) as Array<unknown>;
      const previousMembers: unknown[] = [];
      let previousBest = -1;
      for (let index = 0; index < existing.length; index += 2) {
        const item = existing[index];
        try {
          const player = typeof item === 'string' ? JSON.parse(item) : item;
          if ((player as { id?: string })?.id === safePlayerId) {
            previousMembers.push(item);
            previousBest = Math.max(previousBest, Number(existing[index + 1]));
          }
        } catch {
          // Ignore malformed legacy entries.
        }
      }
      if (previousBest > score) return response.status(200).json({ ok: true, retainedBest: true });
      if (previousMembers.length) await redis.zrem(key, ...previousMembers);
    }
    await redis.zadd(key, { score, member });
    await redis.zremrangebyrank(key, 0, -101);
    return response.status(201).json({ ok: true });
  }

  response.setHeader('Allow', 'GET, POST');
  return response.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
}
