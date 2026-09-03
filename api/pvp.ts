import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const ROOM_TTL = 60 * 30;
const firebaseApiKey = 'AIzaSyDBseWlQG56fdyiPjl8dMNLOmKDQEGGFKM';
const cleanName = (value: unknown) => String(value ?? 'Người chơi').trim().replace(/[<>]/g, '').slice(0, 20) || 'Người chơi';
const roomKey = (code: string) => `hanzibeat:pvp:room:${code}`;
const playerKey = (id: string) => `hanzibeat:pvp:player:${id}`;
const seasonId = () => { const now = new Date(); return `${now.getUTCFullYear()}-S${Math.floor(now.getUTCMonth() / 3) + 1}`; };
const rankKey = (uid: string) => `hanzibeat:pvp:rank:${seasonId()}:${uid}`;
const rankName = (mmr: number) => mmr >= 1800 ? 'Tông Sư' : mmr >= 1500 ? 'Kim' : mmr >= 1250 ? 'Bạch Ngân' : mmr >= 1050 ? 'Thanh Đồng' : 'Tân Tú';
const levelFromXp = (xp: number) => { let level = 1; let remaining = xp; while (level < 100) { const required = 100 + 30 * level + 3 * level * level; if (remaining < required) return level; remaining -= required; level += 1; } return 100; };
const bangkokDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

type RankProfile = { season: string; mmr: number; wins: number; losses: number; draws: number; matches: number; rank: string };
type Player = { id: string; name: string; score: number | null; correct: number | null; liveScore: number; liveCorrect: number; submittedAt: number | null; mmr: number; rank: string };
type GameMode = 'audition' | 'typing';
type Integrity = { valid: boolean; reason: string | null; pairMatchesToday: number; rewardEligible: boolean; rankedEligible: boolean };
type Room = { code: string; seed: number; mode: GameMode; status: 'waiting' | 'playing' | 'finished'; host: Player; guest: Player | null; createdAt: string; startedAt: number | null; completedAt: number | null; integrity: Integrity | null; rankChanges: Record<string, number> | null };

const verifyUser = async (request: any) => {
  const authorization = String(request.headers.authorization ?? '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
  if (!result.ok) return null;
  const data = await result.json() as { users?: Array<{ localId: string; displayName?: string; email?: string }> };
  return data.users?.[0] ?? null;
};
const loadRank = async (uid: string): Promise<RankProfile> => {
  const stored = await redis.get<RankProfile>(rankKey(uid)); const mmr = Number(stored?.mmr ?? 1000);
  return { season: seasonId(), mmr, wins: Number(stored?.wins ?? 0), losses: Number(stored?.losses ?? 0), draws: Number(stored?.draws ?? 0), matches: Number(stored?.matches ?? 0), rank: rankName(mmr) };
};
const saveRoom = async (room: Room) => redis.set(roomKey(room.code), room, { ex: ROOM_TTL });
const makePlayer = async (id: string, name: string): Promise<Player> => { const profile = await loadRank(id); return { id, name, score: null, correct: null, liveScore: 0, liveCorrect: 0, submittedAt: null, mmr: profile.mmr, rank: profile.rank }; };
const createRoom = async (player: Player, mode: GameMode) => {
  let code = '';
  for (let attempt = 0; attempt < 6; attempt += 1) { code = Math.random().toString(36).slice(2, 8).toUpperCase(); if (!(await redis.exists(roomKey(code)))) break; }
  const room: Room = { code, seed: Math.floor(Math.random() * 2_147_483_647), mode, status: 'waiting', host: player, guest: null, createdAt: new Date().toISOString(), startedAt: null, completedAt: null, integrity: null, rankChanges: null };
  await saveRoom(room); await redis.set(playerKey(player.id), code, { ex: ROOM_TTL }); return room;
};

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET') {
    const playerId = String(request.query.playerId ?? '').slice(0, 80); const requestedCode = String(request.query.code ?? '').toUpperCase().slice(0, 6);
    const code = requestedCode || String((await redis.get(playerKey(playerId))) ?? '');
    if (!code) return response.status(200).json({ room: null });
    return response.status(200).json({ room: await redis.get<Room>(roomKey(code)) });
  }
  if (request.method !== 'POST') return response.status(405).json({ error: 'Không hỗ trợ.' });
  const user = await verifyUser(request).catch(() => null);
  if (!user) return response.status(401).json({ error: 'Hãy đăng nhập để tham gia PvP Rank.' });
  const playerId = user.localId; const playerName = cleanName(user.displayName || user.email); const action = String(request.body?.action ?? '');
  if (action === 'profile') return response.status(200).json({ profile: await loadRank(playerId) });
  const mode: GameMode = request.body?.mode === 'audition' ? 'audition' : 'typing'; const player = await makePlayer(playerId, playerName);

  if (action === 'create') return response.status(201).json({ room: await createRoom(player, mode), profile: await loadRank(playerId) });
  if (action === 'match') {
    const existingCode = await redis.get<string>(playerKey(playerId));
    if (existingCode) { const existingRoom = await redis.get<Room>(roomKey(existingCode)); if (existingRoom && existingRoom.status !== 'finished') return response.status(200).json({ room: existingRoom }); await redis.del(playerKey(playerId)); }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const opponentId = await redis.lpop<string>(`hanzibeat:pvp:queue:${mode}`); if (!opponentId || opponentId === playerId) break;
      const opponentData = await redis.get<{ name: string }>(`hanzibeat:pvp:waiting:${opponentId}`); if (!opponentData) continue;
      const room = await createRoom(await makePlayer(opponentId, opponentData.name), mode); room.guest = player; room.status = 'playing'; room.startedAt = Date.now();
      await saveRoom(room); await redis.set(playerKey(playerId), room.code, { ex: ROOM_TTL }); await redis.del(`hanzibeat:pvp:waiting:${opponentId}`);
      return response.status(200).json({ room, profile: await loadRank(playerId) });
    }
    await redis.set(`hanzibeat:pvp:waiting:${playerId}`, { name: player.name, mode }, { ex: 180 }); await redis.rpush(`hanzibeat:pvp:queue:${mode}`, playerId);
    return response.status(202).json({ room: null, waiting: true, profile: await loadRank(playerId) });
  }
  if (action === 'join') {
    const code = String(request.body?.code ?? '').trim().toUpperCase().slice(0, 6); const room = await redis.get<Room>(roomKey(code));
    if (!room) return response.status(404).json({ error: 'Không tìm thấy phòng.' });
    if (room.guest && room.guest.id !== playerId) return response.status(409).json({ error: 'Phòng đã đủ người.' });
    if (room.host.id !== playerId) room.guest = player;
    room.status = room.guest ? 'playing' : 'waiting'; if (room.status === 'playing' && !room.startedAt) room.startedAt = Date.now();
    await saveRoom(room); await redis.set(playerKey(playerId), code, { ex: ROOM_TTL }); return response.status(200).json({ room, profile: await loadRank(playerId) });
  }
  if (action === 'progress') {
    const code = String(request.body?.code ?? '').toUpperCase().slice(0, 6); const room = await redis.get<Room>(roomKey(code));
    const liveScore = Math.floor(Number(request.body?.score)); const liveCorrect = Math.floor(Number(request.body?.correct));
    if (!room || room.status !== 'playing' || !Number.isFinite(liveScore) || !Number.isFinite(liveCorrect) || liveScore < 0 || liveScore > 100_000 || liveCorrect < 0 || liveCorrect > 20) return response.status(400).json({ error: 'Tiến độ không hợp lệ.' });
    const target = room.host.id === playerId ? room.host : room.guest?.id === playerId ? room.guest : null;
    if (!target) return response.status(403).json({ error: 'Bạn không thuộc phòng này.' });
    target.liveScore = Math.max(Number(target.liveScore ?? 0), liveScore); target.liveCorrect = Math.max(Number(target.liveCorrect ?? 0), liveCorrect);
    await saveRoom(room); return response.status(200).json({ room });
  }
  if (action === 'score') {
    const code = String(request.body?.code ?? '').toUpperCase().slice(0, 6); const room = await redis.get<Room>(roomKey(code));
    const score = Math.floor(Number(request.body?.score)); const correct = Math.floor(Number(request.body?.correct));
    if (!room || !Number.isFinite(score) || !Number.isFinite(correct) || score < 0 || score > 100_000 || correct < 0 || correct > 20) return response.status(400).json({ error: 'Kết quả vượt giới hạn hợp lệ.' });
    const target = room.host.id === playerId ? room.host : room.guest?.id === playerId ? room.guest : null;
    if (!target) return response.status(403).json({ error: 'Bạn không thuộc phòng này.' });
    if (target.submittedAt) return response.status(409).json({ error: 'Kết quả đã được ghi nhận.' });
    const elapsed = Date.now() - Number(room.startedAt ?? Date.now());
    if (elapsed < 15_000) return response.status(422).json({ error: 'Trận quá ngắn để được công nhận.' });
    if (score > correct * 3_000 + 1_000) return response.status(422).json({ error: 'Điểm và số câu đúng không khớp.' });
    target.score = score; target.correct = correct; target.liveScore = score; target.liveCorrect = correct; target.submittedAt = Date.now();
    const guest = room.guest;
    if (guest && room.host.score !== null && guest.score !== null) {
      room.status = 'finished'; room.completedAt = Date.now();
      const ids = [room.host.id, guest.id].sort(); const pairKey = `hanzibeat:pvp:pair:${bangkokDate()}:${ids.join(':')}`;
      const pairMatchesToday = await redis.incr(pairKey); if (pairMatchesToday === 1) await redis.expire(pairKey, 172800);
      const afk = room.host.correct! <= 1 || guest.correct! <= 1; const valid = !afk;
      const rewardEligible = valid && pairMatchesToday <= 3; const rankedEligible = valid && pairMatchesToday <= 5;
      room.integrity = { valid, reason: afk ? 'AFK hoặc quá ít tương tác' : pairMatchesToday > 5 ? 'Vượt giới hạn cùng đối thủ' : null, pairMatchesToday, rewardEligible, rankedEligible };
      room.rankChanges = { [room.host.id]: 0, [guest.id]: 0 };
      if (rewardEligible) {
        for (const uid of ids) {
          const progressionKey = `hanzibeat:progression:${uid}`; const progression = await redis.get<any>(progressionKey);
          if (progression?.daily?.date === bangkokDate() && Number(progression.daily.rewardedPvpMatches ?? 0) < 10) {
            progression.daily.rewardedPvpMatches = Number(progression.daily.rewardedPvpMatches ?? 0) + 1;
            const mainLevel = Math.max(1, Math.min(10, Number(progression.castle?.buildings?.main ?? 1)));
            const bonusRates = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10];
            const bonusRate = bonusRates[mainLevel] ?? 0;
            const accumulatedBonus = Number(progression.castle?.jadeBonusCarry ?? 0) + 3 * bonusRate / 100;
            const castleBonus = Math.floor(accumulatedBonus + 1e-9);
            progression.castle = progression.castle ?? { wood: 0, ink: 0, buildings: { main: 1, library: 1, listening: 1 } };
            progression.castle.jadeBonusCarry = Number((accumulatedBonus - castleBonus).toFixed(4));
            progression.spins = progression.spins ?? { balance: 24, recoveryUpdatedAt: Date.now(), dailyDate: bangkokDate(), offlineEarned: 0, pvpEarned: 0, dailyClaimed: false };
            if (progression.spins.dailyDate !== bangkokDate()) {
              progression.spins.dailyDate = bangkokDate(); progression.spins.offlineEarned = 0; progression.spins.pvpEarned = 0; progression.spins.dailyClaimed = false;
            }
            const isWinner = room.host.score === guest.score ? false : (uid === room.host.id ? room.host.score! > guest.score! : guest.score! > room.host.score!);
            const spinEarned = Math.min(isWinner ? 2 : 1, Math.max(0, 10 - Number(progression.spins.pvpEarned ?? 0)));
            progression.spins.pvpEarned = Number(progression.spins.pvpEarned ?? 0) + spinEarned;
            progression.spins.balance = Math.min(200, Number(progression.spins.balance ?? 0) + spinEarned);
            progression.jade = Number(progression.jade ?? 0) + 3 + castleBonus; progression.xp = Number(progression.xp ?? 0) + 8; progression.level = levelFromXp(progression.xp);
            await redis.set(progressionKey, progression);
          }
        }
      }
      if (rankedEligible) {
        const hostRank = await loadRank(room.host.id); const guestRank = await loadRank(guest.id);
        const expectedHost = 1 / (1 + 10 ** ((guestRank.mmr - hostRank.mmr) / 400)); const hostResult = room.host.score! === guest.score! ? 0.5 : room.host.score! > guest.score! ? 1 : 0;
        const hostDelta = Math.round(28 * (hostResult - expectedHost)); const guestDelta = -hostDelta;
        const apply = async (uid: string, profile: RankProfile, result: 'win'|'loss'|'draw', delta: number) => { profile.mmr = Math.max(0, profile.mmr + delta); profile.matches += 1; profile[result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws'] += 1; profile.rank = rankName(profile.mmr); await redis.set(rankKey(uid), profile); };
        await apply(room.host.id, hostRank, hostResult === .5 ? 'draw' : hostResult === 1 ? 'win' : 'loss', hostDelta); await apply(guest.id, guestRank, hostResult === .5 ? 'draw' : hostResult === 0 ? 'win' : 'loss', guestDelta);
        room.rankChanges = { [room.host.id]: hostDelta, [guest.id]: guestDelta };
      }
    }
    await saveRoom(room); return response.status(200).json({ room, profile: await loadRank(playerId) });
  }
  return response.status(400).json({ error: 'Thao tác không hợp lệ.' });
}
