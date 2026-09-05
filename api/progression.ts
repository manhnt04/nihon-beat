import { Redis } from '@upstash/redis';

type PassReward = {
  type: 'jade' | 'crystals' | 'xp' | 'item' | 'cosmetic' | 'collectible';
  name: string;
  amount?: number;
  id?: string;
  icon: string;
};

const freeSpecial: Record<number, PassReward> = {
  1: { type: 'cosmetic', id: 'avatar-apprentice-s1', name: 'Avatar Học Đồ', icon: '🧑‍🎓' },
  5: { type: 'item', id: 'protect-charm', amount: 1, name: 'Hộ Thân Phù ×1', icon: '🛡️' },
  10: { type: 'cosmetic', id: 'avatar-scholar-s1', name: 'Avatar Học Giả', icon: '👨‍🏫' },
  15: { type: 'item', id: 'enlightenment-pill', amount: 1, name: 'Khai Khiếu Đan ×1', icon: '📜' },
  20: { type: 'cosmetic', id: 'music-bamboo-s1', name: 'Nhạc Khúc Trúc Lâm', icon: '🎵' },
  25: { type: 'cosmetic', id: 'frame-cloud-s1', name: 'Khung Thanh Vân', icon: '☁️' },
  30: { type: 'item', id: 'diamond-guard', amount: 1, name: 'Kim Cương Tráo ×1', icon: '💠' },
  35: { type: 'cosmetic', id: 'seal-cloud-s1', name: 'Ấn Thanh Vân', icon: '🪭' },
  40: { type: 'item', id: 'revenge-order', amount: 1, name: 'Ân Oán Lệnh ×1', icon: '⚔️' },
  45: { type: 'cosmetic', id: 'title-cloud-scholar-s1', name: 'Danh hiệu Thanh Vân Học Sĩ', icon: '🏷️' },
  50: { type: 'cosmetic', id: 'seal-mythic-cloud-s1', name: 'Ấn Thanh Vân · Mythic', icon: '🌫️' },
};

const premiumSpecial: Record<number, PassReward> = {
  1: { type: 'cosmetic', id: 'avatar-longmai-s1', name: 'Avatar Long Mạch', icon: '🐲' },
  2: { type: 'cosmetic', id: 'avatar-swordsman-s1', name: 'Avatar Kiếm Khách', icon: '⚔️' },
  6: { type: 'cosmetic', id: 'music-moon-s1', name: 'Nhạc Nguyệt Hạ Trường An', icon: '🎶' },
  10: { type: 'cosmetic', id: 'effect-leaves-s1', name: 'Hiệu ứng Lá Rơi', icon: '🍂' },
  12: { type: 'cosmetic', id: 'avatar-taoist-s1', name: 'Avatar Đạo Sĩ', icon: '🧙' },
  16: { type: 'cosmetic', id: 'seal-jade-s1', name: 'Ấn Ngọc', icon: '🔰' },
  18: { type: 'cosmetic', id: 'title-longmai-s1', name: 'Danh hiệu Long Mạch Sứ Giả', icon: '🏷️' },
  22: { type: 'cosmetic', id: 'avatar-musician-s1', name: 'Avatar Nhạc Sư', icon: '🪕' },
  25: { type: 'cosmetic', id: 'effect-ice-s1', name: 'Hiệu ứng Băng Tinh', icon: '❄️' },
  30: { type: 'cosmetic', id: 'music-dragon-s1', name: 'Nhạc Long Ngâm', icon: '🎼' },
  36: { type: 'cosmetic', id: 'avatar-phoenix-s1', name: 'Avatar Phượng Sư', icon: '🦚' },
  40: { type: 'cosmetic', id: 'frame-longmai-s1', name: 'Khung Long Mạch', icon: '🐉' },
  44: { type: 'cosmetic', id: 'seal-gold-s1', name: 'Ấn Hoàng Kim', icon: '👑' },
  46: { type: 'cosmetic', id: 'avatar-dragon-s1', name: 'Avatar Long Thần', icon: '🐉' },
  49: { type: 'cosmetic', id: 'effect-dragon-aura-s1', name: 'Hiệu ứng Long Uy', icon: '🔥' },
  50: { type: 'cosmetic', id: 'relic-azure-dragon-s1', name: 'Ngọc Bội Thanh Long · Mythic', icon: '💚' },
};

const crystalTiers = new Set([4, 8, 14, 20, 28, 34, 42, 48]);

const BATTLE_PASS_TIERS = Array.from({ length: 50 }, (_, index) => {
  const tier = index + 1;
  const free = freeSpecial[tier] ?? { type: 'jade' as const, amount: 13, name: '13 Mảnh Ngọc', icon: '💎' };
  const premium = premiumSpecial[tier] ?? (crystalTiers.has(tier)
    ? { type: 'crystals' as const, amount: 10, name: '10 Linh Thạch', icon: '🔮' }
    : { type: 'collectible' as const, id: 'longmai-medal-s1', amount: 1, name: 'Huy Chương Long Mạch', icon: '🏅' });
  return { tier, xpReq: tier * 100, free, premium };
});

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
  dragonCrystals: number;
  coins: number;
  streak: number;
  lastStampDate: string | null;
  stamps: number;
  inventory: Record<string, number>;
  inventoryExpiries: Record<string, number>;
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
    shieldCount: number;
    likes: number;
    theme: string;
    ownedThemes: string[];
    decorations: {
      theme: string;
      weather: string | null;
      guardian: string | null;
      banner: string | null;
    };
    ownedDecorations: string[];
    attackEnergy: number;
    attackUpdatedAt: number;
    peaceUntil: number;
    newbieUntil: number;
    newbieProtected: boolean;
    newbieProtectionEndedAt: number;
    newbieProtectionReason: 'hammer' | 'shield' | null;
    damagedBuildings: Record<string, number>;
    buildings: { main: number; library: number; listening: number };
  };
  daily: DailyProgress;
  battlePass: { season: string; xp: number; premium: boolean; claimed: string[] };
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
  { id: 'coin', label: 'Coin', weight: 47 },
  { id: 'spin', label: 'Spin', weight: 34 },
  { id: 'wood', label: 'Gỗ', weight: 7 },
  { id: 'ink', label: 'Mực', weight: 6 },
  { id: 'jade', label: 'Mảnh Ngọc', weight: 3 },
  { id: 'chest', label: 'Rương', weight: 2 },
  { id: 'rare', label: 'Mảnh Thiên Mệnh', weight: .9 },
  { id: 'jackpot', label: 'Jackpot', weight: .1 },
] as const;

const randomUnit = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296;
const rollSlotSymbol = () => {
  let roll = randomUnit() * 100;
  return slotSymbols.find((entry) => ((roll -= entry.weight) < 0)) ?? slotSymbols[0];
};
const specialSlotSymbol = (id: 'ticket' | 'shield' | 'raid') => ({ id, label: id === 'ticket' ? 'Búa Sấm Sét' : id === 'shield' ? 'Khiên Thành' : 'Raid', weight: 0 });

const shopCatalog = {
  'streak-guard': { price: 30, type: 'consumable' },
  'effect-jade': { price: 60, type: 'effect' },
  'seal-scholar': { price: 100, type: 'seal' },
  'frame-cinnabar': { price: 150, type: 'frame' },
  'effect-golden': { price: 180, type: 'effect' },
  'frame-dragon': { price: 300, type: 'frame' },
} as const;
const castleCommerceCatalog = {
  'theme-jade': { price: 120, kind: 'theme', slot: 'theme', theme: 'jade', name: 'Theme Pack · Bích Ngọc Cung', desc: 'Thành trì ngọc bích thanh tao, mái ngói ngọc lục bích tỏa ánh minh châu.' },
  'theme-lantern': { price: 180, kind: 'theme', slot: 'theme', theme: 'lantern', name: 'Theme Pack · Đèn Lồng Phố Đêm', desc: 'Đêm hoa đăng ấm áp rực rỡ, lầu son sáng bừng ngập tràn ánh đèn.' },
  'theme-frost': { price: 220, kind: 'theme', slot: 'theme', theme: 'frost', name: 'Theme Pack · Băng Thiên Tuyết Sơn', desc: 'Đỉnh núi tuyết ngàn năm kỳ vĩ, phong thái băng thanh ngọc khiết.' },
  'theme-crimson': { price: 150, kind: 'theme', slot: 'theme', theme: 'crimson', name: 'Theme Pack · Đan Hà Thu Cảnh', desc: 'Ráng chiều hoàng hôn rực rỡ, sắc thu vàng son bên thành cổ tráng lệ.' },
  'weather-petals': { price: 70, kind: 'weather', slot: 'weather', theme: 'weather-petals', name: 'Khí Tượng · Lạc Hoa Phù Dao', desc: 'Cánh hoa đào bay lượn nhẹ nhàng khắp bầu trời thành trì.' },
  'weather-lanterns': { price: 80, kind: 'weather', slot: 'weather', theme: 'weather-lanterns', name: 'Khí Tượng · Thiên Đăng Cầu Nguyện', desc: 'Hàng ngàn chiếc đèn lồng giấy bồng bềnh thắp sáng trời đêm.' },
  'weather-snow': { price: 90, kind: 'weather', slot: 'weather', theme: 'weather-snow', name: 'Khí Tượng · Băng Tuyết Phiêu Diêu', desc: 'Bông tuyết trắng tinh khôi rơi chầm chậm trên mái ngói hoàng thành.' },
  'weather-clouds': { price: 110, kind: 'weather', slot: 'weather', theme: 'weather-clouds', name: 'Khí Tượng · Tử Khí Đông Lai', desc: 'Làn mây tím phong thủy điềm lành bao bọc vương điện Chủ Thành.' },
  'guardian-lion': { price: 60, kind: 'guardian', slot: 'guardian', theme: 'guardian-lion', name: 'Linh Thú · Thạch Sư Uy Nghi', desc: 'Cặp tượng sư tử đá trấn trạch bảo hộ bình an cho thành trì.' },
  'guardian-qilin': { price: 130, kind: 'guardian', slot: 'guardian', theme: 'guardian-qilin', name: 'Linh Thú · Kỳ Lân Hiến Thụy', desc: 'Kỳ lân thần thú mang lại điềm lành, phúc lộc và thịnh vượng.' },
  'guardian-dragon': { price: 190, kind: 'guardian', slot: 'guardian', theme: 'guardian-dragon', name: 'Linh Thú · Thanh Long Trấn Thành', desc: 'Thần rồng xanh dũng mãnh bảo hộ giang sơn vững như bàn thạch.' },
  'banner-scholar': { price: 45, kind: 'banner', slot: 'banner', theme: 'banner-scholar', name: 'Cờ Hiệu · Bác Học Văn Kỳ', desc: 'Cờ chữ Văn đỏ thắm thể hiện ý chí hiếu học kiên cường.' },
  'banner-dragon': { price: 75, kind: 'banner', slot: 'banner', theme: 'banner-dragon', name: 'Cờ Hiệu · Long Đằng Chiến Kỳ', desc: 'Chiến kỳ thêu rồng vàng dũng mãnh tung bay trong gió lớn.' },
  'topup-60': { price: 0, crystals: 60, kind: 'topup', slot: 'topup', theme: '', name: 'Túi Linh Thạch', tag: '29.000đ', desc: 'Nhận ngay 60 Linh Thạch để trải nghiệm trang trí thành.' },
  'topup-180': { price: 0, crystals: 180, kind: 'topup', slot: 'topup', theme: '', name: 'Hòm Linh Thạch (+20)', tag: '79.000đ', desc: 'Nhận 180 Linh Thạch (Ưu đãi tặng thêm 20 · Đủ mở Long Vân Pass).' },
  'topup-450': { price: 0, crystals: 450, kind: 'topup', slot: 'topup', theme: '', name: 'Rương Linh Thạch (+60)', tag: '179.000đ', desc: 'Nhận 450 Linh Thạch (Ưu đãi tặng thêm 60 cho bộ sưu tập).' },
  'premium-pass': { price: 129, kind: 'pass', slot: 'pass', theme: '', name: 'Hành Trình Long Mạch · Premium', desc: 'Mở khóa 50 cấp Premium cosmetic và Ngọc Bội Thanh Long.' },
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
  const passSeason = new Date().toISOString().slice(0, 7);
  const progression: Progression = stored ?? {
    uid, name, xp: 0, level: 1, jade: 0, dragonCrystals: 150, coins: 0, streak: 0,
    lastStampDate: null, stamps: 0, inventory: {}, inventoryExpiries: {}, ownedCosmetics: [],
    equipped: { frame: null, seal: null, effect: null }, lastGuardUseDate: null,
    discoveries: [], jadeRelics: [],
    spins: { balance: 24, recoveryUpdatedAt: Date.now(), dailyDate: date, offlineEarned: 0, pvpEarned: 0, dailyClaimed: false },
    castle: {
      wood: 0, ink: 0, jadeBonusCarry: 0, shieldActiveUntil: 0, shieldCount: 0, likes: 0,
      theme: 'classic', ownedThemes: ['classic'],
      decorations: { theme: 'classic', weather: null, guardian: null, banner: null },
      ownedDecorations: ['classic'],
      attackEnergy: 5, attackUpdatedAt: Date.now(), peaceUntil: 0,
      newbieUntil: Number.MAX_SAFE_INTEGER, newbieProtected: true, newbieProtectionEndedAt: 0, newbieProtectionReason: null, damagedBuildings: {},
      buildings: { main: 1, library: 1, listening: 1 },
    },
    daily: emptyDaily(date),
    battlePass: { season: passSeason, xp: 0, premium: false, claimed: [] },
  };
  progression.name = name || progression.name;
  progression.coins = Math.max(0, Math.floor(Number(progression.coins ?? 0)));
  const storedCrystals = Number(progression.dragonCrystals ?? 0);
  progression.dragonCrystals = storedCrystals > 0 ? storedCrystals : 150;
  // Accounts created by an older release may not have every nested object.
  // Normalize before dereferencing so one legacy record cannot turn GET into 500.
  progression.daily = progression.daily ?? emptyDaily(date);
  if (progression.daily.date !== date) progression.daily = emptyDaily(date);
  progression.daily.matchXp = Number(progression.daily.matchXp ?? 0);
  progression.inventory = progression.inventory ?? {};
  progression.inventoryExpiries = progression.inventoryExpiries ?? {};
  for (const [itemId, expiresAt] of Object.entries(progression.inventoryExpiries)) {
    if (Number(expiresAt) <= Date.now()) {
      delete progression.inventory[itemId];
      delete progression.inventoryExpiries[itemId];
    }
  }
  progression.ownedCosmetics = progression.ownedCosmetics ?? [];
  progression.equipped = progression.equipped ?? { frame: null, seal: null, effect: null };
  progression.lastGuardUseDate = progression.lastGuardUseDate ?? null;
  progression.discoveries = progression.discoveries ?? [];
  progression.jadeRelics = progression.jadeRelics ?? [];
  normalizeSpins(progression, date);
  progression.castle = progression.castle ?? {
    wood: 0, ink: 0, jadeBonusCarry: 0, shieldActiveUntil: 0, shieldCount: 0, likes: 0,
    theme: 'classic', ownedThemes: ['classic'],
    decorations: { theme: 'classic', weather: null, guardian: null, banner: null },
    ownedDecorations: ['classic'],
    attackEnergy: 5, attackUpdatedAt: Date.now(), peaceUntil: 0,
    newbieUntil: Number.MAX_SAFE_INTEGER, newbieProtected: true, newbieProtectionEndedAt: 0, newbieProtectionReason: null, damagedBuildings: {},
    buildings: { main: 1, library: 1, listening: 1 },
  };
  progression.castle.wood = Number(progression.castle.wood ?? 0);
  progression.castle.ink = Number(progression.castle.ink ?? 0);
  progression.castle.jadeBonusCarry = Number(progression.castle.jadeBonusCarry ?? 0);
  progression.castle.shieldActiveUntil = Number(progression.castle.shieldActiveUntil ?? 0);
  if (progression.castle.shieldActiveUntil <= Date.now()) progression.castle.shieldActiveUntil = 0;
  progression.castle.shieldCount = Math.max(0, Math.min(3, Math.floor(Number(progression.castle.shieldCount ?? (progression.castle.shieldActiveUntil > Date.now() ? 1 : 0)))));
  progression.castle.likes = Math.max(0, Number(progression.castle.likes ?? 0));
  progression.castle.theme = String(progression.castle.theme ?? 'classic');
  progression.castle.ownedThemes = Array.from(new Set(['classic', ...(progression.castle.ownedThemes ?? [])]));
  progression.castle.decorations = progression.castle.decorations ?? {
    theme: progression.castle.theme || 'classic',
    weather: null,
    guardian: null,
    banner: null,
  };
  progression.castle.ownedDecorations = Array.from(new Set([
    'classic',
    ...(progression.castle.ownedThemes ?? []),
    ...(progression.castle.ownedDecorations ?? []),
  ]));
  progression.castle.attackEnergy = Math.max(0, Math.min(5, Number(progression.castle.attackEnergy ?? 5)));
  progression.castle.attackUpdatedAt = Number(progression.castle.attackUpdatedAt ?? Date.now());
  const recoveredEnergy = Math.floor((Date.now() - progression.castle.attackUpdatedAt) / 7_200_000);
  if (recoveredEnergy > 0 && progression.castle.attackEnergy < 5) {
    progression.castle.attackEnergy = Math.min(5, progression.castle.attackEnergy + recoveredEnergy);
    progression.castle.attackUpdatedAt += recoveredEnergy * 7_200_000;
  }
  progression.castle.peaceUntil = Number(progression.castle.peaceUntil ?? 0);
  progression.castle.newbieUntil = Number(progression.castle.newbieUntil ?? 0);
  progression.castle.newbieProtected = Boolean(progression.castle.newbieProtected ?? (progression.castle.newbieUntil > Date.now()));
  progression.castle.newbieProtectionEndedAt = Number(progression.castle.newbieProtectionEndedAt ?? 0);
  progression.castle.newbieProtectionReason = progression.castle.newbieProtectionReason ?? null;
  progression.castle.damagedBuildings = progression.castle.damagedBuildings ?? {};
  progression.battlePass = progression.battlePass?.season === passSeason ? progression.battlePass : { season: passSeason, xp: 0, premium: false, claimed: [] };
  progression.battlePass.xp = Math.max(0, Number(progression.battlePass.xp ?? 0));
  progression.battlePass.premium = Boolean(progression.battlePass.premium);
  progression.battlePass.claimed = Array.isArray(progression.battlePass.claimed) ? progression.battlePass.claimed : [];
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
  try {
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
  const crystalGrantKey = `hanzibeat:special-grant:dragon-crystals-999:${user.localId}`;
  if (normalizedEmail === 'manhnt@gmail.com' && !await redis.get(crystalGrantKey)) {
    progression.dragonCrystals = Math.max(999, progression.dragonCrystals);
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    await redis.set(crystalGrantKey, { grantedAt: new Date().toISOString(), email: normalizedEmail });
  }

  if (request.method === 'GET') {
    const pendingAttack = await redis.get(`hanzibeat:pending-attack:${user.localId}`);
    const pendingRaid = await redis.get(`hanzibeat:pending-raid:${user.localId}`);
    const activeRaidId = await redis.get<string>(`hanzibeat:active-raid:${user.localId}`);
    const activeRaid = activeRaidId ? await redis.get<any>(`hanzibeat:raid:${activeRaidId}`) : null;
    return response.status(200).json({ progression: publicProgression(progression), pendingAction: pendingAttack ? 'attack' : pendingRaid ? 'raid' : null, raidSession: activeRaid && activeRaidId ? { id: activeRaidId, targetId: activeRaid.targetId, targetName: activeRaid.targetName, spotCount: 9, digsLeft: Math.max(0, 3 - activeRaid.opened.length) } : null });
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  }

  const action = String(request.body?.action ?? '');
  if (action === 'castle-commerce') {
    const operation = String(request.body?.operation ?? 'list');
    if (operation === 'topup') {
      const packageId = String(request.body?.packageId ?? '');
      const item = castleCommerceCatalog[packageId as keyof typeof castleCommerceCatalog];
      if (!item || item.kind !== 'topup') {
        return response.status(400).json({ error: 'Gói nạp Linh Thạch không hợp lệ.' });
      }
      const crystalsToAdd = 'crystals' in item ? Number(item.crystals) : 60;
      progression.dragonCrystals = Math.min(99_999, (progression.dragonCrystals ?? 0) + crystalsToAdd);
      await redis.set(`hanzibeat:progression:${user.localId}`, progression);
      return response.status(200).json({
        progression: publicProgression(progression),
        commerce: { catalog: castleCommerceCatalog, tiers: BATTLE_PASS_TIERS },
        topupSuccess: true,
      });
    }

    if (operation === 'buy') {
      const itemId = String(request.body?.itemId ?? '') as keyof typeof castleCommerceCatalog;
      const item = castleCommerceCatalog[itemId];
      if (!item) return response.status(400).json({ error: 'Sản phẩm không tồn tại.' });
      // Strict rule: NO selling building resources, defense shields, or combat energy
      if (['wood', 'ink', 'coins', 'shields', 'energy'].includes(item.kind)) {
        return response.status(403).json({ error: 'Tuyệt đối không bán tài nguyên xây dựng hoặc phòng thủ.' });
      }
      if (progression.dragonCrystals < item.price) return response.status(409).json({ error: 'Không đủ Linh Thạch.' });
      if (item.kind === 'pass' && progression.battlePass.premium) {
        return response.status(409).json({ error: 'Bạn đã sở hữu Long Vân Pass mùa này.' });
      }
      const targetId = item.theme || itemId;
      const alreadyOwned = progression.castle.ownedDecorations.includes(targetId) || progression.castle.ownedThemes.includes(targetId);
      if (item.kind !== 'pass' && alreadyOwned) {
        return response.status(409).json({ error: 'Bạn đã sở hữu trang trí này.' });
      }
      progression.dragonCrystals -= item.price;
      if (item.kind === 'pass') {
        progression.battlePass.premium = true;
      } else {
        if (!progression.castle.ownedDecorations.includes(targetId)) {
          progression.castle.ownedDecorations.push(targetId);
        }
        if (item.kind === 'theme' && !progression.castle.ownedThemes.includes(targetId)) {
          progression.castle.ownedThemes.push(targetId);
        }
      }
    } else if (operation === 'equip-decoration' || operation === 'equip') {
      const slot = String(request.body?.slot ?? 'theme') as 'theme' | 'weather' | 'guardian' | 'banner';
      const decoId = request.body?.id ? String(request.body.id) : request.body?.theme ? String(request.body.theme) : null;
      if (decoId && !progression.castle.ownedDecorations.includes(decoId) && !progression.castle.ownedThemes.includes(decoId)) {
        return response.status(403).json({ error: 'Bạn chưa sở hữu trang trí này.' });
      }
      if (slot === 'theme') {
        const nextTheme = decoId || 'classic';
        progression.castle.theme = nextTheme;
        progression.castle.decorations.theme = nextTheme;
      } else if (slot === 'weather') {
        progression.castle.decorations.weather = progression.castle.decorations.weather === decoId ? null : decoId;
      } else if (slot === 'guardian') {
        progression.castle.decorations.guardian = progression.castle.decorations.guardian === decoId ? null : decoId;
      } else if (slot === 'banner') {
        progression.castle.decorations.banner = progression.castle.decorations.banner === decoId ? null : decoId;
      }
    } else if (operation === 'claim-pass' || operation === 'claim') {
      const tierNum = Math.max(1, Math.min(50, Number(request.body?.tier ?? 1)));
      const isPremium = Boolean(request.body?.premium);
      const claimId = `${isPremium ? 'premium' : 'free'}-${tierNum}`;
      const requiredXp = tierNum * 100;
      if (progression.battlePass.xp < requiredXp) return response.status(409).json({ error: 'Chưa đủ XP Battle Pass.' });
      if (isPremium && !progression.battlePass.premium) return response.status(403).json({ error: 'Cần mở khóa Long Vân Pass (Premium).' });
      if (progression.battlePass.claimed.includes(claimId)) return response.status(409).json({ error: 'Đã nhận phần thưởng này.' });

      const tierDef = BATTLE_PASS_TIERS.find((t) => t.tier === tierNum);
      if (!tierDef) return response.status(409).json({ error: 'Phần thưởng cấp này đang được hoàn thiện.' });
      if (tierDef) {
        const reward = isPremium ? tierDef.premium : tierDef.free;
        if (reward.type === 'jade') {
          progression.jade += Number(reward.amount ?? 0);
        } else if (reward.type === 'xp') {
          progression.xp += Number(reward.amount ?? 0);
          progression.level = levelFromXp(progression.xp).level;
        } else if (reward.type === 'crystals') {
          progression.dragonCrystals += Number(reward.amount ?? 0);
        } else if ((reward.type === 'item' || reward.type === 'collectible') && reward.id) {
          progression.inventory[reward.id] = Number(progression.inventory[reward.id] ?? 0) + Number(reward.amount ?? 1);
        } else if (reward.type === 'cosmetic' && reward.id) {
          if (!progression.ownedCosmetics.includes(reward.id)) progression.ownedCosmetics.push(reward.id);
        }
      }
      progression.battlePass.claimed.push(claimId);
    }
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    return response.status(200).json({
      progression: publicProgression(progression),
      commerce: { catalog: castleCommerceCatalog, tiers: BATTLE_PASS_TIERS },
    });
  }
  if (action === 'castle-combat') {
    const operation = String(request.body?.operation ?? 'logs');
    if (operation === 'raid-start') {
      const targetId = String(request.body?.targetId ?? '');
      if (!targetId || targetId === user.localId) return response.status(400).json({ error: 'Đối thủ không hợp lệ.' });
      const pendingRaid = await redis.get<any>(`hanzibeat:pending-raid:${user.localId}`);
      if (!pendingRaid) return response.status(409).json({ error: 'Bạn cần quay trúng 3 biểu tượng Raid trước.' });
      const target = await redis.get<Progression>(`hanzibeat:progression:${targetId}`);
      if (!target) return response.status(404).json({ error: 'Không tìm thấy thành đối thủ.' });
      if (Boolean(target.castle?.newbieProtected ?? (Number(target.castle?.newbieUntil ?? 0) > Date.now()))) return response.status(409).json({ error: 'Đối thủ đang được bảo vệ tân thủ.' });
      const raidId = crypto.randomUUID();
      const coinPrize = Math.min(12_000, Math.max(800, Math.floor(Number(target.coins ?? 0) * .006)));
      const spots = [
        { kind: 'coin', amount: coinPrize }, { kind: 'coin', amount: Math.floor(coinPrize * .65) }, { kind: 'coin', amount: Math.floor(coinPrize * .4) },
        { kind: 'wood', amount: 55 }, { kind: 'ink', amount: 25 },
        { kind: 'empty', amount: 0 }, { kind: 'empty', amount: 0 }, { kind: 'empty', amount: 0 }, { kind: 'empty', amount: 0 },
      ].sort(() => randomUnit() - .5);
      await redis.del(`hanzibeat:pending-raid:${user.localId}`);
      await redis.set(`hanzibeat:raid:${raidId}`, { attackerId: user.localId, targetId, targetName: target.name, spots, opened: [] }, { ex: 600 });
      await redis.set(`hanzibeat:active-raid:${user.localId}`, raidId, { ex: 600 });
      return response.status(201).json({ progression: publicProgression(progression), raidSession: { id: raidId, targetId, targetName: target.name, spotCount: 9, digsLeft: 3 } });
    }
    if (operation === 'raid-dig') {
      const raidId = String(request.body?.raidId ?? '');
      const spotIndex = Math.floor(Number(request.body?.spotIndex ?? -1));
      const session = await redis.get<any>(`hanzibeat:raid:${raidId}`);
      if (!session || session.attackerId !== user.localId) return response.status(404).json({ error: 'Phiên Raid đã hết hạn.' });
      if (spotIndex < 0 || spotIndex >= 9 || session.opened.includes(spotIndex)) return response.status(400).json({ error: 'Điểm đào không hợp lệ.' });
      if (session.opened.length >= 3) return response.status(409).json({ error: 'Bạn đã dùng đủ 3 lượt đào.' });
      const target = await redis.get<Progression>(`hanzibeat:progression:${session.targetId}`);
      if (!target) return response.status(404).json({ error: 'Thành đối thủ không còn tồn tại.' });
      const found = session.spots[spotIndex] as { kind: 'coin' | 'wood' | 'ink' | 'empty'; amount: number };
      if (found.kind === 'coin') {
        const taken = Math.min(Number(target.coins ?? 0), found.amount);
        found.amount = taken; target.coins = Math.max(0, Number(target.coins ?? 0) - taken); progression.coins += taken;
      } else if (found.kind === 'wood') progression.castle.wood += found.amount;
      else if (found.kind === 'ink') progression.castle.ink += found.amount;
      session.opened.push(spotIndex);
      const done = session.opened.length >= 3;
      if (done) { await redis.del(`hanzibeat:raid:${raidId}`); await redis.del(`hanzibeat:active-raid:${user.localId}`); } else await redis.set(`hanzibeat:raid:${raidId}`, session, { ex: 600 });
      await redis.set(`hanzibeat:progression:${user.localId}`, progression);
      await redis.set(`hanzibeat:progression:${session.targetId}`, target);
      return response.status(200).json({ progression: publicProgression(progression), raidDig: { spotIndex, ...found, digsLeft: 3 - session.opened.length, done } });
    }
    if (operation === 'start') {
      const targetId = String(request.body?.targetId ?? '');
      const buildingId = String(request.body?.buildingId ?? 'main');
      if (!targetId || targetId === user.localId) return response.status(400).json({ error: 'Đối thủ không hợp lệ.' });
      if (!['main', 'library', 'listening'].includes(buildingId)) return response.status(400).json({ error: 'Công trình không hợp lệ.' });
      const pendingAttack = await redis.get<any>(`hanzibeat:pending-attack:${user.localId}`);
      if (!pendingAttack) return response.status(409).json({ error: 'Bạn cần quay trúng 3 Búa Sấm Sét trước.' });
      const target = await redis.get<Progression>(`hanzibeat:progression:${targetId}`);
      if (!target) return response.status(404).json({ error: 'Không tìm thấy thành đối thủ.' });
      if (Boolean(target.castle?.newbieProtected ?? (Number(target.castle?.newbieUntil ?? 0) > Date.now()))) return response.status(409).json({ error: 'Đối thủ đang được bảo vệ tân thủ.' });
      const pairKey = `hanzibeat:castle-pair:${bangkokDate()}:${[user.localId,targetId].sort().join(':')}`;
      const pairCount = Number(await redis.get(pairKey) ?? 0);
      if (pairCount >= 3) return response.status(429).json({ error: 'Đã đạt giới hạn 3 trận với đối thủ này hôm nay.' });
      const combatId = crypto.randomUUID();
      await redis.del(`hanzibeat:pending-attack:${user.localId}`);
      const shieldCount = Math.max(0, Math.min(3, Number(target.castle?.shieldCount ?? 0)));
      const shielded = shieldCount > 0;
      const won = !shielded;
      const reward = won ? { coins: Math.min(10_000, Math.max(1_000, Math.floor(target.coins * .01))), wood: 80, ink: 35 } : { coins: 0, wood: 0, ink: 0 };
      if (won) { progression.coins += reward.coins; progression.castle.wood += reward.wood; progression.castle.ink += reward.ink; }
      if (won) target.castle.damagedBuildings = { ...(target.castle.damagedBuildings ?? {}), [buildingId]: Date.now() };
      if (shielded) target.castle.shieldCount = shieldCount - 1;
      const log = { id: combatId, attackerId: user.localId, attackerName: progression.name, defenderId: targetId, defenderName: target.name, attackedBuilding: buildingId, correct: 0, won, shielded, reward, createdAt: Date.now() };
      await redis.incr(pairKey); await redis.expire(pairKey, 172_800);
      await redis.lpush(`hanzibeat:castle-combat-log:${user.localId}`, log); await redis.ltrim(`hanzibeat:castle-combat-log:${user.localId}`, 0, 19);
      await redis.lpush(`hanzibeat:castle-combat-log:${targetId}`, log); await redis.ltrim(`hanzibeat:castle-combat-log:${targetId}`, 0, 19);
      await redis.set(`hanzibeat:progression:${user.localId}`, progression); await redis.set(`hanzibeat:progression:${targetId}`, target);
      return response.status(200).json({ progression: publicProgression(progression), combatResult: log, combatLogs: await redis.lrange<any>(`hanzibeat:castle-combat-log:${user.localId}`, 0, 19) });
    }
    return response.status(200).json({ progression: publicProgression(progression), combatLogs: await redis.lrange<any>(`hanzibeat:castle-combat-log:${user.localId}`, 0, 19) });
  }
  if (action === 'castle-social') {
    const season = new Date().toISOString().slice(0, 7);
    const score = Object.values(progression.castle.buildings).reduce((sum, level) => sum + level, 0) * 1_000
      + progression.discoveries.length * 5 + progression.streak * 20;
    const existingSnap = await redis.get<any>(`hanzibeat:castle-public:${user.localId}`);
    const buildingsLayout = Array.isArray(request.body?.buildingsLayout)
      ? request.body.buildingsLayout
      : (existingSnap?.buildingsLayout ?? []);
    const snapshot = {
      uid: user.localId, name: progression.name, level: progression.level, score,
      likes: progression.castle.likes, theme: progression.castle.theme,
      shieldActiveUntil: progression.castle.shieldActiveUntil,
      shieldCount: progression.castle.shieldCount,
      newbieProtected: progression.castle.newbieProtected,
      damagedBuildings: progression.castle.damagedBuildings,
      buildings: progression.castle.buildings,
      buildingsLayout,
      updatedAt: Date.now(),
    };
    await redis.set(`hanzibeat:castle-public:${user.localId}`, snapshot);
    await redis.zadd(`hanzibeat:castle-rank:${season}`, { score, member: user.localId });
    const operation = String(request.body?.operation ?? 'list');
    if (operation === 'like') {
      const targetId = String(request.body?.targetId ?? '');
      if (!targetId || targetId === user.localId) return response.status(400).json({ error: 'Không thể Like thành này.' });
      const likeAdded = await redis.set(`hanzibeat:castle-like:${user.localId}:${targetId}`, '1', { nx: true });
      if (!likeAdded) return response.status(409).json({ error: 'Bạn đã Like thành này.' });
      const target = await redis.get<any>(`hanzibeat:castle-public:${targetId}`);
      if (!target) return response.status(404).json({ error: 'Không tìm thấy thành.' });
      target.likes = Number(target.likes ?? 0) + 1;
      await redis.set(`hanzibeat:castle-public:${targetId}`, target);
      const targetProgression = await redis.get<Progression>(`hanzibeat:progression:${targetId}`);
      if (targetProgression) { targetProgression.castle.likes = target.likes; await redis.set(`hanzibeat:progression:${targetId}`, targetProgression); }
    } else if (operation === 'visit') {
      const targetId = String(request.body?.targetId ?? '');
      const target = await redis.get<any>(`hanzibeat:castle-public:${targetId}`);
      if (!target) return response.status(404).json({ error: 'Không tìm thấy thành.' });
      await redis.lpush(`hanzibeat:castle-visitors:${targetId}`, { uid: user.localId, name: progression.name, visitedAt: Date.now() });
      await redis.ltrim(`hanzibeat:castle-visitors:${targetId}`, 0, 19);
      return response.status(200).json({ visitedCastle: target });
    } else if (operation === 'theme') {
      const theme = String(request.body?.theme ?? 'classic');
      const requiredLevel: Record<string, number> = { classic: 1, moon: 4, crimson: 7 };
      if (!(theme in requiredLevel) || progression.castle.buildings.main < requiredLevel[theme]) return response.status(403).json({ error: 'Chủ Thành chưa đủ cấp để dùng phong cảnh này.' });
      progression.castle.theme = theme;
      await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    }
    const ids = await redis.zrange<string[]>(`hanzibeat:castle-rank:${season}`, 0, 19, { rev: true });
    const castles = (await Promise.all(ids.map((id) => redis.get<any>(`hanzibeat:castle-public:${id}`)))).filter(Boolean);
    const visitors = await redis.lrange<any>(`hanzibeat:castle-visitors:${user.localId}`, 0, 19);
    return response.status(200).json({ progression: publicProgression(progression), castleSocial: { season, castles, visitors } });
  }
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
    const eventRoll = randomUnit();
    const slotEvent: 'attack' | 'shield' | 'raid' | null = eventRoll < .10 ? 'attack' : eventRoll < .20 ? 'shield' : eventRoll < .30 ? 'raid' : null;
    const forcedSymbol = slotEvent === 'attack' ? specialSlotSymbol('ticket') : slotEvent === 'shield' ? specialSlotSymbol('shield') : slotEvent === 'raid' ? specialSlotSymbol('raid') : null;
    const reels = forcedSymbol ? [forcedSymbol, forcedSymbol, forcedSymbol] : [rollSlotSymbol(), rollSlotSymbol(), rollSlotSymbol()];
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
      else if (id === 'rare') rewards.fragments = 6;
      else if (id === 'jackpot') { rewards.coins = 2_500; rewards.jade = 25; rewards.jackpots = 1; }
    }
    if (slotEvent === 'attack') {
      progression.castle.newbieProtected = false;
      progression.castle.newbieUntil = 0;
      progression.castle.newbieProtectionEndedAt = Date.now();
      progression.castle.newbieProtectionReason = 'hammer';
      await redis.set(`hanzibeat:pending-attack:${user.localId}`, { createdAt: Date.now() }, { ex: 600 });
    } else if (slotEvent === 'raid') {
      await redis.set(`hanzibeat:pending-raid:${user.localId}`, { createdAt: Date.now() }, { ex: 600 });
    } else if (slotEvent === 'shield') {
      progression.castle.newbieProtected = false;
      progression.castle.newbieUntil = 0;
      progression.castle.newbieProtectionEndedAt = Date.now();
      progression.castle.newbieProtectionReason = 'shield';
      if (progression.castle.shieldCount < 3) {
        progression.castle.shieldCount += 1;
        rewards.shields = 1;
      }
    }
    progression.coins += rewards.coins;
    progression.spins.balance = Math.min(200, progression.spins.balance + rewards.spins);
    progression.castle.wood += rewards.wood;
    progression.castle.ink += rewards.ink;
    progression.jade += rewards.jade;
    progression.inventory['daily-chest'] = Number(progression.inventory['daily-chest'] ?? 0) + rewards.chests;
    progression.inventory['destiny-fragment'] = Number(progression.inventory['destiny-fragment'] ?? 0) + rewards.fragments;
    progression.inventory['celestial-jackpot'] = Number(progression.inventory['celestial-jackpot'] ?? 0) + rewards.jackpots;
    await redis.set(`hanzibeat:progression:${user.localId}`, progression);
    await redis.del(spinLockKey);
    return response.status(200).json({ progression: publicProgression(progression), slotResult: { reels: reels.map((symbol) => symbol.id), rewards, triple, event: slotEvent, shieldFull: slotEvent === 'shield' && progression.castle.shieldCount >= 3 && rewards.shields === 0 } });
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
    progression.battlePass.xp = Math.min(5000, Number(progression.battlePass.xp ?? 0) + 15 + correct + (session.kind === 'daily' ? 25 : 0));
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
  } catch (error: any) {
    console.error('[API/progression Error]:', error);
    return response.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.', details: error?.message });
  }
}
