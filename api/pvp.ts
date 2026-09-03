import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const ROOM_TTL = 60 * 30;
const cleanName = (value: unknown) =>
  String(value ?? 'Người chơi').trim().replace(/[<>]/g, '').slice(0, 20) || 'Người chơi';
const roomKey = (code: string) => `hanzibeat:pvp:room:${code}`;
const playerKey = (id: string) => `hanzibeat:pvp:player:${id}`;
type Player = { id: string; name: string; score: number | null; correct: number | null };
type Room = { code: string; seed: number; status: 'waiting' | 'playing' | 'finished'; host: Player; guest: Player | null; createdAt: string };

async function saveRoom(room: Room) {
  await redis.set(roomKey(room.code), room, { ex: ROOM_TTL });
}

async function createRoom(player: Player) {
  let code = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!(await redis.exists(roomKey(code)))) break;
  }
  const room: Room = {
    code,
    seed: Math.floor(Math.random() * 2_147_483_647),
    status: 'waiting',
    host: player,
    guest: null,
    createdAt: new Date().toISOString(),
  };
  await saveRoom(room);
  await redis.set(playerKey(player.id), code, { ex: ROOM_TTL });
  return room;
}

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET') {
    const playerId = String(request.query.playerId ?? '').slice(0, 80);
    const requestedCode = String(request.query.code ?? '').toUpperCase().slice(0, 6);
    const code = requestedCode || String((await redis.get(playerKey(playerId))) ?? '');
    if (!code) return response.status(200).json({ room: null });
    const room = await redis.get<Room>(roomKey(code));
    return response.status(200).json({ room });
  }
  if (request.method !== 'POST') return response.status(405).json({ error: 'Không hỗ trợ.' });

  const action = String(request.body?.action ?? '');
  const playerId = String(request.body?.playerId ?? '').slice(0, 80);
  if (playerId.length < 8) return response.status(400).json({ error: 'Người chơi không hợp lệ.' });
  const player: Player = { id: playerId, name: cleanName(request.body?.name), score: null, correct: null };

  if (action === 'create') {
    return response.status(201).json({ room: await createRoom(player) });
  }
  if (action === 'match') {
    const existingCode = await redis.get<string>(playerKey(playerId));
    if (existingCode) {
      const existingRoom = await redis.get<Room>(roomKey(existingCode));
      if (existingRoom) return response.status(200).json({ room: existingRoom });
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const opponentId = await redis.lpop<string>('hanzibeat:pvp:queue');
      if (!opponentId || opponentId === playerId) break;
      const opponentData = await redis.get<{ name: string }>(`hanzibeat:pvp:waiting:${opponentId}`);
      if (!opponentData) continue;
      const room = await createRoom({ id: opponentId, name: opponentData.name, score: null, correct: null });
      room.guest = player;
      room.status = 'playing';
      await saveRoom(room);
      await redis.set(playerKey(playerId), room.code, { ex: ROOM_TTL });
      await redis.del(`hanzibeat:pvp:waiting:${opponentId}`);
      return response.status(200).json({ room });
    }
    await redis.set(`hanzibeat:pvp:waiting:${playerId}`, { name: player.name }, { ex: 180 });
    await redis.rpush('hanzibeat:pvp:queue', playerId);
    return response.status(202).json({ room: null, waiting: true });
  }
  if (action === 'join') {
    const code = String(request.body?.code ?? '').trim().toUpperCase().slice(0, 6);
    const room = await redis.get<Room>(roomKey(code));
    if (!room) return response.status(404).json({ error: 'Không tìm thấy phòng.' });
    if (room.guest && room.guest.id !== playerId) return response.status(409).json({ error: 'Phòng đã đủ người.' });
    if (room.host.id !== playerId) room.guest = player;
    room.status = room.guest ? 'playing' : 'waiting';
    await saveRoom(room);
    await redis.set(playerKey(playerId), code, { ex: ROOM_TTL });
    return response.status(200).json({ room });
  }
  if (action === 'score') {
    const code = String(request.body?.code ?? '').toUpperCase().slice(0, 6);
    const room = await redis.get<Room>(roomKey(code));
    const score = Math.max(0, Math.min(1_000_000, Math.floor(Number(request.body?.score))));
    const correct = Math.max(0, Math.min(20, Math.floor(Number(request.body?.correct))));
    if (!room || !Number.isFinite(score) || !Number.isFinite(correct)) return response.status(400).json({ error: 'Kết quả không hợp lệ.' });
    const target = room.host.id === playerId ? room.host : room.guest?.id === playerId ? room.guest : null;
    if (!target) return response.status(403).json({ error: 'Bạn không thuộc phòng này.' });
    target.score = score;
    target.correct = correct;
    if (room.host.score !== null && room.guest?.score !== null) room.status = 'finished';
    await saveRoom(room);
    return response.status(200).json({ room });
  }
  return response.status(400).json({ error: 'Thao tác không hợp lệ.' });
}
