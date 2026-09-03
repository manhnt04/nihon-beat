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
  coins: number;
  streak: number;
  lastStampDate: string | null;
  stamps: number;
  inventory: Record<string, number>;
  ownedCosmetics: string[];
  equipped: { frame: string | null; seal: string | null; effect: string | null };
  lastGuardUseDate: string | null;
  discoveries: string[];
  jadeRelics: string[];
  spins: {
    balance: number;
    recoveryUpdatedAt: number;
    dailyDate: string;
    offlineEarned: number;
    pvpEarned: number;
    dailyClaimed: boolean;
  };
  castle: {
    wood: number;
    ink: number;
    jadeBonusCarry: number;
    shieldActiveUntil: number;
    buildings: { main: number; library: number; listening: number };
  };
  daily: DailyProgress;
};

const castleBuildings = {
  main: { max: 10, coinScale: 1, woodScale: 1, inkScale: 1 },
  library: { max: 10, coinScale: .65, woodScale: .7, inkScale: 1.2 },
  listening: { max: 10, coinScale: .75, woodScale: .85, inkScale: 1 },
} as const;

const mainCastleUpgradeCosts = {
  coin: [0, 0, 5_000, 12_000, 30_000, 70_000, 150_000, 300_000, 550_000, 1_000_000],
  wood: [0, 0, 120, 250, 500, 900, 1_500, 2_400, 3_600, 5_200],
  ink: [0, 0, 40, 80, 160, 300, 520, 850, 1_300, 1_900],
} as const;
const castleUpgradeCost = (building: typeof castleBuildings[keyof typeof castleBuildings], currentLevel: number) => {
  const targetLevel = Math.min(10, currentLevel + 1);
  return {
    coin: Math.round(mainCastleUpgradeCosts.coin[targetLevel] * building.coinScale),
    wood: Math.round(mainCastleUpgradeCosts.wood[targetLevel] * building.woodScale),
    ink: Math.round(mainCastleUpgradeCosts.ink[targetLevel] * building.inkScale),
  };
};

const mainCastleLevelRequirements = [0, 0, 5, 10, 15, 22, 30, 40, 52, 66, 82];
const mainCastleJadeBonusRates = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10];
const SPIN_RECOVERY_CAP = 24;
const SPIN_RECOVERY_MS = 60 * 60 * 1000;
const castleJadeBonusRate = (mainLevel: number) => mainCastleJadeBonusRates[Math.max(1, Math.min(10, mainLevel))] ?? 0;
const applyCastleJadeBonus = (progression: Progression, baseJade: number) => {
  const rate = castleJadeBonusRate(Number(progression.castle.buildings.main ?? 1));
  const accumulated = Number(progression.castle.jadeBonusCarry ?? 0) + baseJade * rate / 100;
  const bonus = Math.floor(accumulated + 1e-9);
  progression.castle.jadeBonusCarry = Number((accumulated - bonus).toFixed(4));
  return { bonus, rate };
};

const normalizeSpins = (progression: Progression, date: string) => {
  const now = Date.now();
  progression.spins = progression.spins ?? {
    balance: 24, recoveryUpdatedAt: now, dailyDate: date,
    offlineEarned: 0, pvpEarned: 0, dailyClaimed: false,
  };
  progression.spins.balance = Math.max(0, Math.floor(Number(progression.spins.balance ?? 0)));
  progression.spins.recoveryUpdatedAt = Number(progression.spins.recoveryUpdatedAt ?? now);
  if (progression.spins.dailyDate !== date) {
    progression.spins.dailyDate = date;
    progression.spins.offlineEarned = 0;
    progression.spins.pvpEarned = 0;
    progression.spins.dailyClaimed = false;
    progression.spins.balance = Math.min(200, progression.spins.balance + 3);
  }
  if (progression.spins.balance < SPIN_RECOVERY_CAP) {
    const recovered = Math.floor((now - progression.spins.recoveryUpdatedAt) / SPIN_RECOVERY_MS);
    if (recovered > 0) {
      progression.spins.balance = Math.min(SPIN_RECOVERY_CAP, progression.spins.balance + recovered);
      progression.spins.recoveryUpdatedAt += recovered * SPIN_RECOVERY_MS;
    }
  } else {
    progression.spins.recoveryUpdatedAt = now;
  }
};

const slotSymbols = [
  { id: 'coin', label: 'Coin', weight: 45 },
  { id: 'spin', label: 'Spin', weight: 35 },
  { id: 'wood', label: 'Gỗ', weight: 6 },
  { id: 'ink', label: 'Mực', weight: 5 },
  { id: 'jade', label: 'Mảnh Ngọc', weight: 3 },
  { id: 'chest', label: 'Rương', weight: 3 },
  { id: 'shield', label: 'Khiên Thành', weight: 1.5 },
  { id: 'ticket', label: 'Vé Công Thành', weight: 1 },
  { id: 'rare', label: 'Mảnh Thiên Mệnh', weight: .45 },
  { id: 'jackpot', label: 'Jackpot', weight: .05 },
] as const;

const randomUnit = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296;
const rollSlotSymbol = () => {
  let roll = randomUnit() * 100;
  return slotSymbols.find((entry) => ((roll -= entry.weight) < 0)) ?? slotSymbols[0];
};

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
    uid, name, xp: 0, level: 1, jade: 0, coins: 0, streak: 0,
    lastStampDate: null, stamps: 0, inventory: {}, ownedCosmetics: [],
    equipped: { frame: null, seal: null, effect: null }, lastGuardUseDate: null,
    discoveries: [], jadeRelics: [],
    spins: { balance: 24, recoveryUpdatedAt: Date.now(), dailyDate: date, offlineEarned: 0, pvpEarned: 0, dailyClaimed: false },
    castle: { wood: 0, ink: 0, jadeBonusCarry: 0, shieldActiveUntil: 0, buildings: { main: 1, library: 1, listening: 1 } },
    daily: emptyDaily(date),
  };
  progression.name = name || progression.name;
  progression.coins = Math.max(0, Math.floor(Number(progression.coins ?? 0)));
  if (progression.daily.date !== date) progression.daily = emptyDaily(date);
  progression.daily.matchXp = Number(progression.daily.matchXp ?? 0);
  progression.inventory = progression.inventory ?? {};
  progression.ownedCosmetics = progression.ownedCosmetics ?? [];
  progression.equipped = progression.equipped ?? { frame: null, seal: null, effect: null };
  progression.lastGuardUseDate = progression.lastGuardUseDate ?? null;
  progression.discoveries = progression.discoveries ?? [];
  progression.jadeRelics = progression.jadeRelics ?? [];
  normalizeSpins(progression, date);
  progression.castle = progression.castle ?? { wood: 0, ink: 0, jadeBonusCarry: 0, shieldActiveUntil: 0, buildings: { main: 1, library: 1, listening: 1 } };
  progression.castle.wood = Number(progression.castle.wood ?? 0);
  progression.castle.ink = Number(progression.castle.ink ?? 0);
  progression.castle.jadeBonusCarry = Number(progression.castle.jadeBonusCarry ?? 0);
  progression.castle.shieldActiveUntil = Number(progression.castle.shieldActiveUntil ?? 0);
  if (progression.castle.shieldActiveUntil <= Date.now()) progression.castle.shieldActiveUntil = 0;
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
    progression.coins = Math.max(99_999, progression.coins);
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    await redis.set(castleGrantKey, { grantedAt: new Date().toISOString(), email: normalizedEmail });
  }
  const coinGrantKey = `hanzibeat:special-grant:castle-coins-99999:${user.localId}`;
  if (normalizedEmail === 'manhnt@gmail.com' && !await redis.get(coinGrantKey)) {
    progression.coins = Math.max(99_999, progression.coins);
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    await redis.set(coinGrantKey, { grantedAt: new Date().toISOString(), email: normalizedEmail });
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

  if (action === 'use-castle-item') {
    const itemId = String(request.body?.itemId ?? '');
    const quantity = Number(progression.inventory[itemId] ?? 0);
    if (!['siege-ticket', 'castle-shield'].includes(itemId)) {
      return response.status(400).json({ error: 'Vật phẩm Công Thành không hợp lệ.' });
    }
    if (quantity < 1) return response.status(409).json({ error: 'Bạn không có vật phẩm này.' });
    progression.inventory[itemId] = quantity - 1;
    if (itemId === 'castle-shield') {
      progression.castle.shieldActiveUntil = Math.max(Date.now(), progression.castle.shieldActiveUntil) + 24 * 60 * 60 * 1000;
      await redis.set(`hanzibeat:progression:${user.localId}`, progression);
      return response.status(200).json({ progression: publicProgression(progression), castleEffect: { type: 'shield', shieldActiveUntil: progression.castle.shieldActiveUntil } });
    }
    const siegeReward = {
      coins: 1_000 + Math.floor(randomUnit() * 1_501),
      wood: 40 + Math.floor(randomUnit() * 31),
      ink: 15 + Math.floor(randomUnit() * 16),
    };
    progression.coins += siegeReward.coins;
    progression.castle.wood += siegeReward.wood;
    progression.castle.ink += siegeReward.ink;
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({ progression: publicProgression(progression), castleEffect: { type: 'siege', rewards: siegeReward } });
  }

  if (action === 'spin-wheel') {
    normalizeSpins(progression, bangkokDate());
    if (progression.spins.balance < 1) return response.status(409).json({ error: 'Bạn đã hết lượt quay.' });
    const spinLockKey = `hanzibeat:spin-lock:${user.localId}`;
    const spinLock = await redis.set(spinLockKey, '1', { nx: true, ex: 5 });
    if (!spinLock) return response.status(429).json({ error: 'Vòng quay đang xử lý lượt trước.' });
    progression.spins.balance -= 1;
    const reels = [rollSlotSymbol(), rollSlotSymbol(), rollSlotSymbol()];
    const triple = reels.every((symbol) => symbol.id === reels[0].id);
    const rewards = { coins: 0, spins: 0, wood: 0, ink: 0, jade: 0, chests: 0, shields: 0, tickets: 0, fragments: 0, jackpots: 0 };
    const coinCount = reels.filter((symbol) => symbol.id === 'coin').length;
    if (coinCount > 0) {
      const smallCoinBag = 8 + Math.floor(randomUnit() * 5);
      const coinBagMultiplier = [0, 1, 3, 4][coinCount];
      rewards.coins = smallCoinBag * coinBagMultiplier;
    }
    if (triple) {
      const id = reels[0].id;
      if (id === 'spin') rewards.spins = 24;
      else if (id === 'wood') rewards.wood = 120;
      else if (id === 'ink') rewards.ink = 80;
      else if (id === 'jade') rewards.jade = 12;
      else if (id === 'chest') rewards.chests = 3;
      else if (id === 'shield') rewards.shields = 3;
      else if (id === 'ticket') rewards.tickets = 4;
      else if (id === 'rare') rewards.fragments = 6;
      else if (id === 'jackpot') { rewards.coins = 2_500; rewards.jade = 25; rewards.jackpots = 1; }
    }
    progression.coins += rewards.coins;
    progression.spins.balance = Math.min(200, progression.spins.balance + rewards.spins);
    progression.castle.wood += rewards.wood;
    progression.castle.ink += rewards.ink;
    progression.jade += rewards.jade;
    progression.inventory['daily-chest'] = Number(progression.inventory['daily-chest'] ?? 0) + rewards.chests;
    progression.inventory['castle-shield'] = Math.min(5, Number(progression.inventory['castle-shield'] ?? 0) + rewards.shields);
    progression.inventory['siege-ticket'] = Math.min(20, Number(progression.inventory['siege-ticket'] ?? 0) + rewards.tickets);
    progression.inventory['destiny-fragment'] = Number(progression.inventory['destiny-fragment'] ?? 0) + rewards.fragments;
    progression.inventory['celestial-jackpot'] = Number(progression.inventory['celestial-jackpot'] ?? 0) + rewards.jackpots;
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    await redis.del(spinLockKey);
    return response.status(200).json({ progression: publicProgression(progression), slotResult: { reels: reels.map((symbol) => symbol.id), rewards, triple } });
  }

  if (action === 'upgrade-castle') {
    const buildingId = String(request.body?.itemId ?? '') as keyof typeof castleBuildings;
    const building = castleBuildings[buildingId];
    if (!building) return response.status(400).json({ error: 'Công trình không tồn tại.' });
    const currentLevel = Math.max(1, Number(progression.castle.buildings[buildingId] ?? 1));
    if (currentLevel >= building.max) return response.status(409).json({ error: 'Công trình đã đạt cấp tối đa.' });
    const mainLevel = Math.max(1, Number(progression.castle.buildings.main ?? 1));
    if (buildingId === 'main') {
      const lowestSupportLevel = Math.min(
        Number(progression.castle.buildings.library ?? 1),
        Number(progression.castle.buildings.listening ?? 1),
      );
      if (lowestSupportLevel < currentLevel) {
        return response.status(409).json({ error: `Thư Thục và Thính Âm Các phải cùng đạt Lv.${currentLevel}.` });
      }
      const requiredPlayerLevel = mainCastleLevelRequirements[currentLevel + 1] ?? 100;
      if (progression.level < requiredPlayerLevel) {
        return response.status(409).json({ error: `Tài khoản phải đạt Lv.${requiredPlayerLevel} để nâng Nhà Chính.` });
      }
    } else if (currentLevel >= mainLevel) {
      return response.status(409).json({ error: `Hãy nâng Nhà Chính lên Lv.${mainLevel + 1} trước.` });
    }
    const { wood: woodCost, ink: inkCost, coin: coinCost } = castleUpgradeCost(building, currentLevel);
    if (progression.castle.wood < woodCost || progression.castle.ink < inkCost || progression.coins < coinCost) {
      return response.status(409).json({ error: `Cần ${coinCost} Coin, ${woodCost} Gỗ và ${inkCost} Mực để nâng cấp.` });
    }
    progression.castle.wood -= woodCost;
    progression.castle.ink -= inkCost;
    progression.coins -= coinCost;
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
    let spinEarned = 0;
    if (session.kind === 'daily' && !progression.spins.dailyClaimed) {
      spinEarned = 5 + (correct >= 15 ? 2 : 0) + (correct === 20 ? 1 : 0);
      progression.spins.dailyClaimed = true;
    } else if (session.kind === 'offline') {
      const requestedSpins = 1 + (correct >= 15 ? 1 : 0) + (correct === 20 ? 1 : 0);
      spinEarned = Math.min(requestedSpins, Math.max(0, 20 - progression.spins.offlineEarned));
      progression.spins.offlineEarned += spinEarned;
    }
    progression.spins.balance = Math.min(200, progression.spins.balance + spinEarned);
    const bonusXp = Math.min(requestedBonusXp, Math.max(0, 150 - daily.matchXp));
    daily.matchXp += bonusXp;
    progression.xp += questionXp + bonusXp;
    const castleJadeBonus = applyCastleJadeBonus(progression, jadeEarned);
    progression.jade += jadeEarned + castleJadeBonus.bonus;
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
      reward: {
        xp: questionXp + bonusXp,
        jade: jadeEarned + castleJadeBonus.bonus,
        baseJade: jadeEarned,
        castleBonusJade: castleJadeBonus.bonus,
        castleBonusRate: castleJadeBonus.rate,
        spins: spinEarned,
        wood: castleWood,
        ink: castleInk,
      },
    });
  }

  return response.status(400).json({ error: 'Thao tác không hợp lệ.' });
}
