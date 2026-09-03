import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const firebaseApiKey = 'AIzaSyDBseWlQG56fdyiPjl8dMNLOmKDQEGGFKM';

type DailyProgress = {
  date: string;
  correct: number;
  offlineMatches: number;
  pvpMatches: number;
  dailyCompleted: boolean;
  questionXp: number;
  matchXp: number;
  offlineJade: number;
  rewardedPvpMatches: number;
  stampEarned: boolean;
};

type Progression = {
  uid: string;
  name: string;
  xp: number;
  level: number;
  jade: number;
  streak: number;
  lastStampDate: string | null;
  stamps: number;
  inventory: Record<string, number>;
  daily: DailyProgress;
};

const bangkokDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const emptyDaily = (date: string): DailyProgress => ({
  date, correct: 0, offlineMatches: 0, pvpMatches: 0, dailyCompleted: false,
  questionXp: 0, matchXp: 0, offlineJade: 0, rewardedPvpMatches: 0, stampEarned: false,
});

const levelFromXp = (xp: number) => {
  let level = 1;
  let remaining = xp;
  while (level < 100) {
    const required = 100 + 30 * level + 3 * level * level;
    if (remaining < required) return { level, currentXp: remaining, nextXp: required };
    remaining -= required;
    level += 1;
  }
  return { level: 100, currentXp: remaining, nextXp: 0 };
};

const taskCount = (daily: DailyProgress) => [
  daily.correct >= 20,
  daily.dailyCompleted,
  daily.offlineMatches >= 1,
  daily.pvpMatches >= 2,
].filter(Boolean).length;

const publicProgression = (progression: Progression) => ({
  ...progression,
  levelProgress: levelFromXp(progression.xp),
  completedTasks: taskCount(progression.daily),
});

const verifyUser = async (request: any) => {
  const authorization = String(request.headers.authorization ?? '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  if (!result.ok) return null;
  const data = await result.json() as { users?: Array<{ localId: string; displayName?: string; email?: string }> };
  return data.users?.[0] ?? null;
};

const loadProgression = async (uid: string, name: string) => {
  const key = `hanzibeat:progression:${uid}`;
  const stored = await redis.get<Progression>(key);
  const date = bangkokDate();
  const progression: Progression = stored ?? {
    uid, name, xp: 0, level: 1, jade: 0, streak: 0,
    lastStampDate: null, stamps: 0, inventory: {}, daily: emptyDaily(date),
  };
  progression.name = name || progression.name;
  if (progression.daily.date !== date) progression.daily = emptyDaily(date);
  progression.daily.matchXp = Number(progression.daily.matchXp ?? 0);
  progression.inventory = progression.inventory ?? {};
  return progression;
};

const dayDistance = (from: string, to: string) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
};

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  const user = await verifyUser(request).catch(() => null);
  if (!user) return response.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
  const name = String(user.displayName || user.email || 'Người chơi').slice(0, 24);
  const progression = await loadProgression(user.localId, name);

  if (request.method === 'GET') {
    return response.status(200).json({ progression: publicProgression(progression) });
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  }

  const action = String(request.body?.action ?? '');
  if (action === 'start-match') {
    const kind = ['offline', 'daily', 'pvp'].includes(request.body?.kind)
      ? request.body.kind : 'offline';
    const sessionId = crypto.randomUUID();
    await redis.set(`hanzibeat:reward-session:${sessionId}`, {
      uid: user.localId, kind, startedAt: Date.now(),
      mode: String(request.body?.mode ?? ''), level: Number(request.body?.level ?? 1),
    }, { ex: 1800 });
    return response.status(201).json({ sessionId });
  }

  if (action === 'finish-match') {
    const sessionId = String(request.body?.sessionId ?? '');
    const sessionKey = `hanzibeat:reward-session:${sessionId}`;
    const session = await redis.getdel<{ uid: string; kind: 'offline' | 'daily' | 'pvp'; startedAt: number }>(sessionKey);
    if (!session || session.uid !== user.localId) {
      return response.status(409).json({ error: 'Trận đã được nhận thưởng hoặc không hợp lệ.' });
    }
    const correct = Math.max(0, Math.min(20, Math.floor(Number(request.body?.correct ?? 0))));
    const elapsed = Date.now() - session.startedAt;
    if (!Number.isFinite(correct) || elapsed < 5_000 || elapsed > 1_800_000) {
      return response.status(400).json({ error: 'Kết quả trận không hợp lệ.' });
    }

    const daily = progression.daily;
    const availableQuestionXp = Math.max(0, 300 - daily.questionXp);
    const questionXp = Math.min(correct * 2, availableQuestionXp);
    daily.questionXp += questionXp;
    daily.correct += correct;
    let requestedBonusXp = 10;
    let jadeEarned = 0;
    if (session.kind === 'daily') {
      requestedBonusXp = daily.dailyCompleted ? 0 : 30;
      if (!daily.dailyCompleted) {
        jadeEarned = 5;
        progression.inventory['daily-chest'] = Number(progression.inventory['daily-chest'] ?? 0) + 1;
      }
      daily.dailyCompleted = true;
    } else if (session.kind === 'pvp') {
      requestedBonusXp = daily.rewardedPvpMatches < 10 ? 8 : 0;
      daily.pvpMatches += 1;
      if (daily.rewardedPvpMatches < 10) {
        jadeEarned = 3;
        daily.rewardedPvpMatches += 1;
      }
    } else {
      daily.offlineMatches += 1;
      jadeEarned = Math.min(2, Math.max(0, 20 - daily.offlineJade));
      daily.offlineJade += jadeEarned;
    }
    const bonusXp = Math.min(requestedBonusXp, Math.max(0, 150 - daily.matchXp));
    daily.matchXp += bonusXp;
    progression.xp += questionXp + bonusXp;
    progression.jade += jadeEarned;

    if (taskCount(daily) >= 3 && !daily.stampEarned) {
      daily.stampEarned = true;
      progression.stamps += 1;
      progression.inventory['daily-seal'] = Number(progression.inventory['daily-seal'] ?? 0) + 1;
      const distance = progression.lastStampDate
        ? dayDistance(progression.lastStampDate, daily.date) : 0;
      progression.streak = distance === 1 ? progression.streak + 1 : 1;
      progression.lastStampDate = daily.date;
      progression.xp += 50;
      progression.jade += 5;
    }
    progression.level = levelFromXp(progression.xp).level;
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({
      progression: publicProgression(progression),
      reward: { xp: questionXp + bonusXp, jade: jadeEarned },
    });
  }

  return response.status(400).json({ error: 'Thao tác không hợp lệ.' });
}
