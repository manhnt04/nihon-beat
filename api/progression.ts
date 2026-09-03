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
  ownedCosmetics: string[];
  equipped: { frame: string | null; seal: string | null; effect: string | null };
  lastGuardUseDate: string | null;
  discoveries: string[];
  jadeRelics: string[];
  castle: {
    wood: number;
    ink: number;
    buildings: { main: number; library: number; listening: number };
  };
  daily: DailyProgress;
};

const castleBuildings = {
  main: { max: 10, baseWood: 80, baseInk: 25 },
  library: { max: 10, baseWood: 55, baseInk: 40 },
  listening: { max: 10, baseWood: 65, baseInk: 35 },
} as const;

const shopCatalog = {
  'streak-guard': { price: 30, type: 'consumable' },
  'effect-jade': { price: 60, type: 'effect' },
  'seal-scholar': { price: 100, type: 'seal' },
  'frame-cinnabar': { price: 150, type: 'frame' },
  'effect-golden': { price: 180, type: 'effect' },
  'frame-dragon': { price: 300, type: 'frame' },
} as const;

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
    lastStampDate: null, stamps: 0, inventory: {}, ownedCosmetics: [],
    equipped: { frame: null, seal: null, effect: null }, lastGuardUseDate: null,
    discoveries: [], jadeRelics: [],
    castle: { wood: 0, ink: 0, buildings: { main: 1, library: 1, listening: 1 } },
    daily: emptyDaily(date),
  };
  progression.name = name || progression.name;
  if (progression.daily.date !== date) progression.daily = emptyDaily(date);
  progression.daily.matchXp = Number(progression.daily.matchXp ?? 0);
  progression.inventory = progression.inventory ?? {};
  progression.ownedCosmetics = progression.ownedCosmetics ?? [];
  progression.equipped = progression.equipped ?? { frame: null, seal: null, effect: null };
  progression.lastGuardUseDate = progression.lastGuardUseDate ?? null;
  progression.discoveries = progression.discoveries ?? [];
  progression.jadeRelics = progression.jadeRelics ?? [];
  progression.castle = progression.castle ?? { wood: 0, ink: 0, buildings: { main: 1, library: 1, listening: 1 } };
  progression.castle.wood = Number(progression.castle.wood ?? 0);
  progression.castle.ink = Number(progression.castle.ink ?? 0);
  progression.castle.buildings = progression.castle.buildings ?? { main: 1, library: 1, listening: 1 };
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
  const normalizedEmail = String(user.email ?? '').trim().toLowerCase();
  const grantKey = `hanzibeat:special-grant:all-items-999:${user.localId}`;
  if (normalizedEmail === 'manhnt@gmail.com' && !await redis.get(grantKey)) {
    progression.jade = Math.max(999, progression.jade);
    progression.inventory['daily-seal'] = 999;
    progression.inventory['daily-chest'] = 999;
    progression.inventory['streak-guard'] = 999;
    for (const itemId of Object.keys(shopCatalog)) progression.inventory[itemId] = 999;
    progression.ownedCosmetics = Array.from(new Set([
      ...progression.ownedCosmetics,
      ...Object.entries(shopCatalog)
        .filter(([, item]) => item.type !== 'consumable')
        .map(([itemId]) => itemId),
    ]));
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    await redis.set(grantKey, { grantedAt: new Date().toISOString(), email: normalizedEmail });
  }
  const castleGrantKey = `hanzibeat:special-grant:castle-resources-99999:${user.localId}`;
  if (normalizedEmail === 'manhnt@gmail.com' && !await redis.get(castleGrantKey)) {
    progression.castle.wood = Math.max(99_999, progression.castle.wood);
    progression.castle.ink = Math.max(99_999, progression.castle.ink);
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    await redis.set(castleGrantKey, { grantedAt: new Date().toISOString(), email: normalizedEmail });
  }

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

  if (action === 'buy-item') {
    const itemId = String(request.body?.itemId ?? '') as keyof typeof shopCatalog;
    const item = shopCatalog[itemId];
    if (!item) return response.status(400).json({ error: 'Vật phẩm không tồn tại.' });
    if (item.type !== 'consumable' && progression.ownedCosmetics.includes(itemId)) {
      return response.status(409).json({ error: 'Bạn đã sở hữu vật phẩm này.' });
    }
    if (progression.jade < item.price) return response.status(409).json({ error: 'Không đủ Mảnh Ngọc.' });
    if (itemId === 'streak-guard' && Number(progression.inventory[itemId] ?? 0) >= 2) {
      return response.status(409).json({ error: 'Chỉ được giữ tối đa 2 Hộ Ấn.' });
    }
    progression.jade -= item.price;
    if (item.type === 'consumable') {
      progression.inventory[itemId] = Number(progression.inventory[itemId] ?? 0) + 1;
    } else {
      progression.ownedCosmetics.push(itemId);
    }
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({ progression: publicProgression(progression), purchased: itemId });
  }

  if (action === 'equip-item') {
    const itemId = String(request.body?.itemId ?? '') as keyof typeof shopCatalog;
    const item = shopCatalog[itemId];
    if (!item || item.type === 'consumable' || !progression.ownedCosmetics.includes(itemId)) {
      return response.status(403).json({ error: 'Bạn chưa sở hữu cosmetic này.' });
    }
    progression.equipped[item.type] = progression.equipped[item.type] === itemId ? null : itemId;
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({ progression: publicProgression(progression), equipped: itemId });
  }

  if (action === 'open-chest') {
    const chestCount = Number(progression.inventory['daily-chest'] ?? 0);
    if (chestCount < 1) return response.status(409).json({ error: 'Bạn không có Rương Hằng Ngày.' });
    progression.inventory['daily-chest'] = chestCount - 1;
    const roll = crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296;
    const jadeReward = 5 + Math.floor(roll * 4);
    const xpReward = 30;
    progression.jade += jadeReward;
    progression.xp += xpReward;
    progression.level = levelFromXp(progression.xp).level;
    let bonus: string | null = null;
    if (roll < 0.02 && !progression.ownedCosmetics.includes('frame-cinnabar')) {
      bonus = 'frame-cinnabar';
      progression.ownedCosmetics.push(bonus);
    } else if (roll < 0.12 && !progression.ownedCosmetics.includes('seal-scholar')) {
      bonus = 'seal-scholar';
      progression.ownedCosmetics.push(bonus);
    }
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({
      progression: publicProgression(progression),
      chestReward: { jade: jadeReward, xp: xpReward, bonus },
    });
  }

  if (action === 'upgrade-castle') {
    const buildingId = String(request.body?.itemId ?? '') as keyof typeof castleBuildings;
    const building = castleBuildings[buildingId];
    if (!building) return response.status(400).json({ error: 'Công trình không tồn tại.' });
    const currentLevel = Math.max(1, Number(progression.castle.buildings[buildingId] ?? 1));
    if (currentLevel >= building.max) return response.status(409).json({ error: 'Công trình đã đạt cấp tối đa.' });
    const woodCost = building.baseWood * currentLevel;
    const inkCost = building.baseInk * currentLevel;
    if (progression.castle.wood < woodCost || progression.castle.ink < inkCost) {
      return response.status(409).json({ error: `Cần ${woodCost} Gỗ và ${inkCost} Mực để nâng cấp.` });
    }
    progression.castle.wood -= woodCost;
    progression.castle.ink -= inkCost;
    progression.castle.buildings[buildingId] = currentLevel + 1;
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({ progression: publicProgression(progression), upgraded: buildingId });
  }

  if (action === 'finish-match') {
    const sessionId = String(request.body?.sessionId ?? '');
    const sessionKey = `hanzibeat:reward-session:${sessionId}`;
    const session = await redis.getdel<{ uid: string; kind: 'offline' | 'daily' | 'pvp'; startedAt: number }>(sessionKey);
    if (!session || session.uid !== user.localId) {
      return response.status(409).json({ error: 'Trận đã được nhận thưởng hoặc không hợp lệ.' });
    }
    const correct = Math.max(0, Math.min(20, Math.floor(Number(request.body?.correct ?? 0))));
    const encountered = Array.isArray(request.body?.encountered)
      ? request.body.encountered.slice(0, 20)
        .map((value: unknown) => String(value).trim().slice(0, 8))
        .filter(Boolean)
      : [];
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
      requestedBonusXp = 0;
      daily.pvpMatches += 1;
      jadeEarned = 0;
    } else {
      daily.offlineMatches += 1;
      jadeEarned = Math.min(2, Math.max(0, 20 - daily.offlineJade));
      daily.offlineJade += jadeEarned;
    }
    const bonusXp = Math.min(requestedBonusXp, Math.max(0, 150 - daily.matchXp));
    daily.matchXp += bonusXp;
    progression.xp += questionXp + bonusXp;
    progression.jade += jadeEarned;
    const castleWood = Math.min(30, correct + (session.kind === 'daily' ? 10 : session.kind === 'pvp' ? 5 : 2));
    const castleInk = Math.min(15, Math.floor(correct / 3) + (session.kind === 'daily' ? 5 : session.kind === 'pvp' ? 3 : 1));
    progression.castle.wood += castleWood;
    progression.castle.ink += castleInk;
    progression.discoveries = Array.from(new Set([...progression.discoveries, ...encountered])).slice(0, 3000);
    if (progression.discoveries.length >= 25 && !progression.jadeRelics.includes('sprout')) progression.jadeRelics.push('sprout');
    if (progression.discoveries.length >= 100 && !progression.jadeRelics.includes('scholar')) progression.jadeRelics.push('scholar');
    if (progression.discoveries.length >= 250 && !progression.jadeRelics.includes('dragon')) progression.jadeRelics.push('dragon');

    if (taskCount(daily) >= 3 && !daily.stampEarned) {
      daily.stampEarned = true;
      progression.stamps += 1;
      progression.inventory['daily-seal'] = Number(progression.inventory['daily-seal'] ?? 0) + 1;
      const distance = progression.lastStampDate
        ? dayDistance(progression.lastStampDate, daily.date) : 0;
      const guardAvailable = Number(progression.inventory['streak-guard'] ?? 0) > 0;
      const guardReady = !progression.lastGuardUseDate || dayDistance(progression.lastGuardUseDate, daily.date) >= 7;
      if (distance === 2 && guardAvailable && guardReady) {
        progression.inventory['streak-guard'] -= 1;
        progression.lastGuardUseDate = daily.date;
        progression.streak += 1;
      } else {
        progression.streak = distance === 1 ? progression.streak + 1 : 1;
      }
      progression.lastStampDate = daily.date;
      progression.xp += 50;
      progression.jade += 5;
    }
    progression.level = levelFromXp(progression.xp).level;
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({
      progression: publicProgression(progression),
      reward: { xp: questionXp + bonusXp, jade: jadeEarned, wood: castleWood, ink: castleInk },
    });
  }

  return response.status(400).json({ error: 'Thao tác không hợp lệ.' });
}
