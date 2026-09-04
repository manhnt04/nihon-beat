'use client';

import './castle.css';
import './spin.css';
import { BATTLE_PASS_TIERS } from '../lib/battlePass';
import CastleIsoCanvas, {
  IsoBuildingData,
  PendingBuildingTemplate,
  CombatFxTrigger,
  CoreBuildingPositions,
  BuildingAnimState,
} from './components/CastleIsoCanvas';
import CastleHomeWidget from './components/castle/CastleHomeWidget';
import {
  FootprintCell,
  rectFootprint,
  lShapeFootprint,
  tShapeFootprint,
  GridManager,
  sanitizeBuildingsLayout,
  flipFootprintCells,
  getEffectiveFootprint,
} from './utils/castleGrid';
import {
  IslandCalibration,
  RIM_ISLAND_CALIBRATION,
  NATURAL_ISLAND_CALIBRATION,
  DEFAULT_ISLAND_CALIBRATION,
} from './utils/islandCalibration';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flame,
  Folder,
  FolderOpen,
  LogIn,
  LogOut,
  Map as MapIcon,
  Music2,
  Package,
  Play,
  ShoppingBag,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  deleteAudioTrack,
  getAudioTracks,
  saveAudioFiles,
  type AudioTrack,
} from '@/lib/audio-library';
import {
  hsk2Vocabulary,
  type VocabularyEntry,
} from '@/lib/hsk2-vocabulary';
import { defaultAudioTracks } from '@/lib/default-audio';
import { hsk1Vocabulary } from '@/lib/hsk1-vocabulary';
import { hsk3Vocabulary } from '@/lib/hsk3-vocabulary';
import { hsk4Vocabulary } from '@/lib/hsk4-vocabulary';
import {
  normalPacks,
  hardPacks,
  normalDifficultyPool,
  hardDifficultyPool,
  collocationsVocabulary,
  contextSentencesVocabulary,
} from '@/lib/difficulty-vocabulary';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

type Screen =
  | 'home'
  | 'songs'
  | 'game'
  | 'result'
  | 'dictionary'
  | 'leaderboard'
  | 'pvp'
  | 'inventory'
  | 'shop'
  | 'codex'
  | 'castle'
  | 'castle-test'
  | 'auth';
const screenPaths: Record<Screen, string> = {
  home: '/', songs: '/lessons', game: '/play', result: '/result',
  dictionary: '/dictionary', leaderboard: '/leaderboard', pvp: '/pvp',
  inventory: '/inventory', shop: '/shop', codex: '/profile/codex', castle: '/castle',
  'castle-test': '/castle-test', auth: '/profile',
};
const screenFromPath = (pathname: string): Screen => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/profile/castle') return 'castle';
  return (Object.entries(screenPaths).find(([, path]) => path === normalized)?.[0] as Screen | undefined) ?? 'home';
};
type AuthUser = { id: string; name: string; email: string };
type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  correct: number;
  createdAt: string;
};
type PvpPlayer = { id: string; name: string; score: number | null; correct: number | null; liveScore?: number; liveCorrect?: number; submittedAt?: number | null; mmr?: number; rank?: string };
type PvpRoom = { code: string; seed: number; mode: 'audition' | 'typing'; status: 'waiting' | 'playing' | 'finished'; host: PvpPlayer; guest: PvpPlayer | null; startedAt?: number | null; completedAt?: number | null; integrity?: { valid: boolean; reason: string | null; pairMatchesToday: number; rewardEligible: boolean; rankedEligible: boolean } | null; rankChanges?: Record<string, number> | null };
type PvpRank = { season: string; mmr: number; wins: number; losses: number; draws: number; matches: number; rank: string };
const PVP_RANK_BADGES: Record<string, string> = {
  'Đồng': '/ranks/rank-bronze.png',
  'Bạc': '/ranks/rank-silver.png',
  'Vàng': '/ranks/rank-gold.png',
  'Bạch Kim': '/ranks/rank-platinum.png',
  'Kim Cương': '/ranks/rank-diamond.png',
  'Tinh Anh': '/ranks/rank-elite.png',
  'Cao Thủ': '/ranks/rank-master.png',
  'Đại Cao Thủ': '/ranks/rank-grandmaster.png',
  'Chiến Tướng': '/ranks/rank-warlord.png',
  'Chiến Thần': '/ranks/rank-wargod.png',
};
type Progression = {
  xp: number;
  level: number;
  jade: number;
  dragonCrystals: number;
  coins: number;
  streak: number;
  stamps: number;
  inventory: Record<string, number>;
  inventoryExpiries?: Record<string, number>;
  ownedCosmetics: string[];
  equipped: { frame: string | null; seal: string | null; effect: string | null };
  lastGuardUseDate: string | null;
  discoveries: string[];
  jadeRelics: string[];
  spins: { balance: number; recoveryUpdatedAt: number; dailyDate: string; offlineEarned: number; pvpEarned: number; dailyClaimed: boolean };
  castle: {
    wood: number;
    ink: number;
    jadeBonusCarry: number;
    shieldActiveUntil: number;
    likes: number;
    theme: string;
    ownedThemes: string[];
    decorations?: {
      theme: string;
      weather: string | null;
      guardian: string | null;
      banner: string | null;
    };
    ownedDecorations?: string[];
    attackEnergy: number;
    attackUpdatedAt: number;
    peaceUntil: number;
    newbieUntil: number;
    buildings: { main: number; library: number; listening: number };
  };
  battlePass: { season: string; xp: number; premium: boolean; claimed: string[] };
  completedTasks: number;
  levelProgress: { level: number; currentXp: number; nextXp: number };
  daily: {
    correct: number;
    offlineMatches: number;
    pvpMatches: number;
    dailyCompleted: boolean;
    offlineJade: number;
    rewardedPvpMatches: number;
    stampEarned: boolean;
  };
};
const baseVocabulary = hsk1Vocabulary;
const allVocabulary = [
  ...baseVocabulary,
  ...hsk2Vocabulary,
  ...hsk3Vocabulary,
  ...hsk4Vocabulary,
];
const WORDS_PER_MATCH = 20;
const PVP_QUESTIONS = 25;
const shuffleVocabulary = (entries: VocabularyEntry[], seed?: number) => {
  const shuffled = [...entries];
  let state = seed ?? 0;
  const random = seed === undefined
    ? Math.random
    : () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
};
const songs = [
  ['早安节拍', 'Morning Pulse', '128', 'HSK 1', 'Dễ', '#ff5f91'],
  ['星河漫游', 'Starlight Ride', '154', 'HSK 2', 'Vừa', '#7857ff'],
  ['上海霓虹', 'Shanghai Neon', '178', 'HSK 3', 'Khó', '#19c6d3'],
  ['龙门飞跃', 'Dragon Gate', '186', 'HSK 4', 'Thử thách', '#b5272d'],
];
const shopItems = [
  { id: 'streak-guard', type: 'consumable', name: 'Hộ Ấn', hanzi: '护印', price: 30, image: '/items/shop-streak-guard.png', rarity: 'Hiếm', description: 'Tự động bảo vệ một ngày bỏ lỡ. Tối đa 2, dùng một lần mỗi 7 ngày.' },
  { id: 'effect-jade', type: 'effect', name: 'Ngọc Quang', hanzi: '玉光', price: 60, image: '/items/shop-effect-jade.png', rarity: 'Hiếm', description: 'Hiệu ứng ánh ngọc khi trả lời chính xác.' },
  { id: 'seal-scholar', type: 'seal', name: 'Ấn Học Giả', hanzi: '学者印', price: 100, image: '/items/shop-seal-scholar.png', rarity: 'Hiếm', description: 'Con dấu Học Giả hiển thị trên hồ sơ.' },
  { id: 'frame-cinnabar', type: 'frame', name: 'Khung Chu Sa', hanzi: '朱砂框', price: 150, image: '/items/shop-frame-cinnabar.png', rarity: 'Sử thi', description: 'Khung avatar đỏ son với viền vàng cổ điển.' },
  { id: 'effect-golden', type: 'effect', name: 'Kim Vân', hanzi: '金云', price: 180, image: '/items/shop-effect-golden.png', rarity: 'Sử thi', description: 'Hiệu ứng mây vàng cho chuỗi Perfect.' },
  { id: 'frame-dragon', type: 'frame', name: 'Khung Long Môn', hanzi: '龙门框', price: 300, image: '/items/shop-frame-dragon.png', rarity: 'Huyền thoại', description: 'Khung rồng dành cho người chinh phục hành trình.' },
] as const;
const jadeRelics = [
  { id: 'sprout', name: 'Ngọc Bội Khai Văn', hanzi: '开文玉佩', threshold: 25, image: '/items/jade-fragment.png' },
  { id: 'scholar', name: 'Ngọc Bội Bác Học', hanzi: '博学玉佩', threshold: 100, image: '/items/shop-effect-jade.png' },
  { id: 'dragon', name: 'Ngọc Bội Long Môn', hanzi: '龙门玉佩', threshold: 250, image: '/items/shop-streak-guard.png' },
] as const;
const radicalGroups = [
  { name: 'Nhân · Người', radical: '亻', test: (hanzi: string) => /[你他们住休做位]/u.test(hanzi) },
  { name: 'Thuỷ · Nước', radical: '氵', test: (hanzi: string) => /[洗海游泳河酒]/u.test(hanzi) },
  { name: 'Khẩu · Miệng', radical: '口', test: (hanzi: string) => /[吃喝叫听唱吗呢哪]/u.test(hanzi) },
  { name: 'Tâm · Cảm xúc', radical: '心', test: (hanzi: string) => /[想忘快慢意思情]/u.test(hanzi) },
  { name: 'Mộc · Cây', radical: '木', test: (hanzi: string) => /[本校杯桌椅果]/u.test(hanzi) },
] as const;
const topicGroups = [
  { name: 'Giao tiếp', icon: '语', test: (entry: VocabularyEntry) => /chào|nói|hỏi|xin lỗi|cảm ơn|giới thiệu|nghĩa/u.test(entry[3].toLowerCase()) },
  { name: 'Gia đình', icon: '家', test: (entry: VocabularyEntry) => /bố|mẹ|cha|ông|bà|vợ|chồng|con trai|con gái|gia đình/u.test(entry[3].toLowerCase()) },
  { name: 'Học tập', icon: '学', test: (entry: VocabularyEntry) => /học|thi|bài|sách|vở|trường|lớp|dạy/u.test(entry[3].toLowerCase()) },
  { name: 'Hành trình', icon: '行', test: (entry: VocabularyEntry) => /đi|xe|tàu|đường|du lịch|khách sạn|trạm|bến/u.test(entry[3].toLowerCase()) },
] as const;
const arrowKeys = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const arrowGlyphs = ['←', '↓', '↑', '→'];
const normalizeAnswer = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

const playAnswerSound = (result: 'correct' | 'wrong') => {
  const context = new AudioContext();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + (result === 'correct' ? 0.32 : 0.24),
  );

  const tones = result === 'correct' ? [660, 880] : [190, 145];
  tones.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = result === 'correct' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(
      frequency,
      context.currentTime + index * 0.09,
    );
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.09);
    oscillator.stop(
      context.currentTime + index * 0.09 + (result === 'correct' ? 0.15 : 0.12),
    );
  });

  window.setTimeout(() => void context.close(), 450);
};

type CastleBuildingKind = 'main' | 'library' | 'listening';
type SlotRewards = { coins: number; spins: number; wood: number; ink: number; jade: number; chests: number; shields: number; tickets: number; fragments: number; jackpots: number };
type SlotResult = { reels: string[]; rewards: SlotRewards; triple: boolean };
type PublicCastle = { uid: string; name: string; level: number; score: number; likes: number; theme: string; shieldActiveUntil: number; buildings: { main: number; library: number; listening: number }; buildingsLayout?: IsoBuildingData[]; corePositions?: CoreBuildingPositions };
type CastleVisitor = { uid: string; name: string; visitedAt: number };
type CombatLog = { id: string; attackerId: string; attackerName: string; defenderId: string; defenderName: string; correct: number; won: boolean; shielded: boolean; reward: { coins: number; wood: number; ink: number }; createdAt: number };
const slotSymbols = [
  { id: 'coin', label: 'Coin', image: '/items/coin.png' },
  { id: 'spin', label: 'Spin', image: '/items/spin-refund.png' },
  { id: 'wood', label: 'Gỗ', image: '/items/spin-wood.png' },
  { id: 'ink', label: 'Mực', image: '/items/spin-ink.png' },
  { id: 'jade', label: 'Ngọc', image: '/items/jade-fragment.png' },
  { id: 'chest', label: 'Rương', image: '/items/daily-chest.png' },
  { id: 'shield', label: 'Khiên', image: '/items/spin-castle-shield.png' },
  { id: 'ticket', label: 'Vé', image: '/items/spin-siege-ticket.png' },
  { id: 'rare', label: 'Mảnh hiếm', image: '/items/spin-destiny-fragment.png' },
  { id: 'jackpot', label: 'Jackpot', image: '/items/spin-jackpot.png' },
] as const;
const slotStrip = Array.from({ length: 8 }, () => slotSymbols).flat();
const mainCastleLevelRequirements = [0, 0, 5, 10, 15, 22, 30, 40, 52, 66, 82];
const mainCastleJadeBonusRates = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10];
const mainCastleUpgradeCosts = {
  coin: [0, 0, 5_000, 12_000, 30_000, 70_000, 150_000, 300_000, 550_000, 1_000_000],
  wood: [0, 0, 120, 250, 500, 900, 1_500, 2_400, 3_600, 5_200],
  ink: [0, 0, 40, 80, 160, 300, 520, 850, 1_300, 1_900],
} as const;
const castleUpgradeCost = (building: { coinScale: number; woodScale: number; inkScale: number }, currentLevel: number) => {
  const targetLevel = Math.min(10, currentLevel + 1);
  return {
    coin: Math.round(mainCastleUpgradeCosts.coin[targetLevel] * building.coinScale),
    wood: Math.round(mainCastleUpgradeCosts.wood[targetLevel] * building.woodScale),
    ink: Math.round(mainCastleUpgradeCosts.ink[targetLevel] * building.inkScale),
  };
};
const castleVisualStage = (level: number) => Math.min(5, Math.max(1, Math.ceil(level / 2)));
const CastleMapBuilding = ({ kind, level, label, onSelect }: { kind: CastleBuildingKind; level: number; label: string; onSelect: (kind: CastleBuildingKind) => void }) => {
  const stage = castleVisualStage(level);
  const assetStage = kind === 'main' ? stage : 1;
  return <button className={`map-building map-building-${kind} visual-stage-${stage}`} onClick={() => onSelect(kind)} aria-label={`${label}, cấp ${level}, hình thái ${stage}`}><img src={`/castle/buildings/${kind}/stage-${assetStage}.webp`} alt=""/><span><b>{label}</b><small>Lv.{level} · Hình thái {stage}/5</small></span></button>;
};

export const DEFAULT_CORE_POSITIONS: CoreBuildingPositions = {
  main: { col: 4, row: 4, flipX: false },
  library: { col: 1, row: 4, flipX: false },
  listening: { col: 8, row: 4, flipX: false },
};

export interface ActiveConstruction {
  id: string;
  name: string;
  startTime: number;
  duration: number; // ms, default 10000
  type: 'build' | 'upgrade';
  targetLevel?: number;
  newBuildingData?: IsoBuildingData;
}

const DEFAULT_EXTRA_BUILDINGS: IsoBuildingData[] = [
  {
    id: 'watchtower-1',
    name: 'Trạm gác Tiền đồn',
    hanzi: '哨',
    icon: '🏹',
    col: 0,
    row: 6,
    w: 1,
    h: 1,
    height: 48,
    imageSrc: '/castle/buildings/listening/stage-1.webp',
    imageScale: 0.85,
    top: '#e8c9a0',
    left: '#c8a374',
    right: '#a8825a',
    outline: '#7a5c3a',
    isRemovable: true,
    prosperity: 120,
    cost: { wood: 100, ink: 0, coin: 500 },
  },
  {
    id: 'tree-1',
    name: 'Cổ thụ Linh mộc',
    hanzi: '木',
    icon: '🌲',
    col: 2,
    row: 6,
    w: 1,
    h: 1,
    height: 52,
    top: '#a8d98a',
    left: '#87bd67',
    right: '#699e49',
    outline: '#4a7a30',
    isRemovable: true,
    prosperity: 80,
    cost: { wood: 60, ink: 0, coin: 200 },
  },
  {
    id: 'rock-1',
    name: 'Kỳ thạch Phong thuỷ',
    hanzi: '石',
    icon: '🪨',
    col: 5,
    row: 5,
    w: 1,
    h: 1,
    height: 32,
    top: '#c9c3b8',
    left: '#a8a196',
    right: '#8a8378',
    outline: '#605a50',
    isRemovable: true,
    prosperity: 50,
    cost: { wood: 40, ink: 0, coin: 150 },
  },
];

const SANDBOX_PRESETS: Record<string, { label: string; buildings: IsoBuildingData[] }> = {
  empty: {
    label: 'Đảo Trống (Chỉ có 3 công trình gốc)',
    buildings: [],
  },
  default: {
    label: 'Mặc định (Trạm gác, Cổ thụ, Kỳ thạch)',
    buildings: DEFAULT_EXTRA_BUILDINGS,
  },
  imperial: {
    label: 'Kinh Thành Cổ Phong (Điện các tráng lệ)',
    buildings: [
      {
        id: 'palace-1',
        name: 'Dương Quan Cung',
        hanzi: '殿',
        icon: '🏛️',
        col: 4,
        row: 0,
        w: 3,
        h: 3,
        height: 110,
        imageSrc: '/castle/buildings/main/stage-4.webp',
        imageScale: 1.15,
        top: '#ffe082',
        left: '#ffca28',
        right: '#ffa000',
        outline: '#8d6e63',
        isRemovable: true,
        prosperity: 180,
      },
      {
        id: 'library-ext',
        name: 'Văn Khúc Viện',
        hanzi: '阁',
        icon: '📚',
        col: 1,
        row: 1,
        w: 2,
        h: 2,
        height: 75,
        imageSrc: '/castle/buildings/library/stage-1.webp',
        imageScale: 1.0,
        top: '#90caf9',
        left: '#42a5f5',
        right: '#1e88e5',
        outline: '#1565c0',
        isRemovable: true,
        prosperity: 90,
      },
    ],
  },
  defense: {
    label: 'Tiền Tuyến Quân Sự (Trạm canh & Phong hỏa)',
    buildings: [
      {
        id: 'watchtower-nw',
        name: 'Trạm Canh Cung Tiễn',
        hanzi: '哨',
        icon: '🏹',
        col: 0,
        row: 0,
        w: 1,
        h: 1,
        height: 52,
        imageSrc: '/castle/buildings/listening/stage-1.webp',
        imageScale: 0.85,
        top: '#b0bec5',
        left: '#78909c',
        right: '#546e7a',
        outline: '#37474f',
        isRemovable: true,
        prosperity: 30,
      },
      {
        id: 'watchtower-sw',
        name: 'Trạm Canh Cung Tiễn',
        hanzi: '哨',
        icon: '🏹',
        col: 0,
        row: 11,
        w: 1,
        h: 1,
        height: 52,
        imageSrc: '/castle/buildings/listening/stage-1.webp',
        imageScale: 0.85,
        top: '#b0bec5',
        left: '#78909c',
        right: '#546e7a',
        outline: '#37474f',
        isRemovable: true,
        prosperity: 30,
      },
      {
        id: 'beacon-se',
        name: 'Phong Hỏa Đài',
        hanzi: '烽',
        icon: '🔥',
        col: 11,
        row: 11,
        w: 1,
        h: 1,
        height: 60,
        imageSrc: '/castle/buildings/listening/stage-1.webp',
        imageScale: 0.85,
        top: '#ffab91',
        left: '#ff7043',
        right: '#d84315',
        outline: '#bf360c',
        isRemovable: true,
        prosperity: 45,
      },
    ],
  },
  nature: {
    label: 'Ngự Hoa Tiên Cảnh (Cổ thụ, Kỳ thạch & Đào hoa)',
    buildings: [
      {
        id: 'tree-nw',
        name: 'Đào Hoa Tiên Thụ',
        hanzi: '桃',
        icon: '🌸',
        col: 1,
        row: 8,
        w: 1,
        h: 1,
        height: 48,
        top: '#f48fb1',
        left: '#ec407a',
        right: '#c2185b',
        outline: '#880e4f',
        isRemovable: true,
        prosperity: 25,
      },
      {
        id: 'tree-ne',
        name: 'Đào Hoa Tiên Thụ',
        hanzi: '桃',
        icon: '🌸',
        col: 10,
        row: 1,
        w: 1,
        h: 1,
        height: 48,
        top: '#f48fb1',
        left: '#ec407a',
        right: '#c2185b',
        outline: '#880e4f',
        isRemovable: true,
        prosperity: 25,
      },
      {
        id: 'stone-c',
        name: 'Thiên Ngoại Huyền Thạch',
        hanzi: '石',
        icon: '🪨',
        col: 1,
        row: 10,
        w: 1,
        h: 1,
        height: 38,
        top: '#ce93d8',
        left: '#ab47bc',
        right: '#7b1fa2',
        outline: '#4a148c',
        isRemovable: true,
        prosperity: 30,
      },
    ],
  },
};

export interface BuildingCatalogItem extends PendingBuildingTemplate {
  category: 'palace' | 'study' | 'defense' | 'nature';
  desc: string;
}

const BUILDING_CATALOG: BuildingCatalogItem[] = [
  {
    templateId: 'watchtower',
    name: 'Trạm Gác Tiền Đồn',
    hanzi: '哨',
    icon: '🏹',
    category: 'defense',
    desc: 'Chòi canh vững chắc phòng thủ biên cương Tiên Đảo.',
    w: 1,
    h: 1,
    height: 48,
    imageSrc: '/castle/buildings/listening/stage-1.webp',
    imageScale: 0.85,
    top: '#e8c9a0',
    left: '#c8a374',
    right: '#a8825a',
    outline: '#7a5c3a',
    prosperity: 120,
    cost: { wood: 100, ink: 0, coin: 500 },
  },
  {
    templateId: 'library-annex',
    name: 'Ký Túc Tàng Thư',
    hanzi: '阁',
    icon: '📚',
    category: 'study',
    desc: 'Chi nhánh thư viện lưu trữ hàng ngàn cuộn thẻ tre cổ thư.',
    w: 2,
    h: 2,
    height: 66,
    imageSrc: '/castle/buildings/library/stage-1.webp',
    imageScale: 1.05,
    top: '#74c0fc',
    left: '#1c7ed6',
    right: '#1864ab',
    outline: '#1971c2',
    prosperity: 380,
    cost: { wood: 350, ink: 150, coin: 1500 },
  },
  {
    templateId: 'listening-pavilion',
    name: 'Thính Phong Nhã Lâu',
    hanzi: '亭',
    icon: '🔔',
    category: 'study',
    desc: 'Lầu chuông thanh tĩnh giữa mây trời, rèn luyện thính lực.',
    w: 2,
    h: 2,
    height: 66,
    imageSrc: '/castle/buildings/listening/stage-1.webp',
    imageScale: 1.05,
    top: '#fcc2d7',
    left: '#d6336c',
    right: '#a61e4d',
    outline: '#c2255c',
    prosperity: 420,
    cost: { wood: 400, ink: 200, coin: 1800 },
  },
  {
    templateId: 'palace-hut',
    name: 'Thảo Đường Chi Điện',
    hanzi: '殿',
    icon: '🏯',
    category: 'palace',
    desc: 'Điện thờ mộc mạc cổ kính, cội nguồn của cơ đồ vương triều.',
    w: 2,
    h: 2,
    height: 72,
    imageSrc: '/castle/buildings/main/stage-1.webp',
    imageScale: 1.05,
    top: '#ffd875',
    left: '#c48838',
    right: '#9e6720',
    outline: '#7c4d12',
    prosperity: 500,
    cost: { wood: 500, ink: 250, coin: 2500 },
  },
  {
    templateId: 'grand-mansion',
    name: 'Vương Phủ Biệt Viện',
    hanzi: '府',
    icon: '🏮',
    category: 'palace',
    desc: 'Biệt viện nguy nga lộng lẫy dành cho bậc vương hầu tao nhã.',
    w: 2,
    h: 2,
    height: 80,
    imageSrc: '/castle/buildings/main/stage-2.webp',
    imageScale: 1.08,
    top: '#e0a94d',
    left: '#9b2b2b',
    right: '#781f1f',
    outline: '#7a1f1d',
    prosperity: 900,
    cost: { wood: 800, ink: 450, coin: 4500 },
  },
  {
    templateId: 'celestial-hall',
    name: 'Thái Hòa Cung Điện',
    hanzi: '宫',
    icon: '👑',
    category: 'palace',
    desc: 'Cung điện nguy nga tráng lệ bậc nhất, tỏa ánh hoàng kim rực rỡ.',
    w: 3,
    h: 3,
    height: 110,
    imageSrc: '/castle/buildings/main/stage-3.webp',
    imageScale: 1.15,
    top: '#ffd666',
    left: '#c92a2a',
    right: '#961b1b',
    outline: '#7a1f1d',
    prosperity: 2200,
    cost: { wood: 1500, ink: 800, coin: 10000 },
  },
  {
    templateId: 'lac-ha-corridor',
    name: 'Lạc Hà Hành Lang',
    hanzi: '廊',
    icon: '⛩️',
    category: 'palace',
    desc: 'Hành lang uốn lượn chữ L nối liền các điện các, tạo thế tụ linh tụ khí (5 ô).',
    w: 2,
    h: 3,
    cells: lShapeFootprint(),
    height: 56,
    imageSrc: '/castle/buildings/library/stage-1.webp',
    imageScale: 0.95,
    top: '#ffec99',
    left: '#f59f00',
    right: '#d9480f',
    outline: '#bf360c',
    prosperity: 350,
    cost: { wood: 280, ink: 120, coin: 1200 },
  },
  {
    templateId: 'sacred-tree',
    name: 'Cổ Thụ Linh Mộc',
    hanzi: '木',
    icon: '🌲',
    category: 'nature',
    desc: 'Cây cổ thụ ngàn năm hấp thu linh khí nhật nguyệt.',
    w: 1,
    h: 1,
    height: 52,
    top: '#a8d98a',
    left: '#87bd67',
    right: '#699e49',
    outline: '#4a7a30',
    prosperity: 80,
    cost: { wood: 60, ink: 0, coin: 200 },
  },
  {
    templateId: 'guardian-lion',
    name: 'Thạch Sư Uy Nghi',
    hanzi: '狮',
    icon: '🦁',
    category: 'defense',
    desc: 'Sư tử đá điêu khắc phong thủy trấn áp tà khí bốn phương.',
    w: 1,
    h: 1,
    height: 42,
    top: '#ffd875',
    left: '#d4aa48',
    right: '#a67e2a',
    outline: '#7c5716',
    prosperity: 180,
    cost: { wood: 120, ink: 50, coin: 800 },
  },
  {
    templateId: 'spirit-rock',
    name: 'Kỳ Thạch Phong Thủy',
    hanzi: '石',
    icon: '🪨',
    category: 'nature',
    desc: 'Khối đá phong thủy hội tụ tinh hoa đất trời.',
    w: 1,
    h: 1,
    height: 32,
    top: '#c9c3b8',
    left: '#a8a196',
    right: '#8a8378',
    outline: '#605a50',
    prosperity: 50,
    cost: { wood: 40, ink: 0, coin: 150 },
  },
];

export const getDifficultyTime = (diff?: 'easy' | 'normal' | 'hard'): number => {
  if (diff === 'hard') return 16;
  if (diff === 'normal') return 11;
  return 8;
};

export default function Home({ initialScreen }: { initialScreen?: Screen } = {}) {
  // Keep the first client render identical to the server render. The URL is
  // applied after hydration by the navigation effect below.
  const [screen, setScreen] = useState<Screen>(initialScreen ?? 'home');
  const [mode, setMode] = useState<'audition' | 'typing'>('audition');
  const [selected, setSelected] = useState(0);
  const [difficultyTab, setDifficultyTab] = useState<'easy' | 'normal' | 'hard'>('easy');
  const [selectedNormalPack, setSelectedNormalPack] = useState(0);
  const [selectedHardPack, setSelectedHardPack] = useState(0);
  const [activePackInfo, setActivePackInfo] = useState<{
    title: string;
    subtitle: string;
    bpm: string;
  } | null>(null);
  const activeMatchPool = useRef<VocabularyEntry[] | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [word, setWord] = useState(0);
  const [progress, setProgress] = useState(0);
  const [judgment, setJudgment] = useState('READY?');
  const [active, setActive] = useState(-1);
  const [phase, setPhase] = useState<'answer' | 'sequence' | 'beat'>('answer');
  const [sequence, setSequence] = useState<number[]>([0, 1, 3]);
  const [entered, setEntered] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [roundTime, setRoundTime] = useState(8);
  const [beat, setBeat] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [typingInput, setTypingInput] = useState('');
  const [typingTime, setTypingTime] = useState(8);
  const [typingFeedback, setTypingFeedback] = useState('NHẬP ĐÁP ÁN');
  const [typingLocked, setTypingLocked] = useState(false);
  const [directionCountdown, setDirectionCountdown] = useState(0);
  const [directionBreakDone, setDirectionBreakDone] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [playModeOpen, setPlayModeOpen] = useState(false);
  const [playModeStep, setPlayModeStep] = useState<'mode' | 'gameplay' | 'difficulty'>('mode');
  const openPlayModeModal = () => {
    setPlayModeStep('mode');
    setPlayModeOpen(true);
  };
  const [dictionaryQuery, setDictionaryQuery] = useState('');
  const [selectedHskFolder, setSelectedHskFolder] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [scoreStatus, setScoreStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [leaderboardLevel, setLeaderboardLevel] = useState(0);
  const [leaderboardMode, setLeaderboardMode] = useState<'audition' | 'typing'>('audition');
  const [leaderboardTab, setLeaderboardTab] = useState<'songs' | 'castle'>('songs');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [pvpName, setPvpName] = useState('');
  const [pvpCode, setPvpCode] = useState('');
  const [pvpRoom, setPvpRoom] = useState<PvpRoom | null>(null);
  const [pvpWaiting, setPvpWaiting] = useState(false);
  const [pvpError, setPvpError] = useState('');
  const [pvpGameMode, setPvpGameMode] = useState<'audition' | 'typing'>('audition');
  const [pvpRank, setPvpRank] = useState<PvpRank | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [authError, setAuthError] = useState('');
  const [progression, setProgression] = useState<Progression | null>(null);
  const [lastReward, setLastReward] = useState<{ xp: number; jade: number; baseJade?: number; castleBonusJade?: number; castleBonusRate?: number; spins?: number; wood?: number; ink?: number } | null>(null);
  const [rewardActionStatus, setRewardActionStatus] = useState<'idle' | 'loading'>('idle');
  const [rewardActionError, setRewardActionError] = useState('');
  const [chestReward, setChestReward] = useState<{ jade: number; xp: number; bonus: string | null } | null>(null);
  const [castleEffect, setCastleEffect] = useState<{ type: 'siege' | 'shield'; rewards?: { coins: number; wood: number; ink: number } } | null>(null);
  const [castleSocial, setCastleSocial] = useState<{ season: string; castles: PublicCastle[]; visitors: CastleVisitor[] } | null>(null);
  const [visitedCastle, setVisitedCastle] = useState<PublicCastle | null>(null);
  const [combatLogs, setCombatLogs] = useState<CombatLog[]>([]);
  const [combatQuiz, setCombatQuiz] = useState<{ id: string; targetId: string; targetName: string; questions: VocabularyEntry[]; index: number; correct: number } | null>(null);
  const [combatResult, setCombatResult] = useState<CombatLog | null>(null);
  const [cosmeticEffect, setCosmeticEffect] = useState<string | null>(null);
  const [codexTab, setCodexTab] = useState<'atlas' | 'collections' | 'journey'>('atlas');
  const [codexQuery, setCodexQuery] = useState('');
  const [selectedCastleBuilding, setSelectedCastleBuilding] = useState<string | null>(null);
  const [castleShopOpen, setCastleShopOpen] = useState(false);
  const [castleSocialOpen, setCastleSocialOpen] = useState(false);
  const [castleCombatOpen, setCastleCombatOpen] = useState(false);
  const [castleCommerceOpen, setCastleCommerceOpen] = useState(false);
  const [castleShowGrid, setCastleShowGrid] = useState(false);
  const [islandCalibration, setIslandCalibration] = useState<IslandCalibration>(DEFAULT_ISLAND_CALIBRATION);
  const [showDebugGrid, setShowDebugGrid] = useState(false);
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);
  const [castleBuildCatalogOpen, setCastleBuildCatalogOpen] = useState(false);
  const [pendingBuildingToPlace, setPendingBuildingToPlace] = useState<BuildingCatalogItem | null>(null);
  const [movingBuildingToPlace, setMovingBuildingToPlace] = useState<IsoBuildingData | null>(null);
  const [extraBuildings, setExtraBuildings] = useState<IsoBuildingData[]>(DEFAULT_EXTRA_BUILDINGS);
  const [catalogCategory, setCatalogCategory] = useState<'all' | 'palace' | 'study' | 'defense' | 'nature'>('all');
  const [castleToast, setCastleToast] = useState<{ msg: string; kind?: 'ok' | 'bad' } | null>(null);
  const [corePositions, setCorePositions] = useState<CoreBuildingPositions>(DEFAULT_CORE_POSITIONS);
  const [sandboxCorePositions, setSandboxCorePositions] = useState<CoreBuildingPositions>(DEFAULT_CORE_POSITIONS);
  const [activeConstructions, setActiveConstructions] = useState<Record<string, ActiveConstruction>>({});
  const [sandboxActiveConstructions, setSandboxActiveConstructions] = useState<Record<string, ActiveConstruction>>({});
  const [constructionTick, setConstructionTick] = useState<number>(0);
  const [lastHarvestTime, setLastHarvestTime] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('castle_last_harvest');
    setLastHarvestTime(saved ? Number(saved) : Date.now() - 3600 * 1000);
  }, []);

  // Sandbox Test States (100% Isolated from production user data)
  const [sandboxMainLevel, setSandboxMainLevel] = useState<number>(1);
  const [sandboxLibraryLevel, setSandboxLibraryLevel] = useState<number>(1);
  const [sandboxListeningLevel, setSandboxListeningLevel] = useState<number>(1);
  const [sandboxEnvStage, setSandboxEnvStage] = useState<number>(1);
  const [sandboxTheme, setSandboxTheme] = useState<string>('classic');
  const [sandboxWood, setSandboxWood] = useState<number>(99999);
  const [sandboxInk, setSandboxInk] = useState<number>(99999);
  const [sandboxCoins, setSandboxCoins] = useState<number>(999999);
  const [sandboxExtraBuildings, setSandboxExtraBuildings] = useState<IsoBuildingData[]>(DEFAULT_EXTRA_BUILDINGS);
  const [castleBurstBuildingId, setCastleBurstBuildingId] = useState<string | null>(null);
  const [castleBurstText, setCastleBurstText] = useState<string>('');
  const [sandboxAnimState, setSandboxAnimState] = useState<'idle' | 'upgrading'>('idle');
  const [sandboxIdleFx, setSandboxIdleFx] = useState<boolean>(true);
  const [castleCombatTrigger, setCastleCombatTrigger] = useState<CombatFxTrigger | null>(null);
  const [sandboxShieldActive, setSandboxShieldActive] = useState<boolean>(false);
  const [realmInfoOpen, setRealmInfoOpen] = useState(false);
  const [commerceTab, setCommerceTab] = useState<'themes' | 'cosmetics' | 'pass'>('themes');
  const [topupOpen, setTopupOpen] = useState(false);
  type SepayOrderInfo = {
    orderCode: string;
    amount: number;
    crystals: number;
    packageName: string;
    bankAccount: string;
    bankName: string;
    accountName: string;
    qrUrl: string;
    vietqrUrl: string;
  };
  const [sepayOrder, setSepayOrder] = useState<SepayOrderInfo | null>(null);
  const [sepayStatus, setSepayStatus] = useState<'idle' | 'creating' | 'waiting' | 'completed' | 'error'>('idle');
  const [sepayError, setSepayError] = useState<string>('');
  const [sepayCopied, setSepayCopied] = useState<string | null>(null);
  const [shopTab, setShopTab] = useState<'special' | 'cosmetics' | 'items' | 'pass' | 'crystals'>('special');
  const [spinOpen, setSpinOpen] = useState(false);
  const [slotResult, setSlotResult] = useState<SlotResult | null>(null);
  const [reelOffsets, setReelOffsets] = useState([0, 0, 0]);
  const [reelRun, setReelRun] = useState(0);
  const [spinError, setSpinError] = useState('');
  const [spinBusy, setSpinBusy] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const autoSpinRef = useRef(false);
  const spinBusyRef = useRef(false);
  const pvpPlayerId = useRef('');
  const pvpStarted = useRef(false);
  const pvpScoreSent = useRef(false);
  const pvpHistorySaved = useRef(false);
  const cloudMatchSaved = useRef(false);
  const rewardSessionId = useRef('');
  const animateScreenChange = useCallback((change: () => void) => {
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(change);
    } else {
      change();
    }
  }, []);
  const navigate = useCallback((nextScreen: Screen) => {
    if (nextScreen === screen) return;
    window.history.pushState({ hanzibeatScreen: nextScreen }, '', screenPaths[nextScreen]);
    animateScreenChange(() => setScreen(nextScreen));
  }, [screen, animateScreenChange]);

  const showCastleToast = useCallback((msg: string, kind: 'ok' | 'bad' = 'ok') => {
    setCastleToast({ msg, kind });
    setTimeout(() => {
      setCastleToast((curr) => (curr?.msg === msg ? null : curr));
    }, 2200);
  }, []);

  const handleHarvest = useCallback(() => {
    const homeCastle = progression?.castle ?? { wood: 0, ink: 0, shieldActiveUntil: 0, theme: 'classic', buildings: { main: 1, library: 1, listening: 1 } };
    const homeMainLevel = homeCastle.buildings.main ?? 1;
    const elapsedHarvestMs = lastHarvestTime > 0
      ? Math.min(12 * 3600 * 1000, Math.max(0, Date.now() - lastHarvestTime))
      : 0;
    const elapsedHarvestHours = elapsedHarvestMs / (3600 * 1000);
    const hWood = Math.floor(elapsedHarvestHours * (4 + homeMainLevel * 1.5));
    const hInk = Math.floor(elapsedHarvestHours * (2 + homeMainLevel * 0.8));
    const hCoins = Math.floor(elapsedHarvestHours * (100 + homeMainLevel * 50));

    if (hWood <= 0 && hInk <= 0) {
      showCastleToast('Tài nguyên nhàn rỗi đang tích lũy, hãy quay lại sau ít phút!', 'bad');
      return;
    }
    setProgression((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        coins: (prev.coins ?? 0) + hCoins,
        castle: {
          ...prev.castle,
          wood: prev.castle.wood + hWood,
          ink: prev.castle.ink + hInk,
        },
      };
    });
    const now = Date.now();
    setLastHarvestTime(now);
    if (typeof window !== 'undefined') {
      localStorage.setItem('castle_last_harvest', String(now));
    }
    showCastleToast(`🌾 Thu hoạch thành công! +${hWood} 🪵, +${hInk} 🖌, +${hCoins} 🪙`, 'ok');
  }, [progression, lastHarvestTime, showCastleToast]);

  const castleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSaveCastleLayout = useCallback((uid: string | undefined, layout: IsoBuildingData[]) => {
    if (!uid || uid === 'guest') return;
    if (castleSaveTimeoutRef.current) {
      clearTimeout(castleSaveTimeoutRef.current);
    }
    castleSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(firebaseDb, 'users', uid, 'castle', 'state'),
          {
            buildingsLayout: layout,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('[Castle Cloud Sync] Failed to save layout to Firestore:', e);
      }
    }, 800);
  }, []);

  const castleCoreSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSaveCastleCorePositions = useCallback((uid: string | undefined, positions: CoreBuildingPositions) => {
    if (!uid || uid === 'guest') return;
    if (castleCoreSaveTimeoutRef.current) {
      clearTimeout(castleCoreSaveTimeoutRef.current);
    }
    castleCoreSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(firebaseDb, 'users', uid, 'castle', 'state'),
          {
            corePositions: positions,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('[Castle Cloud Sync] Failed to save core positions to Firestore:', e);
      }
    }, 800);
  }, []);

  const handleTogglePendingFlip = useCallback(() => {
    setPendingBuildingToPlace((prev) => {
      if (!prev) return null;
      const nextFlip = !prev.flipX;
      showCastleToast(nextFlip ? '🔄 Đã lật hướng (Nghịch)' : '🔄 Đã lật hướng (Thuận)', 'ok');
      return { ...prev, flipX: nextFlip };
    });
  }, [showCastleToast]);

  const handleToggleMovingFlip = useCallback(() => {
    setMovingBuildingToPlace((prev) => {
      if (!prev) return null;
      const nextFlip = !prev.flipX;
      showCastleToast(nextFlip ? '🔄 Đã lật hướng (Nghịch)' : '🔄 Đã lật hướng (Thuận)', 'ok');
      return { ...prev, flipX: nextFlip };
    });
  }, [showCastleToast]);

  const handleToggleSelectedBuildingFlip = useCallback((isSandbox = false) => {
    const list = isSandbox ? sandboxExtraBuildings : extraBuildings;
    const setList = isSandbox ? setSandboxExtraBuildings : setExtraBuildings;
    const currentCorePos = isSandbox ? sandboxCorePositions : corePositions;
    const setCorePos = isSandbox ? setSandboxCorePositions : setCorePositions;

    // Check if target is a core building ('main', 'library', 'listening')
    if (selectedCastleBuilding === 'main' || selectedCastleBuilding === 'library' || selectedCastleBuilding === 'listening') {
      const coreKey = selectedCastleBuilding;
      const currentPos = currentCorePos[coreKey];
      const curCol = currentPos?.col ?? (coreKey === 'main' ? 4 : coreKey === 'library' ? 1 : 8);
      const curRow = currentPos?.row ?? 4;
      const curFlip = currentPos?.flipX ?? false;
      const nextFlip = !curFlip;
      const w = coreKey === 'main' ? 3 : 2;
      const h = coreKey === 'main' ? 3 : 2;

      const gm = new GridManager(12, 12);
      const allCores = [
        { id: 'main', col: currentCorePos.main?.col ?? 4, row: currentCorePos.main?.row ?? 4, w: 3, h: 3 },
        { id: 'library', col: currentCorePos.library?.col ?? 1, row: currentCorePos.library?.row ?? 4, w: 2, h: 2 },
        { id: 'listening', col: currentCorePos.listening?.col ?? 8, row: currentCorePos.listening?.row ?? 4, w: 2, h: 2 },
        { id: 'guardian-statue', col: 5, row: 8, w: 1, h: 1 },
      ];
      for (const core of allCores) {
        if (core.id !== coreKey) {
          gm.placeBuilding(core.id, rectFootprint(core.w, core.h), core.col, core.row, 1, false);
        }
      }
      for (const b of list) {
        gm.placeBuilding(b.id, getEffectiveFootprint(b), b.col, b.row, 1, false);
      }

      const nextTarget = { id: coreKey, col: curCol, row: curRow, w, h, flipX: nextFlip };
      const nextCells = getEffectiveFootprint(nextTarget);
      const check = gm.canPlace(nextCells, curCol, curRow, coreKey, true);
      if (!check.ok) {
        if (check.reason === 'buffer_violation') {
          showCastleToast('Không thể lật hướng: Vi phạm khoảng cách đệm 1 ô với công trình khác!', 'bad');
        } else {
          showCastleToast('Không thể lật hướng do va chạm với công trình khác!', 'bad');
        }
        return;
      }

      const nextPositions: CoreBuildingPositions = {
        ...currentCorePos,
        [coreKey]: {
          col: curCol,
          row: curRow,
          flipX: nextFlip,
        },
      };
      setCorePos(nextPositions);
      if (!isSandbox) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`castle_core_positions_${authUser?.id ?? 'guest'}`, JSON.stringify(nextPositions));
        }
        debouncedSaveCastleCorePositions(authUser?.id, nextPositions);
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('castle_sandbox_core_positions', JSON.stringify(nextPositions));
        }
      }
      showCastleToast(nextFlip ? '🔄 Đã lật hướng công trình (Nghịch)' : '🔄 Đã lật hướng công trình (Thuận)', 'ok');
      return;
    }

    const target = list.find((b) => b.id === selectedCastleBuilding);
    if (!target) return;

    const nextFlip = !target.flipX;
    const nextTarget = { ...target, flipX: nextFlip };
    const nextCells = getEffectiveFootprint(nextTarget);

    const gm = new GridManager(12, 12);
    const coreObstacles = [
      { id: 'main', col: currentCorePos.main?.col ?? 4, row: currentCorePos.main?.row ?? 4, w: 3, h: 3 },
      { id: 'library', col: currentCorePos.library?.col ?? 1, row: currentCorePos.library?.row ?? 4, w: 2, h: 2 },
      { id: 'listening', col: currentCorePos.listening?.col ?? 8, row: currentCorePos.listening?.row ?? 4, w: 2, h: 2 },
      { id: 'guardian-statue', col: 5, row: 8, w: 1, h: 1 },
    ];
    for (const core of coreObstacles) {
      gm.placeBuilding(core.id, rectFootprint(core.w, core.h), core.col, core.row, 1, false);
    }
    for (const b of list) {
      if (b.id !== target.id) {
        gm.placeBuilding(b.id, getEffectiveFootprint(b), b.col, b.row, 1, false);
      }
    }

    const check = gm.canPlace(nextCells, target.col, target.row, target.id, true);
    if (!check.ok) {
      if (check.reason === 'buffer_violation') {
        showCastleToast('Không thể lật hướng: Vi phạm khoảng cách đệm 1 ô với công trình khác!', 'bad');
      } else {
        showCastleToast('Không thể lật hướng do va chạm với công trình khác!', 'bad');
      }
      return;
    }

    const updated = list.map((b) => (b.id === target.id ? { ...b, flipX: nextFlip } : b));
    setList(updated);
    if (!isSandbox) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`castle_extra_buildings_${authUser?.id ?? 'guest'}`, JSON.stringify(updated));
      }
      debouncedSaveCastleLayout(authUser?.id, updated);
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('castle_sandbox_extra_buildings', JSON.stringify(updated));
      }
    }
    showCastleToast(nextFlip ? '🔄 Đã lật hướng công trình (Nghịch)' : '🔄 Đã lật hướng công trình (Thuận)', 'ok');
  }, [selectedCastleBuilding, sandboxExtraBuildings, extraBuildings, sandboxCorePositions, corePositions, authUser?.id, debouncedSaveCastleLayout, debouncedSaveCastleCorePositions, showCastleToast]);

  // 10s Construction State Machine & Animation Tick Loop
  useEffect(() => {
    const hasActive =
      Object.keys(activeConstructions).length > 0 ||
      Object.keys(sandboxActiveConstructions).length > 0;
    if (!hasActive) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setConstructionTick((t) => (t + 1) % 10000);

      // Check main game constructions
      setActiveConstructions((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, item] of Object.entries(prev)) {
          if (now >= item.startTime + item.duration) {
            changed = true;
            delete next[id];
            setCastleBurstBuildingId(id);
            setCastleBurstText(
              item.type === 'upgrade'
                ? item.targetLevel ? `Lv.${item.targetLevel} · THĂNG CẤP!` : 'THĂNG CẤP HOÀN TẤT!'
                : 'XÂY DỰNG HOÀN TẤT!'
            );
            showCastleToast(`🎉 [${item.name}] đã hoàn thành thi công!`, 'ok');

            if (item.type === 'upgrade') {
              if (id === 'main' || id === 'library' || id === 'listening') {
                runProgressionAction('upgrade-castle', id);
              } else {
                setExtraBuildings((ebs) =>
                  ebs.map((b) => (b.id === id ? { ...b, level: (b.level ?? 1) + 1 } : b))
                );
              }
            } else if (item.type === 'build' && item.newBuildingData) {
              setExtraBuildings((ebs) => {
                if (ebs.some((b) => b.id === id)) return ebs;
                return [...ebs, item.newBuildingData!];
              });
            }
          }
        }
        return changed ? next : prev;
      });

      // Check sandbox constructions
      setSandboxActiveConstructions((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, item] of Object.entries(prev)) {
          if (now >= item.startTime + item.duration) {
            changed = true;
            delete next[id];
            setCastleBurstBuildingId(id);
            setCastleBurstText(
              item.type === 'upgrade'
                ? item.targetLevel ? `Lv.${item.targetLevel} · THĂNG CẤP!` : 'THĂNG CẤP HOÀN TẤT!'
                : 'XÂY DỰNG HOÀN TẤT!'
            );
            showCastleToast(`🎉 [Sandbox] [${item.name}] đã hoàn thành thi công!`, 'ok');

            if (item.type === 'upgrade') {
              if (id === 'main') setSandboxMainLevel((l) => Math.min(10, l + 1));
              else if (id === 'library') setSandboxLibraryLevel((l) => Math.min(10, l + 1));
              else if (id === 'listening') setSandboxListeningLevel((l) => Math.min(10, l + 1));
              else {
                setSandboxExtraBuildings((ebs) =>
                  ebs.map((b) => (b.id === id ? { ...b, level: (b.level ?? 1) + 1 } : b))
                );
              }
            } else if (item.type === 'build' && item.newBuildingData) {
              setSandboxExtraBuildings((ebs) => {
                if (ebs.some((b) => b.id === id)) return ebs;
                return [...ebs, item.newBuildingData!];
              });
            }
          }
        }
        return changed ? next : prev;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [activeConstructions, sandboxActiveConstructions, showCastleToast]);

  const handleInstantCompleteConstruction = useCallback((id: string, isSandbox = false) => {
    if (!isSandbox) {
      const item = activeConstructions[id];
      if (!item) return;
      setActiveConstructions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setCastleBurstBuildingId(id);
      setCastleBurstText(
        item.type === 'upgrade'
          ? item.targetLevel ? `Lv.${item.targetLevel} · THĂNG CẤP!` : 'THĂNG CẤP HOÀN TẤT!'
          : 'XÂY DỰNG HOÀN TẤT!'
      );
      if (item.type === 'upgrade') {
        if (id === 'main' || id === 'library' || id === 'listening') {
          runProgressionAction('upgrade-castle', id);
        } else {
          setExtraBuildings((ebs) =>
            ebs.map((b) => (b.id === id ? { ...b, level: (b.level ?? 1) + 1 } : b))
          );
        }
      } else if (item.type === 'build' && item.newBuildingData) {
        setExtraBuildings((ebs) => {
          if (ebs.some((b) => b.id === id)) return ebs;
          return [...ebs, item.newBuildingData!];
        });
      }
      showCastleToast(`⚡ [${item.name}] đã hoàn thành thi công ngay lập tức!`, 'ok');
    } else {
      const item = sandboxActiveConstructions[id];
      if (!item) return;
      setSandboxActiveConstructions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setCastleBurstBuildingId(id);
      setCastleBurstText(
        item.type === 'upgrade'
          ? item.targetLevel ? `Lv.${item.targetLevel} · THĂNG CẤP!` : 'THĂNG CẤP HOÀN TẤT!'
          : 'XÂY DỰNG HOÀN TẤT!'
      );
      if (item.type === 'upgrade') {
        if (id === 'main') setSandboxMainLevel((l) => Math.min(10, l + 1));
        else if (id === 'library') setSandboxLibraryLevel((l) => Math.min(10, l + 1));
        else if (id === 'listening') setSandboxListeningLevel((l) => Math.min(10, l + 1));
        else {
          setSandboxExtraBuildings((ebs) =>
            ebs.map((b) => (b.id === id ? { ...b, level: (b.level ?? 1) + 1 } : b))
          );
        }
      } else if (item.type === 'build' && item.newBuildingData) {
        setSandboxExtraBuildings((ebs) => {
          if (ebs.some((b) => b.id === id)) return ebs;
          return [...ebs, item.newBuildingData!];
        });
      }
      showCastleToast(`⚡ [Sandbox] [${item.name}] đã hoàn thành thi công ngay lập tức!`, 'ok');
    }
  }, [activeConstructions, sandboxActiveConstructions, showCastleToast]);

  const mainBuildingAnimStates = useMemo(() => {
    const states: Record<string, { state: BuildingAnimState; progress?: number }> = {};
    const now = Date.now();
    for (const [id, constr] of Object.entries(activeConstructions)) {
      const elapsed = Math.max(0, now - constr.startTime);
      const progress = Math.min(1, elapsed / constr.duration);
      states[id] = { state: 'upgrading', progress };
    }
    return states;
  }, [activeConstructions, constructionTick]);

  const sandboxBuildingAnimStates = useMemo(() => {
    const states: Record<string, { state: BuildingAnimState; progress?: number }> = {};
    const now = Date.now();
    for (const [id, constr] of Object.entries(sandboxActiveConstructions)) {
      const elapsed = Math.max(0, now - constr.startTime);
      const progress = Math.min(1, elapsed / constr.duration);
      states[id] = { state: 'upgrading', progress };
    }
    if (sandboxAnimState === 'upgrading') {
      const target = selectedCastleBuilding || 'main';
      if (!states[target]) {
        states[target] = { state: 'upgrading', progress: 0.65 };
      }
    }
    return states;
  }, [sandboxActiveConstructions, sandboxAnimState, selectedCastleBuilding, constructionTick]);

  const handleGlobalToggleFlip = useCallback((isSandbox = false) => {
    if (pendingBuildingToPlace) {
      handleTogglePendingFlip();
    } else if (movingBuildingToPlace) {
      handleToggleMovingFlip();
    } else if (selectedCastleBuilding) {
      handleToggleSelectedBuildingFlip(isSandbox);
    }
  }, [pendingBuildingToPlace, movingBuildingToPlace, selectedCastleBuilding, handleTogglePendingFlip, handleToggleMovingFlip, handleToggleSelectedBuildingFlip]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        if (screen === 'castle-test') {
          handleGlobalToggleFlip(true);
        } else if (screen === 'castle') {
          handleGlobalToggleFlip(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, handleGlobalToggleFlip]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const uid = authUser?.id ?? 'guest';
    const storageKey = `castle_extra_buildings_${uid}`;
    const coreKey = `castle_core_positions_${uid}`;

    // Load saved core positions
    let loadedCore = DEFAULT_CORE_POSITIONS;
    const savedCore = localStorage.getItem(coreKey);
    if (savedCore) {
      try {
        const parsed = JSON.parse(savedCore);
        if (parsed && typeof parsed === 'object') {
          loadedCore = {
            main: parsed.main ?? DEFAULT_CORE_POSITIONS.main,
            library: parsed.library ?? DEFAULT_CORE_POSITIONS.library,
            listening: parsed.listening ?? DEFAULT_CORE_POSITIONS.listening,
          };
          setCorePositions(loadedCore);
        }
      } catch {
        /* fallback */
      }
    }

    const coreObstacles = [
      { id: 'main', col: loadedCore.main?.col ?? 4, row: loadedCore.main?.row ?? 4, w: 3, h: 3 },
      { id: 'library', col: loadedCore.library?.col ?? 1, row: loadedCore.library?.row ?? 4, w: 2, h: 2 },
      { id: 'listening', col: loadedCore.listening?.col ?? 8, row: loadedCore.listening?.row ?? 4, w: 2, h: 2 },
    ];

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeBuildingsLayout(parsed, coreObstacles);
          setExtraBuildings(sanitized);
        }
      } catch {
        /* fallback to default */
      }
    }

    // Cloud Firestore Layout & Core Positions Sync
    if (authUser?.id && authUser.id !== 'guest') {
      getDoc(doc(firebaseDb, 'users', authUser.id, 'castle', 'state'))
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.corePositions) {
              setCorePositions(data.corePositions);
              localStorage.setItem(coreKey, JSON.stringify(data.corePositions));
            }
            if (data?.buildingsLayout && Array.isArray(data.buildingsLayout)) {
              const currentCores = data.corePositions ?? loadedCore;
              const obs = [
                { id: 'main', col: currentCores.main?.col ?? 4, row: currentCores.main?.row ?? 4, w: 3, h: 3 },
                { id: 'library', col: currentCores.library?.col ?? 1, row: currentCores.library?.row ?? 4, w: 2, h: 2 },
                { id: 'listening', col: currentCores.listening?.col ?? 8, row: currentCores.listening?.row ?? 4, w: 2, h: 2 },
              ];
              const sanitized = sanitizeBuildingsLayout(data.buildingsLayout, obs);
              if (sanitized.length > 0) {
                setExtraBuildings(sanitized);
                localStorage.setItem(storageKey, JSON.stringify(sanitized));
              }
            }
          }
        })
        .catch((err) => {
          console.warn('[Castle Cloud Load] Failed to load layout:', err);
        });
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let loadedSandboxCore = DEFAULT_CORE_POSITIONS;
    const savedCore = localStorage.getItem('castle_sandbox_core_positions');
    if (savedCore) {
      try {
        const parsed = JSON.parse(savedCore);
        if (parsed && typeof parsed === 'object') {
          loadedSandboxCore = {
            main: parsed.main ?? DEFAULT_CORE_POSITIONS.main,
            library: parsed.library ?? DEFAULT_CORE_POSITIONS.library,
            listening: parsed.listening ?? DEFAULT_CORE_POSITIONS.listening,
          };
          setSandboxCorePositions(loadedSandboxCore);
        }
      } catch {
        /* fallback */
      }
    }

    const saved = localStorage.getItem('castle_sandbox_extra_buildings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const coreObstacles = [
            { id: 'main', col: loadedSandboxCore.main?.col ?? 4, row: loadedSandboxCore.main?.row ?? 4, w: 3, h: 3 },
            { id: 'library', col: loadedSandboxCore.library?.col ?? 1, row: loadedSandboxCore.library?.row ?? 4, w: 2, h: 2 },
            { id: 'listening', col: loadedSandboxCore.listening?.col ?? 8, row: loadedSandboxCore.listening?.row ?? 4, w: 2, h: 2 },
          ];
          setSandboxExtraBuildings(sanitizeBuildingsLayout(parsed, coreObstacles));
        }
      } catch {
        /* fallback */
      }
    }
  }, []);

  async function spinOnce() {
    const user = firebaseAuth.currentUser;
    if (!user || spinBusyRef.current) return;
    spinBusyRef.current = true;
    setSpinBusy(true);
    setSpinError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/progression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'spin-wheel' }),
      });
      const data = await response.json() as { progression?: Progression; slotResult?: SlotResult; error?: string };
      if (!response.ok || !data.slotResult) throw new Error(data.error || 'Không thể quay Thiên Cơ Luân.');
      if (data.progression) setProgression(data.progression);
      setSlotResult(null);
      setReelOffsets([0, 0, 0]);
      setReelRun((current) => current + 1);
      const targetOffsets = data.slotResult.reels.map((symbolId) => {
        const symbolIndex = Math.max(0, slotSymbols.findIndex((symbol) => symbol.id === symbolId));
        const targetIndex = slotSymbols.length * 6 + symbolIndex;
        return (targetIndex - 1) * 96;
      });
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        setReelOffsets(targetOffsets);
        resolve();
      })));
      await new Promise((resolve) => window.setTimeout(resolve, 1050));
      setSlotResult(data.slotResult);
      if (autoSpinRef.current && (data.progression?.spins.balance ?? 0) > 0) {
        spinBusyRef.current = false;
        setSpinBusy(false);
        window.setTimeout(() => void spinOnce(), 90);
        return;
      }
      autoSpinRef.current = false;
      setAutoSpin(false);
    } catch (error) {
      setSpinError(error instanceof Error ? error.message : 'Không thể quay Thiên Cơ Luân.');
      autoSpinRef.current = false;
      setAutoSpin(false);
    } finally {
      spinBusyRef.current = false;
      setSpinBusy(false);
    }
  }
  const stopAutoSpin = () => {
    autoSpinRef.current = false;
    setAutoSpin(false);
  };
  const toggleAutoSpin = () => {
    if (autoSpinRef.current) {
      stopAutoSpin();
      return;
    }
    if ((progression?.spins.balance ?? 0) < 1) return;
    autoSpinRef.current = true;
    setAutoSpin(true);
    void spinOnce();
  };
  const floatingCastleLevel = progression?.castle.buildings
    ? Math.max(1, Object.values(progression.castle.buildings).reduce((sum, lvl) => sum + lvl, 0) - 2)
    : 1;
  const floatingCastleStage = castleVisualStage(progression?.castle.buildings.main ?? 1);
  const floatingCastleHasHarvest = lastHarvestTime > 0 && (Date.now() - lastHarvestTime) >= 3600 * 1000;
  const historyControls = (
    <>
      <div className="history-controls" aria-label="Điều hướng trang">
        <button onClick={() => window.history.back()} aria-label="Quay lại trang trước" title="Trang trước"><ChevronLeft /></button>
        <button onClick={() => window.history.forward()} aria-label="Đi tới trang sau" title="Trang sau"><ChevronRight /></button>
      </div>
      {screen !== 'castle' && screen !== 'castle-test' && (
        <button
          className="castle-fab"
          onClick={() => navigate('castle')}
          aria-label="Vào Hán Tự Thành"
          title="Vào Hán Tự Thành"
        >
          <img
            src={`/castle/buildings/main/stage-${floatingCastleStage}.webp`}
            alt="Hán Tự Thành"
          />
          <span>
            <b>Lv.{floatingCastleLevel}</b>
            <small>THÀNH</small>
          </span>
          {floatingCastleHasHarvest && (
            <i className="castle-fab-badge" title="Có tài nguyên thu hoạch!">✨</i>
          )}
        </button>
      )}
      <button className="spin-fab" onClick={() => authUser ? setSpinOpen(true) : navigate('auth')} aria-label="Mở Thiên Cơ Luân"><img src="/items/celestial-wheel-icon.png" alt=""/><span><b>{progression?.spins.balance ?? 0}</b><small>SPIN</small></span></button>
      <button className="battle-pass-fab" onClick={() => { if (!authUser) return navigate('auth'); setCommerceTab('pass'); setCastleCommerceOpen(true); navigate('castle'); }} aria-label="Mở Hành Trình Long Mạch"><img src="/items/battle-pass-icon.png" alt=""/><span><b>PASS</b><small>MÙA 1</small></span></button>
      {spinOpen && <div className="spin-modal-backdrop" onClick={() => { stopAutoSpin(); setSpinOpen(false); }}><section className="spin-modal jackpot-layout" role="dialog" aria-modal="true" aria-label="Thiên Cơ Jackpot" onClick={(event) => event.stopPropagation()}>
        <button className="spin-modal-close" onClick={() => { stopAutoSpin(); setSpinOpen(false); }} aria-label="Đóng">×</button>
        <div className="jackpot-topbar"><span><img src="/items/coin.png" alt="Coin"/><b>{(progression?.coins ?? 0).toLocaleString('vi-VN')}</b></span><strong>天机 JACKPOT</strong><span><img src="/items/spin-refund.png" alt="Spin"/><b>{progression?.spins.balance ?? 0}</b></span></div>
        <div className={`jackpot-machine ${slotResult?.triple ? 'jackpot-win' : ''}`}><div className="jackpot-marquee">天机宝库</div><div className="jackpot-payline"/><div className="jackpot-reels">{[0,1,2].map((reelIndex) => <div className="jackpot-reel" key={`${reelRun}-${reelIndex}`}><div className="jackpot-strip" style={{ transform: `translateY(-${reelOffsets[reelIndex]}px)`, transition: `transform ${.7 + reelIndex * .15}s cubic-bezier(.12,.78,.16,1)` }}>{slotStrip.map((symbol, symbolIndex) => <div className="jackpot-symbol" key={`${reelIndex}-${symbolIndex}`}><img src={symbol.image} alt={symbol.label}/></div>)}</div></div>)}</div></div>
        <div className={`slot-result ${slotResult ? 'show' : ''}`}><small>{slotResult?.triple ? '🎉 BỘ BA' : 'PHẦN THƯỞNG'}</small><div>{slotResult && Object.entries(slotResult.rewards).filter(([,amount]) => amount > 0).map(([kind,amount]) => { const rewardAssets: Record<string,string> = { coins:'/items/coin.png',spins:'/items/spin-refund.png',wood:'/items/spin-wood.png',ink:'/items/spin-ink.png',jade:'/items/jade-fragment.png',chests:'/items/daily-chest.png',shields:'/items/spin-castle-shield.png',tickets:'/items/spin-siege-ticket.png',fragments:'/items/spin-destiny-fragment.png',jackpots:'/items/spin-jackpot.png' }; return <span key={kind}><img src={rewardAssets[kind]} alt=""/><b>×{amount}</b></span>; })}{slotResult && Object.values(slotResult.rewards).every((amount) => amount === 0) && <b>CHƯA TRÚNG</b>}</div>{!slotResult && <p>QUAY ĐỂ NHẬN THƯỞNG</p>}</div>
        {spinError && <p className="spin-error">{spinError}</p>}
        <button className={`spin-hold-button ${spinBusy ? 'spinning' : ''} ${autoSpin ? 'auto-spinning' : ''}`} disabled={!authUser || (!autoSpin && (progression?.spins.balance ?? 0) < 1)} onClick={toggleAutoSpin}>{autoSpin ? 'DỪNG' : (progression?.spins.balance ?? 0) > 0 ? 'QUAY' : 'HẾT LƯỢT'}<small>{autoSpin ? 'Đang tự động quay' : 'Nhấn để tự động quay'}</small></button>
      </section></div>}
    </>
  );
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [matchVocabulary, setMatchVocabulary] = useState<VocabularyEntry[]>(
    () => shuffleVocabulary(allVocabulary).slice(0, WORDS_PER_MATCH),
  );
  const [volume, setVolume] = useState(0.65);
  const [currentTrackName, setCurrentTrackName] = useState('Chưa có nhạc');
  const [audioStatus, setAudioStatus] = useState<
    'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error'
  >('idle');
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const typingInputRef = useRef<HTMLInputElement | null>(null);
  const vocab = matchVocabulary;
  const directionSplit = pvpRoom ? 12 : 10;
  const filteredVocabulary = useMemo(() => {
    const query = normalizeAnswer(dictionaryQuery);
    const folderVocabulary = selectedHskFolder
      ? allVocabulary.filter((entry) => entry[4] === `HSK ${selectedHskFolder}`)
      : allVocabulary;
    if (!query) return folderVocabulary;
    return folderVocabulary.filter((entry) =>
      entry.some((value) => normalizeAnswer(value).includes(query)),
    );
  }, [dictionaryQuery, selectedHskFolder]);
  const options = useMemo(() => {
    if (!vocab.length || !vocab[word]) return [];
    const column = round <= directionSplit ? 3 : 0;
    const correct = vocab[word][column];
    const uniqueDistractors: string[] = [];
    for (let offset = 1; offset < vocab.length; offset++) {
      const candidate = vocab[(word + offset) % vocab.length][column];
      if (candidate !== correct && !uniqueDistractors.includes(candidate)) {
        uniqueDistractors.push(candidate);
        if (uniqueDistractors.length === 3) break;
      }
    }
    const opts = [correct, ...uniqueDistractors];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [word, round, vocab, directionSplit]);
  const makeRound = useCallback(() => {
    if (round >= vocab.length) {
      setProgress(100);
      navigate('result');
      return;
    }
    if (round === directionSplit && !directionBreakDone) {
      setDirectionBreakDone(true);
      setDirectionCountdown(10);
      setPhase('sequence');
      return;
    }
    setWord((w) => (w + 1) % vocab.length);
    setRound((r) => r + 1);
    setProgress((round / vocab.length) * 100);
    setPhase('answer');
    setEntered([]);
    setRoundTime(getDifficultyTime(difficultyTab));
    setJudgment('CHỌN ĐÁP ÁN');
    setSequence(
      Array.from(
        { length: Math.min(3 + Math.floor(round / 3), 7) },
        (_, i) => (round * 3 + i * 2) % 4,
      ),
    );
  }, [round, vocab.length, directionBreakDone, difficultyTab, directionSplit]);
  const playDefaultTrack = (trackIndex?: number) => {
    const index =
      trackIndex ?? Math.floor(Math.random() * defaultAudioTracks.length);
    const track = defaultAudioTracks[index % defaultAudioTracks.length];
    audioPlayer.current?.pause();
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = null;
    }
    const nextVolume = volume <= 0.01 ? 0.65 : volume;
    if (volume <= 0.01) setVolume(nextVolume);
    const player = new Audio();
    player.preload = 'auto';
    player.loop = true;
    player.volume = nextVolume;
    player.src = track.src;
    player.addEventListener('playing', () => setAudioStatus('playing'));
    player.addEventListener('pause', () => setAudioStatus('paused'));
    player.addEventListener('error', () => setAudioStatus('error'));
    audioPlayer.current = player;
    setCurrentTrackName(track.name);
    setAudioStatus('loading');
    player.load();
    void player.play().catch(() => setAudioStatus('blocked'));
  };
  const toggleAudio = () => {
    const player = audioPlayer.current;
    if (!player) {
      playDefaultTrack(0);
      return;
    }
    if (player.paused) {
      setAudioStatus('loading');
      void player.play().catch(() => setAudioStatus('blocked'));
    } else {
      player.pause();
    }
  };
  const beginRewardSession = async (kind: 'offline' | 'daily' | 'pvp', level: number) => {
    rewardSessionId.current = '';
    const user = firebaseAuth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/progression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'start-match', kind, mode, level }),
      });
      const data = await response.json() as { sessionId?: string };
      rewardSessionId.current = data.sessionId ?? '';
    } catch {
      rewardSessionId.current = '';
    }
  };
  const start = (
    songIndex = selected,
    forcedVocabulary?: VocabularyEntry[],
    isDailyChallenge = false,
    packInfo?: { title: string; subtitle: string; bpm: string } | null,
  ) => {
    const nextSong = Number.isInteger(songIndex) ? songIndex : selected;
    const requestedPool =
      nextSong === 1
        ? hsk2Vocabulary
        : nextSong === 2
          ? hsk3Vocabulary
          : nextSong === 3
            ? hsk4Vocabulary
            : baseVocabulary;
    const pool =
      requestedPool.length >= WORDS_PER_MATCH ? requestedPool : allVocabulary;

    let nextVocabulary: VocabularyEntry[];
    if (forcedVocabulary) {
      activeMatchPool.current = forcedVocabulary;
      if (pvpStarted.current) {
        nextVocabulary = forcedVocabulary.slice(0, PVP_QUESTIONS);
      } else if (forcedVocabulary.length > WORDS_PER_MATCH) {
        nextVocabulary = shuffleVocabulary(forcedVocabulary).slice(0, WORDS_PER_MATCH);
      } else {
        nextVocabulary = shuffleVocabulary(forcedVocabulary);
      }
      if (packInfo !== undefined) {
        setActivePackInfo(packInfo);
      }
    } else if (activeMatchPool.current && !isDailyChallenge) {
      nextVocabulary = activeMatchPool.current.length > WORDS_PER_MATCH
        ? shuffleVocabulary(activeMatchPool.current).slice(0, WORDS_PER_MATCH)
        : shuffleVocabulary(activeMatchPool.current);
    } else {
      activeMatchPool.current = null;
      setActivePackInfo(null);
      nextVocabulary = shuffleVocabulary(pool).slice(0, WORDS_PER_MATCH);
    }

    if (!forcedVocabulary && !activeMatchPool.current) setPvpRoom(null);
    setDailyChallenge(isDailyChallenge);
    setSelected(nextSong);
    setMatchVocabulary(nextVocabulary);
    setScore(0);
    setCombo(0);
    setProgress(0);
    setWord(0);
    setCorrect(0);
    setRound(1);
    const currentDiffTime = getDifficultyTime(difficultyTab);
    setRoundTime(currentDiffTime);
    setSequence([0, 1, 3]);
    setEntered([]);
    setPhase('answer');
    setJudgment('CHỌN ĐÁP ÁN');
    setTypingInput('');
    setTypingTime(currentDiffTime);
    setTypingFeedback('NHẬP ĐÁP ÁN');
    setTypingLocked(false);
    setDirectionCountdown(0);
    setDirectionBreakDone(false);
    setScoreStatus('idle');
    setLastReward(null);
    cloudMatchSaved.current = false;
    const rewardKind = isDailyChallenge
      ? 'daily'
      : forcedVocabulary && pvpStarted.current
        ? 'pvp'
        : 'offline';
    void beginRewardSession(rewardKind, nextSong + 1);
    navigate('game');
    playDefaultTrack();
  };
  const startDailyChallenge = () => {
    const availableHskVocabulary = allVocabulary.filter((entry) => {
      const level = Number(entry[4].replace('HSK ', ''));
      return level >= 1 && level <= 9;
    });
    const dailyWords = shuffleVocabulary(availableHskVocabulary).slice(
      0,
      WORDS_PER_MATCH,
    );
    start(1, dailyWords, true);
  };
  const ensurePvpPlayer = () => {
    if (!pvpPlayerId.current) {
      pvpPlayerId.current = localStorage.getItem('hanzibeat-pvp-id') || crypto.randomUUID();
      localStorage.setItem('hanzibeat-pvp-id', pvpPlayerId.current);
    }
    return pvpPlayerId.current;
  };
  const beginPvpGame = useCallback((room: PvpRoom) => {
    if (pvpStarted.current) return;
    pvpStarted.current = true;
    pvpScoreSent.current = false;
    pvpHistorySaved.current = false;
    setPvpRoom(room);
    setMode(room.mode ?? 'typing');
    const firstWords = shuffleVocabulary(allVocabulary, room.seed).slice(0, 8);
    const firstPhrases = shuffleVocabulary(collocationsVocabulary, room.seed + 11).slice(0, 2);
    const firstSentences = shuffleVocabulary(contextSentencesVocabulary, room.seed + 23).slice(0, 2);
    const secondWords = shuffleVocabulary(allVocabulary, room.seed + 37).slice(8, 16);
    const secondPhrases = shuffleVocabulary(collocationsVocabulary, room.seed + 51).slice(0, 3);
    const secondSentences = shuffleVocabulary(contextSentencesVocabulary, room.seed + 67).slice(0, 2);
    const sharedWords = [...firstWords, ...firstPhrases, ...firstSentences, ...secondWords, ...secondPhrases, ...secondSentences].slice(0, PVP_QUESTIONS);
    start(1, sharedWords);
  }, []);
  const pvpAction = async (action: 'match' | 'create' | 'join') => {
    if (!firebaseAuth.currentUser) {
      setPvpError('Hãy đăng nhập để tham gia PvP Rank.');
      return;
    }
    const name = (pvpName || playerName).trim();
    if (name.length < 2) {
      setPvpError('Hãy nhập tên có ít nhất 2 ký tự.');
      return;
    }
    setPvpError('');
    setPvpWaiting(true);
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const response = await fetch('/api/pvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, playerId: ensurePvpPlayer(), name, code: pvpCode, mode: pvpGameMode }),
      });
      const data = (await response.json()) as { room?: PvpRoom | null; profile?: PvpRank; error?: string };
      if (!response.ok) throw new Error(data.error || 'Không thể kết nối PvP.');
      localStorage.setItem('hanzibeat-player-name', name);
      setPlayerName(name);
      setPvpRoom(data.room ?? null);
      if (data.profile) setPvpRank(data.profile);
      if (data.room?.status === 'playing') beginPvpGame(data.room);
    } catch (error) {
      setPvpWaiting(false);
      setPvpError(error instanceof Error ? error.message : 'Không thể kết nối PvP.');
    }
  };
  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch(
        `/api/leaderboard?level=${leaderboardLevel}&mode=${leaderboardMode}`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Không tải được bảng xếp hạng');
      const data = (await response.json()) as { entries?: LeaderboardEntry[] };
      setLeaderboard(data.entries ?? []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [leaderboardLevel, leaderboardMode]);
  const openLeaderboard = () => {
    setLeaderboardLevel(selected);
    setLeaderboardMode(mode);
    navigate('leaderboard');
  };
  const submitScore = useCallback(async () => {
    const cleanName = (authUser?.name || playerName).trim();
    if (cleanName.length < 2 || scoreStatus === 'saving' || scoreStatus === 'saved') return;
    setScoreStatus('saving');
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          playerId: authUser?.id,
          level: selected,
          mode,
          score,
          correct,
        }),
      });
      if (!response.ok) throw new Error('Không lưu được điểm');
      localStorage.setItem('hanzibeat-player-name', cleanName);
      setScoreStatus('saved');
    } catch {
      setScoreStatus('error');
    }
  }, [authUser?.id, authUser?.name, playerName, scoreStatus, selected, mode, score, correct]);
  const runProgressionAction = async (action: 'buy-item' | 'equip-item' | 'open-chest' | 'upgrade-castle' | 'use-castle-item', itemId?: string) => {
    const user = firebaseAuth.currentUser;
    if (!user || rewardActionStatus === 'loading') return;
    setRewardActionStatus('loading');
    setRewardActionError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/progression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, itemId }),
      });
      const data = await response.json() as {
        progression?: Progression;
        chestReward?: { jade: number; xp: number; bonus: string | null };
        castleEffect?: { type: 'siege' | 'shield'; rewards?: { coins: number; wood: number; ink: number } };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Không thể thực hiện thao tác.');
      if (data.progression) setProgression(data.progression);
      if (data.chestReward) setChestReward(data.chestReward);
      if (data.castleEffect) {
        setCastleEffect(data.castleEffect);
        window.setTimeout(() => setCastleEffect(null), data.castleEffect.type === 'siege' ? 2800 : 2200);
      }
    } catch (error) {
      setRewardActionError(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.');
    } finally {
      setRewardActionStatus('idle');
    }
  };
  const runCastleSocial = useCallback(async (operation: 'list' | 'like' | 'visit' | 'theme' = 'list', targetId?: string, theme?: string) => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    setRewardActionError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/progression', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'castle-social', operation, targetId, theme, buildingsLayout: extraBuildings }) });
      const data = await response.json() as { progression?: Progression; castleSocial?: { season: string; castles: PublicCastle[]; visitors: CastleVisitor[] }; visitedCastle?: PublicCastle; error?: string };
      if (!response.ok) throw new Error(data.error || 'Không thể kết nối Hán Tự Thành.');
      if (data.progression) setProgression(data.progression);
      if (data.castleSocial) setCastleSocial(data.castleSocial);
      if (data.visitedCastle) {
        let layout = data.visitedCastle.buildingsLayout;
        // Another player's private Firestore tree is intentionally not
        // readable. Public castle layouts come from the authenticated API.
        const coreObstacles = [
          { id: 'main', col: 2, row: 2, w: 3, h: 3 },
          { id: 'library', col: 0, row: 0, w: 2, h: 2 },
          { id: 'listening', col: 6, row: 0, w: 2, h: 2 },
        ];
        const sanitized = sanitizeBuildingsLayout(layout || [], coreObstacles);
        setVisitedCastle({ ...data.visitedCastle, buildingsLayout: sanitized });
      }
    } catch (error) {
      setRewardActionError(error instanceof Error ? error.message : 'Không thể kết nối Hán Tự Thành.');
    }
  }, []);
  const runCastleCombat = useCallback(async (operation: 'logs' | 'peace' | 'start' | 'finish', payload: { targetId?: string; combatId?: string; correct?: number } = {}) => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    setRewardActionError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/progression', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'castle-combat', operation, ...payload }) });
      const data = await response.json() as { progression?: Progression; combatLogs?: CombatLog[]; combatSession?: { id: string; targetId: string; targetName: string }; combatResult?: CombatLog; error?: string };
      if (!response.ok) throw new Error(data.error || 'Không thể thực hiện Công Thành.');
      if (data.progression) setProgression(data.progression);
      if (data.combatLogs) setCombatLogs(data.combatLogs);
      if (data.combatResult) { setCombatResult(data.combatResult); setCombatQuiz(null); }
      if (data.combatSession) {
        const questions = [...allVocabulary].sort(() => Math.random() - .5).slice(0, 10);
        setCombatQuiz({ ...data.combatSession, questions, index: 0, correct: 0 });
      }
    } catch (error) { setRewardActionError(error instanceof Error ? error.message : 'Không thể thực hiện Công Thành.'); }
  }, []);
  const runCastleCommerce = useCallback(async (
    operation: 'list' | 'buy' | 'equip' | 'equip-decoration' | 'claim' | 'claim-pass' | 'topup',
    payload: { itemId?: string; packageId?: string; slot?: string; id?: string | null; theme?: string; tier?: number; premium?: boolean } = {},
  ) => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    setRewardActionError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/progression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'castle-commerce', operation, ...payload }),
      });
      const data = await response.json() as { progression?: Progression; error?: string };
      if (!response.ok) throw new Error(data.error || 'Không thể thực hiện giao dịch.');
      if (data.progression) setProgression(data.progression);
    } catch (error) {
      setRewardActionError(error instanceof Error ? error.message : 'Không thể thực hiện giao dịch.');
    }
  }, []);

  const startSepayTopup = async (packageId: string) => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setSepayError('Vui lòng đăng nhập tài khoản để nạp Linh Thạch.');
      return;
    }
    setSepayStatus('creating');
    setSepayError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/sepay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create-order', packageId }),
      });
      const data = (await res.json()) as { error?: string } & SepayOrderInfo;
      if (!res.ok || data.error) throw new Error(data.error || 'Không thể tạo đơn nạp.');
      setSepayOrder({
        orderCode: data.orderCode,
        amount: data.amount,
        crystals: data.crystals,
        packageName: data.packageName,
        bankAccount: data.bankAccount,
        bankName: data.bankName,
        accountName: data.accountName,
        qrUrl: data.qrUrl,
        vietqrUrl: data.vietqrUrl,
      });
      setSepayStatus('waiting');
    } catch (err) {
      setSepayStatus('error');
      setSepayError(err instanceof Error ? err.message : 'Lỗi kết nối tạo đơn nạp.');
    }
  };

  const checkSepayOrder = useCallback(async (orderCode: string) => {
    const user = firebaseAuth.currentUser;
    if (!user || !orderCode) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/sepay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'check-order', orderCode }),
      });
      const data = (await res.json()) as { status?: string; crystals?: number; newBalance?: number; error?: string };
      if (res.ok && data.status === 'completed') {
        setSepayStatus('completed');
        if (typeof data.newBalance === 'number') {
          setProgression((p) => p ? { ...p, dragonCrystals: data.newBalance! } : p);
        } else if (data.crystals) {
          setProgression((p) => p ? { ...p, dragonCrystals: (p.dragonCrystals ?? 0) + data.crystals! } : p);
        }
        playAnswerSound('correct');
      }
    } catch {
      // Background poll failure is silent
    }
  }, []);

  useEffect(() => {
    if (!topupOpen || sepayStatus !== 'waiting' || !sepayOrder?.orderCode) return;
    const timer = setInterval(() => {
      void checkSepayOrder(sepayOrder.orderCode);
    }, 3000);
    return () => clearInterval(timer);
  }, [topupOpen, sepayStatus, sepayOrder?.orderCode, checkSepayOrder]);

  const closeTopupModal = () => {
    setTopupOpen(false);
    setSepayOrder(null);
    setSepayStatus('idle');
    setSepayError('');
    setSepayCopied(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setSepayCopied(label);
    setTimeout(() => setSepayCopied(null), 2000);
  };

  const renderTopupModal = () => {
    if (!topupOpen) return null;
    return (
      <div className="topup-modal-backdrop" onClick={closeTopupModal}>
        <section
          className={`topup-modal ${sepayOrder ? 'sepay-checkout' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Tiệm Linh Thạch"
          onClick={(e) => e.stopPropagation()}
        >
          <header>
            <button className="close-btn" onClick={closeTopupModal}>×</button>
            {!sepayOrder && sepayStatus !== 'completed' && <img className="topup-title-crystal" src="/items/crystal.png" alt="" />}
            <span>晶石阁 · TIỆM LINH THẠCH</span>
            <h2>{sepayStatus === 'completed' ? 'Nạp Thành Công!' : sepayOrder ? 'Thanh Toán' : 'Nạp Linh Thạch'}</h2>
            {sepayStatus === 'completed' ? (
              <p>Linh Thạch đã được cộng vào tài khoản của bạn.</p>
            ) : !sepayOrder ? (
              <p>Mở khóa Theme Pack, Khí Tượng, Linh Thú và Long Vân Pass.</p>
            ) : null}
          </header>

          {sepayError && <div className="sepay-error-banner">{sepayError}</div>}

          {sepayStatus === 'completed' ? (
            <div className="sepay-success-pane">
              <div className="sepay-success-icon">🎉</div>
              <h3>Giao Dịch Đã Được Xác Nhận!</h3>
              <p>Bạn đã nhận được <b>+{sepayOrder?.crystals} Linh Thạch</b>.</p>
              <div className="sepay-new-balance">
                Số dư hiện tại: <b>🔮 {(progression?.dragonCrystals ?? 0).toLocaleString('vi-VN')} Linh Thạch</b>
              </div>
              <button className="sepay-success-close-btn" onClick={closeTopupModal}>
                Bắt Đầu Sử Dụng
              </button>
            </div>
          ) : sepayOrder && sepayStatus === 'waiting' ? (
            <div className="sepay-order-container">
              <div className="sepay-qr-column">
                <div className="sepay-qr-card">
                  <img
                    src={sepayOrder.qrUrl}
                    alt="Mã QR Chuyển Khoản MBBank"
                    className="sepay-qr-img"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = sepayOrder.vietqrUrl;
                    }}
                  />
                  <div className="sepay-qr-badge">VietQR · MBBank</div>
                </div>
                <small className="sepay-qr-hint">
                  Mở App Ngân hàng bất kỳ (MB, VCB, Techcombank, VPBank, Momo...) quét mã để tự động điền STK và nội dung.
                </small>
              </div>

              <div className="sepay-details-column">
                <div className="sepay-info-box">
                  <div className="sepay-info-row">
                    <span>Ngân hàng</span>
                    <b>{sepayOrder.bankName} (Quân Đội)</b>
                  </div>
                  <div className="sepay-info-row">
                    <span>Chủ tài khoản</span>
                    <b>{sepayOrder.accountName}</b>
                  </div>
                  <div className="sepay-info-row">
                    <span>Số tài khoản</span>
                    <div className="sepay-copy-group">
                      <b>{sepayOrder.bankAccount}</b>
                      <button
                        type="button"
                        className="sepay-copy-btn"
                        onClick={() => copyToClipboard(sepayOrder.bankAccount, 'account')}
                      >
                        {sepayCopied === 'account' ? '✓ Đã chép' : 'Sao chép'}
                      </button>
                    </div>
                  </div>
                  <div className="sepay-info-row">
                    <span>Số tiền cần nạp</span>
                    <div className="sepay-copy-group">
                      <b className="sepay-amount-highlight">{sepayOrder.amount.toLocaleString('vi-VN')}đ</b>
                      <button
                        type="button"
                        className="sepay-copy-btn"
                        onClick={() => copyToClipboard(String(sepayOrder.amount), 'amount')}
                      >
                        {sepayCopied === 'amount' ? '✓ Đã chép' : 'Sao chép'}
                      </button>
                    </div>
                  </div>
                  <div className="sepay-info-row sepay-content-row">
                    <span>Nội dung chuyển khoản</span>
                    <div className="sepay-copy-group">
                      <code className="sepay-code-val">{sepayOrder.orderCode}</code>
                      <button
                        type="button"
                        className="sepay-copy-btn sepay-copy-btn-primary"
                        onClick={() => copyToClipboard(sepayOrder.orderCode, 'content')}
                      >
                        {sepayCopied === 'content' ? '✓ Đã chép' : 'Sao chép mã'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sepay-warning-note">
                  ⚠️ <b>Lưu ý quan trọng:</b> Hãy ghi chính xác mã nội dung <u>{sepayOrder.orderCode}</u> khi chuyển khoản để hệ thống tự động cộng Linh Thạch ngay tức khắc.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="topup-grid">
                {[
                  { id: 'topup-60', name: 'Túi Linh Thạch', crystals: 60, price: '29.000đ', bonus: '', featured: false },
                  { id: 'topup-180', name: 'Hòm Linh Thạch', crystals: 180, price: '79.000đ', bonus: '+20 tặng thêm', featured: true },
                  { id: 'topup-450', name: 'Rương Linh Thạch', crystals: 450, price: '179.000đ', bonus: '+60 tặng thêm', featured: false },
                ].map((pack) => (
                  <article key={pack.id} className={`topup-card ${pack.featured ? 'featured' : ''}`}>
                    {pack.featured && <span className="topup-popular">PHỔ BIẾN</span>}
                    <img src="/items/crystal.png" alt="" />
                    <h4>{pack.name}</h4>
                    <b className="crystals">{pack.crystals} <small>晶石</small></b>
                    <span className="topup-bonus">{pack.bonus || 'Gói tiêu chuẩn'}</span>
                    <button
                      disabled={sepayStatus === 'creating'}
                      onClick={() => void startSepayTopup(pack.id)}
                    >
                      {sepayStatus === 'creating' ? 'Đang tạo đơn...' : pack.price}
                    </button>
                  </article>
                ))}
              </div>
              <div className="topup-policy-note">
                🔮 Linh Thạch chỉ dùng cho cosmetic, tiện ích không tăng sức mạnh và Battle Pass. Không thể đổi sang Mảnh Ngọc, XP, Rank hay tài nguyên xây dựng.
              </div>
            </>
          )}
        </section>
      </div>
    );
  };
  const answerCombatQuestion = (answer: string) => {
    if (!combatQuiz) return;
    const isCorrect = answer === combatQuiz.questions[combatQuiz.index][3];
    const nextCorrect = combatQuiz.correct + (isCorrect ? 1 : 0);
    if (combatQuiz.index >= 9) { void runCastleCombat('finish', { combatId: combatQuiz.id, correct: nextCorrect }); return; }
    setCombatQuiz({ ...combatQuiz, index: combatQuiz.index + 1, correct: nextCorrect });
  };
  useEffect(() => {
    if (screen === 'castle' && authUser) { void runCastleSocial(); void runCastleCombat('logs'); }
  }, [screen, authUser, runCastleSocial, runCastleCombat]);
  const openPvp = () => {
    setPvpRoom(null);
    setPvpWaiting(false);
    setPvpError('');
    pvpStarted.current = false;
    navigate('pvp');
  };
  const mobileNavigation = (
    <nav className="mobile-nav" aria-label="Điều hướng điện thoại">
      <button className={screen === 'home' ? 'on' : ''} onClick={() => navigate('home')}>
        <Sparkles /><span>Trang chủ</span>
      </button>
      <button className={screen === 'dictionary' ? 'on' : ''} onClick={() => navigate('dictionary')}>
        <BookOpen /><span>Từ vựng</span>
      </button>
      <button className={screen === 'leaderboard' ? 'on' : ''} onClick={openLeaderboard}>
        <Trophy /><span>Xếp hạng</span>
      </button>
      <button className={screen === 'pvp' ? 'on' : ''} onClick={openPvp}>
        <span className="mobile-vs">VS</span><span>PvP</span>
      </button>
    </nav>
  );
  const pvpLiveScoreboard = pvpRoom && authUser ? (() => {
    const me = pvpRoom.host.id === authUser.id ? pvpRoom.host : pvpRoom.guest;
    const rival = pvpRoom.host.id === authUser.id ? pvpRoom.guest : pvpRoom.host;
    const myScore = Math.max(score, Number(me?.liveScore ?? 0));
    return <aside className="pvp-live-score" aria-label="Điểm trực tiếp PvP"><header><span>实时比分</span></header><div className="pvp-live-player me"><i>{me?.name.slice(0, 1).toUpperCase()}</i><span><small>BẠN · {me?.name}</small><b>{myScore.toLocaleString('vi-VN')}</b><em>{Math.max(correct, Number(me?.liveCorrect ?? 0))}/25 đúng</em></span></div><div className="pvp-live-vs">VS</div><div className="pvp-live-player"><i>{rival?.name.slice(0, 1).toUpperCase() ?? '?'}</i><span><small>ĐỐI THỦ · {rival?.name ?? 'Đang kết nối'}</small><b>{Number(rival?.liveScore ?? 0).toLocaleString('vi-VN')}</b><em>{Number(rival?.liveCorrect ?? 0)}/25 đúng</em></span></div></aside>;
  })() : null;
  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (authStatus === 'loading') return;
    setAuthStatus('loading');
    setAuthError('');
    try {
      const credential = authMode === 'register'
        ? await createUserWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword)
        : await signInWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
      if (authMode === 'register') {
        await updateProfile(credential.user, { displayName: authName.trim() });
      }
      const name = authMode === 'register'
        ? authName.trim()
        : credential.user.displayName || credential.user.email?.split('@')[0] || 'Người chơi';
      const user = { id: credential.user.uid, name, email: credential.user.email || authEmail.trim() };
      setAuthUser(user);
      setPlayerName(name);
      setPvpName(name);
      setAuthPassword('');
      setAuthStatus('idle');
      navigate('home');
    } catch (error) {
      setAuthStatus('error');
      const code = (error as { code?: string }).code;
      setAuthError(
        code === 'auth/email-already-in-use'
          ? 'Email này đã được đăng ký.'
          : code === 'auth/invalid-credential'
            ? 'Email hoặc mật khẩu không đúng.'
            : code === 'auth/operation-not-allowed'
              ? 'Firebase chưa bật đăng nhập Email/Password.'
              : code === 'auth/weak-password'
                ? 'Mật khẩu chưa đủ mạnh.'
                : 'Không thể xác thực tài khoản. Hãy thử lại.',
      );
    }
  };
  const logout = async () => {
    await signOut(firebaseAuth);
    setAuthUser(null);
  };
  useEffect(() => {
    const savedName = localStorage.getItem('hanzibeat-player-name');
    if (savedName) {
      setPlayerName(savedName);
      setPvpName(savedName);
    }
    ensurePvpPlayer();
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (!firebaseUser) {
        setAuthUser(null);
        setProgression(null);
        return;
      }
      const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Người chơi';
      setAuthUser({ id: firebaseUser.uid, name, email: firebaseUser.email || '' });
      setPlayerName(name);
      setPvpName(name);
      void firebaseUser.getIdToken().then((token) => fetch('/api/progression', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      })).then(async (response) => response.ok
        ? await response.json() as { progression?: Progression }
        : null)
        .then((data) => setProgression(data?.progression ?? null))
        .catch(() => setProgression(null));
      const userRef = doc(firebaseDb, 'users', firebaseUser.uid);
      void getDoc(userRef).then((snapshot) => {
        const data = snapshot.data();
        if (typeof data?.volume === 'number') setVolume(data.volume);
        if (data?.preferredMode === 'audition' || data?.preferredMode === 'typing') {
          setMode(data.preferredMode);
        }
      }).catch(() => undefined);
      void setDoc(userRef, {
        name,
        email: firebaseUser.email || '',
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => undefined);
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!authUser) return;
    const timer = window.setTimeout(() => {
      void setDoc(doc(firebaseDb, 'users', authUser.id), {
        volume,
        preferredMode: mode,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [authUser?.id, volume, mode]);
  useEffect(() => {
    if (screen !== 'result' || !authUser || cloudMatchSaved.current) return;
    cloudMatchSaved.current = true;
    const match = {
      score,
      correct,
      totalWords: vocab.length,
      mode,
      hskLevel: selected + 1,
      dailyChallenge,
      pvp: Boolean(pvpRoom),
      roomCode: pvpRoom?.code ?? null,
      createdAt: serverTimestamp(),
    };
    const userRef = doc(firebaseDb, 'users', authUser.id);
    void addDoc(collection(userRef, 'matches'), match).catch(() => undefined);
    void runTransaction(firebaseDb, async (transaction) => {
      const snapshot = await transaction.get(userRef);
      const current = snapshot.data() ?? {};
      const bestScores = { ...(current.bestScores ?? {}) } as Record<string, number>;
      const scoreKey = dailyChallenge ? `daily-${mode}` : `hsk${selected + 1}-${mode}`;
      bestScores[scoreKey] = Math.max(Number(bestScores[scoreKey] ?? 0), score);
      transaction.set(userRef, {
        name: authUser.name,
        email: authUser.email,
        totalMatches: Number(current.totalMatches ?? 0) + 1,
        totalCorrect: Number(current.totalCorrect ?? 0) + correct,
        bestScores,
        lastPlayedAt: serverTimestamp(),
      }, { merge: true });
    }).catch(() => undefined);
  }, [screen, authUser?.id, score, correct, mode, selected, dailyChallenge, pvpRoom?.code, vocab.length]);
  useEffect(() => {
    if (screen !== 'result' || !authUser || !rewardSessionId.current) return;
    const sessionId = rewardSessionId.current;
    rewardSessionId.current = '';
    void firebaseAuth.currentUser?.getIdToken().then((token) => fetch('/api/progression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'finish-match', sessionId, correct, score, encountered: vocab.map((entry) => entry[0]) }),
    })).then(async (response) => response.ok
      ? await response.json() as { progression?: Progression; reward?: { xp: number; jade: number; baseJade?: number; castleBonusJade?: number; castleBonusRate?: number; spins?: number; wood: number; ink: number } }
      : null)
      .then((data) => {
        if (data?.progression) setProgression(data.progression);
        if (data?.reward) setLastReward(data.reward);
      }).catch(() => undefined);
  }, [screen, authUser?.id, correct, score, vocab]);
  useEffect(() => {
    if (
      screen === 'result' &&
      authUser &&
      !pvpRoom &&
      !dailyChallenge &&
      scoreStatus === 'idle'
    ) {
      void submitScore();
    }
  }, [screen, authUser?.id, pvpRoom?.code, dailyChallenge, scoreStatus, submitScore]);
  useEffect(() => {
    const targetInitialScreen = initialScreen ?? screenFromPath(window.location.pathname);
    if (targetInitialScreen !== screen) animateScreenChange(() => setScreen(targetInitialScreen));
    window.history.replaceState({ hanzibeatScreen: targetInitialScreen }, '', screenPaths[targetInitialScreen]);
    const handleHistory = (event: PopStateEvent) => {
      const previousScreen = (event.state?.hanzibeatScreen as Screen | undefined) ?? screenFromPath(window.location.pathname);
      animateScreenChange(() => setScreen(previousScreen));
    };
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, [animateScreenChange, initialScreen]);
  useEffect(() => {
    if (!playModeOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPlayModeOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [playModeOpen]);
  useEffect(() => {
    if (screen === 'leaderboard') void loadLeaderboard();
  }, [screen, loadLeaderboard]);
  useEffect(() => {
    if (screen !== 'pvp' || !firebaseAuth.currentUser) return;
    void firebaseAuth.currentUser.getIdToken().then((token) => fetch('/api/pvp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'profile' }) }))
      .then((response) => response.ok ? response.json() as Promise<{ profile?: PvpRank }> : null)
      .then((data) => data?.profile && setPvpRank(data.profile)).catch(() => undefined);
  }, [screen, authUser?.id]);
  useEffect(() => {
    if (screen !== 'pvp' || (!pvpWaiting && !pvpRoom)) return;
    const timer = window.setInterval(async () => {
      try {
        const query = pvpRoom?.code
          ? `code=${pvpRoom.code}`
          : `playerId=${authUser?.id ?? ''}`;
        const response = await fetch(`/api/pvp?${query}`, { cache: 'no-store' });
        const data = (await response.json()) as { room?: PvpRoom | null };
        if (data.room) {
          setPvpRoom(data.room);
          if (data.room.status === 'playing') beginPvpGame(data.room);
        }
      } catch { /* retry on next poll */ }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [screen, pvpWaiting, pvpRoom?.code, beginPvpGame, authUser?.id]);
  useEffect(() => {
    if (screen !== 'result' || !pvpRoom || pvpScoreSent.current) return;
    pvpScoreSent.current = true;
    void firebaseAuth.currentUser?.getIdToken().then((token) => fetch('/api/pvp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'score', code: pvpRoom.code, score, correct }),
    })).then((response) => response?.json() as Promise<{ room?: PvpRoom; profile?: PvpRank; error?: string }>).then((data) => { if (data?.room) setPvpRoom(data.room); if (data?.profile) setPvpRank(data.profile); if (data?.error) setPvpError(data.error); });
  }, [screen, pvpRoom?.code, score, correct]);
  useEffect(() => {
    if (screen !== 'game' || !pvpRoom?.code || !firebaseAuth.currentUser) return;
    const timer = window.setTimeout(() => {
      void firebaseAuth.currentUser?.getIdToken().then((token) => fetch('/api/pvp', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'progress', code: pvpRoom.code, score, correct }),
      })).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [screen, pvpRoom?.code, score, correct]);
  useEffect(() => {
    if (screen !== 'game' || !pvpRoom?.code) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/pvp?code=${pvpRoom.code}`, { cache: 'no-store' }).then((response) => response.json() as Promise<{ room?: PvpRoom }>).then((data) => data.room && setPvpRoom(data.room)).catch(() => undefined);
    }, 900);
    return () => window.clearInterval(timer);
  }, [screen, pvpRoom?.code]);
  useEffect(() => {
    if (screen !== 'result' || !pvpRoom || pvpRoom.status === 'finished') return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/pvp?code=${pvpRoom.code}`, { cache: 'no-store' });
      const data = (await response.json()) as { room?: PvpRoom | null };
      if (data.room) setPvpRoom(data.room);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [screen, pvpRoom?.code, pvpRoom?.status]);
  useEffect(() => {
    if (screen !== 'result' || !authUser || pvpRoom?.status !== 'finished' || pvpHistorySaved.current) return;
    const self = pvpRoom.host.id === authUser.id ? pvpRoom.host : pvpRoom.guest;
    const opponent = pvpRoom.host.id === authUser.id ? pvpRoom.guest : pvpRoom.host;
    if (!self || !opponent) return;
    pvpHistorySaved.current = true;
    void firebaseAuth.currentUser?.getIdToken().then((token) => fetch('/api/progression', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }))
      .then((response) => response?.ok ? response.json() as Promise<{ progression?: Progression }> : null)
      .then((data) => data?.progression && setProgression(data.progression)).catch(() => undefined);
    const outcome = self.score === opponent.score ? 'draw' : Number(self.score) > Number(opponent.score) ? 'win' : 'loss';
    void addDoc(collection(doc(firebaseDb, 'users', authUser.id), 'pvpMatches'), {
      roomCode: pvpRoom.code, season: pvpRank?.season ?? null, mode: pvpRoom.mode,
      opponentId: opponent.id, opponentName: opponent.name, score: self.score, opponentScore: opponent.score,
      correct: self.correct, opponentCorrect: opponent.correct, outcome,
      mmrChange: pvpRoom.rankChanges?.[authUser.id] ?? 0, integrity: pvpRoom.integrity ?? null,
      startedAt: pvpRoom.startedAt ? new Date(pvpRoom.startedAt) : null,
      completedAt: serverTimestamp(),
    }).catch(() => { pvpHistorySaved.current = false; });
  }, [screen, authUser?.id, pvpRoom?.status, pvpRoom?.code, pvpRank?.season]);
  const nextTypingWord = useCallback(() => {
    if (round >= vocab.length) {
      setProgress(100);
      navigate('result');
      return;
    }
    if (round === directionSplit && !directionBreakDone) {
      setDirectionBreakDone(true);
      setDirectionCountdown(10);
      setTypingLocked(true);
      return;
    }
    setWord((w) => (w + 1) % vocab.length);
    setRound((r) => r + 1);
    setProgress((round / vocab.length) * 100);
    setTypingInput('');
    setTypingTime(getDifficultyTime(difficultyTab));
    setTypingFeedback('NHẬP ĐÁP ÁN');
    setTypingLocked(false);
  }, [round, vocab.length, directionBreakDone, difficultyTab, directionSplit]);
  const triggerCosmeticEffect = useCallback(() => {
    const effect = progression?.equipped.effect;
    if (!effect) return;
    setCosmeticEffect(null);
    window.requestAnimationFrame(() => setCosmeticEffect(effect));
    window.setTimeout(() => setCosmeticEffect(null), 750);
  }, [progression?.equipped.effect]);
  const submitTyping = (event: FormEvent) => {
    event.preventDefault();
    if (typingLocked || !typingInput.trim()) return;
    setTypingLocked(true);
    const typingToHanzi = round > directionSplit;
    const target = vocab[word][typingToHanzi ? 0 : 3];
    const normalizedInput = normalizeAnswer(typingInput);
    const acceptedAnswers = typingToHanzi
      ? [
          normalizeAnswer(target),
          normalizeAnswer(vocab[word][1]),
          normalizeAnswer(vocab[word][2]),
        ].filter(Boolean)
      : target
          .replace(/\([^)]*\)/g, '')
          .split(/[,;/]/)
          .map(normalizeAnswer)
          .filter(Boolean);
    const isCorrect =
      normalizedInput === normalizeAnswer(target) ||
      acceptedAnswers.includes(normalizedInput);
    if (isCorrect) {
      playAnswerSound('correct');
      triggerCosmeticEffect();
      const nextCombo = combo + 1;
      const speedBonus = typingTime * 70;
      const chainBonus = Math.min(nextCombo, 10) * 100;
      setScore((s) => s + 700 + speedBonus + chainBonus);
      setCombo(nextCombo);
      setCorrect((c) => c + 1);
      setTypingFeedback(
        nextCombo >= 3 ? `PERFECT ×${nextCombo}` : 'CHÍNH XÁC!',
      );
    } else {
      playAnswerSound('wrong');
      setCombo(0);
      setTypingFeedback(`ĐÁP ÁN: ${target}`);
    }
    setTimeout(nextTypingWord, 800);
  };
  const chooseAnswer = useCallback(
    (answer: string) => {
      if (phase !== 'answer') return;
      const target = vocab[word][round <= directionSplit ? 3 : 0];
      if (answer === target) {
        playAnswerSound('correct');
        triggerCosmeticEffect();
        const nextCombo = combo + 1;
        setCorrect((c) => c + 1);
        setScore((s) => s + 600 + roundTime * 50 + Math.min(nextCombo, 10) * 50);
        setCombo(nextCombo);
        setJudgment('CHÍNH XÁC!');
        setPhase('sequence');
        setTimeout(makeRound, 650);
      } else {
        playAnswerSound('wrong');
        setCombo(0);
        setJudgment(`ĐÁP ÁN: ${target}`);
        setPhase('sequence');
        setTimeout(makeRound, 850);
      }
    },
    [phase, word, round, combo, roundTime, makeRound, triggerCosmeticEffect],
  );
  const pressArrow = useCallback(
    (lane: number) => {
      if (screen !== 'game' || phase !== 'sequence') return;
      setActive(lane);
      setTimeout(() => setActive(-1), 120);
      const expected = sequence[entered.length];
      if (lane === expected) {
        const next = [...entered, lane];
        setEntered(next);
        if (next.length === sequence.length) {
          setPhase('beat');
          setJudgment('SPACE!');
        }
      } else {
        setEntered([]);
        setCombo(0);
        setJudgment('THỬ LẠI!');
      }
    },
    [screen, phase, sequence, entered],
  );
  const hitBeat = useCallback(() => {
    if (phase !== 'beat') return;
    const distance = Math.abs(50 - beat);
    const result = distance < 9 ? 'PERFECT' : distance < 18 ? 'GREAT' : 'GOOD';
    const points = distance < 9 ? 1500 : distance < 18 ? 1000 : 600;
    setJudgment(result);
    setScore((s) => s + points + combo * 25);
    setCombo((c) => c + 1);
    setTimeout(makeRound, 500);
  }, [phase, beat, combo, makeRound]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'game') return;
      if (mode !== 'audition') return;
      if (
        phase === 'answer' &&
        ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)
      ) {
        chooseAnswer(options[Number(e.code.slice(-1)) - 1]);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [screen, mode, phase, options, chooseAnswer]);
  useEffect(() => {
    if (screen !== 'game') return;
    const started = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - started;
      setBeat((elapsed / 12) % 100);
    }, 50);
    return () => clearInterval(t);
  }, [screen]);
  useEffect(() => {
    if (screen !== 'game' || mode !== 'audition' || phase !== 'answer') return;
    const t = setInterval(
      () =>
        setRoundTime((v) => {
          if (v <= 1) {
            setPhase('sequence');
            setCombo(0);
            setJudgment('TIME OUT');
            setTimeout(makeRound, 650);
            return getDifficultyTime(difficultyTab);
          }
          return v - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [screen, mode, phase, makeRound, difficultyTab]);
  useEffect(() => {
    if (screen !== 'game' || mode !== 'typing' || typingLocked) return;
    const t = setInterval(
      () =>
        setTypingTime((value) => {
          if (value <= 1) {
            setTypingLocked(true);
            setCombo(0);
            setTypingFeedback('HẾT GIỜ!');
            setTimeout(nextTypingWord, 650);
            return 0;
          }
          return value - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [screen, mode, typingLocked, nextTypingWord]);
  useEffect(() => {
    if (screen !== 'game' || directionCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      if (directionCountdown > 1) {
        setDirectionCountdown((value) => value - 1);
        return;
      }
      setDirectionCountdown(0);
      if (mode === 'typing') nextTypingWord();
      else makeRound();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [screen, mode, directionCountdown, nextTypingWord, makeRound]);
  useEffect(() => {
    if (screen !== 'game' || mode !== 'typing' || typingLocked) return;
    const frame = requestAnimationFrame(() => {
      typingInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, mode, word, typingLocked]);
  const refreshAudioTracks = useCallback(async () => {
    try {
      setAudioTracks(await getAudioTracks());
    } catch {
      setAudioTracks([]);
    }
  }, []);
  useEffect(() => {
    void refreshAudioTracks();
    const savedVolume = Number(localStorage.getItem('hanzi-beat-volume'));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1)
      setVolume(savedVolume);
    return () => {
      audioPlayer.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, [refreshAudioTracks]);
  useEffect(() => {
    if (audioPlayer.current) audioPlayer.current.volume = volume;
    localStorage.setItem('hanzi-beat-volume', String(volume));
  }, [volume]);
  useEffect(() => {
    if (screen !== 'game') audioPlayer.current?.pause();
  }, [screen]);
  const uploadAudio = async (files: FileList | null) => {
    if (!files?.length) return;
    await saveAudioFiles(
      Array.from(files).filter((file) => file.type.startsWith('audio/')),
    );
    await refreshAudioTracks();
  };
  const removeAudio = async (id: string) => {
    await deleteAudioTrack(id);
    await refreshAudioTracks();
  };
  const previewAudio = (track: AudioTrack) => {
    audioPlayer.current?.pause();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = URL.createObjectURL(track.blob);
    const player = new Audio(audioUrl.current);
    player.volume = volume;
    audioPlayer.current = player;
    setCurrentTrackName(track.name);
    void player.play().catch(() => undefined);
  };
  useEffect(() => {
    const controller = new AbortController();
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    try {
      context.registerTool(
        {
          name: 'start_rhythm_song',
          title: 'Bắt đầu bài hát',
          description: 'Chọn và bắt đầu một bài hát trong Hanzi Beat.',
          inputSchema: {
            type: 'object',
            properties: {
              songIndex: { type: 'integer', minimum: 0, maximum: 2 },
            },
            required: ['songIndex'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input: unknown) => {
            const i = (input as { songIndex: number }).songIndex;
            if (!Number.isInteger(i) || i < 0 || i >= songs.length)
              throw new Error('songIndex không hợp lệ');
            setSelected(i);
            setScore(0);
            setCombo(0);
            setProgress(0);
            navigate('game');
            return { status: 'started', song: songs[i][1] };
          },
        },
        { signal: controller.signal },
      );
    } catch {
      /* Browser chưa hỗ trợ WebMCP. */
    }
    return () => controller.abort();
  }, []);
  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.82;
    speechSynthesis.speak(utterance);
  };

  if (screen === 'game' && mode === 'typing')
    return (
      <main className="game typing-battle">
        {cosmeticEffect && <div className={`cosmetic-answer-effect ${cosmeticEffect}`} aria-hidden="true"><img src={cosmeticEffect === 'effect-golden' ? '/items/shop-effect-golden.png' : '/items/shop-effect-jade.png'} alt="" /></div>}
        {pvpLiveScoreboard}
        <div className="hud">
          {historyControls}
          <button onClick={() => navigate('songs')}>EXIT</button>
          <div>
            <small>SCORE</small>
            <b>{score.toLocaleString()}</b>
          </div>
          <div className="now">
            <b>TYPING BATTLE · {activePackInfo?.title ?? songs[selected][0]}</b>
            <small>♪ {currentTrackName} · 02:30</small>
            <button className={`sound-toggle ${audioStatus}`} onClick={toggleAudio}>
              {audioStatus === 'playing' ? <Volume2 /> : <VolumeX />}
              {audioStatus === 'playing'
                ? 'Tắt nhạc'
                : audioStatus === 'loading'
                  ? 'Đang tải…'
                  : 'Bật nhạc'}
            </button>
          </div>
          <div>
            <small>PERFECT CHAIN</small>
            <b>×{combo}</b>
          </div>
        </div>
        <div className="bar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="typing-bg">
          <span>你</span>
          <span>汉</span>
          <span>语</span>
          <span>♪</span>
        </div>
        {directionCountdown > 0 && (
          <div className="direction-transition" role="status" aria-live="assertive">
            <span>第二回合 · HIỆP 2</span>
            <h2>Chuyển sang Việt → Trung</h2>
            <b>{directionCountdown}</b>
            <p>Chuẩn bị nhập chữ Hán</p>
          </div>
        )}
        <section className="typing-stage">
          <div className="typing-round">
            <span>CÂU {round}</span>
            <b>{typingTime}s</b>
          </div>
          <article className={`typing-card ${typingLocked ? 'locked' : ''}`}>
            <span className="typing-label">
              {round > directionSplit ? 'NHẬP CHỮ HÁN' : 'NHẬP NGHĨA TIẾNG VIỆT'}
            </span>
            <button className="pronounce" onClick={() => speak(vocab[word][0])}>
              <Volume2 /> Nghe phát âm
            </button>
            <h1>{round > directionSplit ? vocab[word][3] : vocab[word][0]}</h1>
            <p>{round > directionSplit ? 'Dịch sang tiếng Trung' : vocab[word][1]}</p>
            <div
              className="time-ring"
              style={
                { '--time': `${(typingTime / getDifficultyTime(difficultyTab)) * 360}deg` } as CSSProperties
              }
            >
              <span>{typingTime}</span>
            </div>
            <form onSubmit={submitTyping}>
              <input
                ref={typingInputRef}
                autoFocus
                value={typingInput}
                onChange={(event) => setTypingInput(event.target.value)}
                placeholder={
                  round > directionSplit ? 'Ví dụ: 你好' : 'Ví dụ: xin chào'
                }
                disabled={typingLocked}
                autoComplete="off"
                spellCheck={false}
              />
              <button disabled={typingLocked || !typingInput.trim()}>
                TRẢ LỜI <kbd>Enter</kbd>
              </button>
            </form>
            <strong
              className={`typing-feedback ${typingFeedback.startsWith('PERFECT') ? 'perfect' : ''}`}
            >
              {typingFeedback}
            </strong>
            <small>
              Đúng càng nhanh, điểm càng cao · Chuỗi đúng liên tục tăng hệ số
            </small>
          </article>
          <aside className="chain-card">
            <Flame />
            <span>PERFECT CHAIN</span>
            <b>×{combo}</b>
            <p>
              {combo < 3
                ? 'Trả lời đúng liên tục để kích hoạt!'
                : combo < 7
                  ? 'Chuỗi đang cháy — giữ vững!'
                  : 'MAX FEVER BONUS!'}
            </p>
          </aside>
          <aside className="typing-score">
            <span>TỪ ĐÚNG</span>
            <b>{correct}</b>
            <small>
              +{700 + typingTime * 70 + Math.min(combo + 1, 10) * 100} điểm nếu
              đúng
            </small>
          </aside>
        </section>
      </main>
    );

  if (screen === 'game')
    return (
      <main className="game audition">
        {cosmeticEffect && <div className={`cosmetic-answer-effect ${cosmeticEffect}`} aria-hidden="true"><img src={cosmeticEffect === 'effect-golden' ? '/items/shop-effect-golden.png' : '/items/shop-effect-jade.png'} alt="" /></div>}
        {pvpLiveScoreboard}
        <div className="hud">
          {historyControls}
          <button onClick={() => navigate('songs')}>EXIT</button>
          <div>
            <small>SCORE</small>
            <b>{score.toLocaleString()}</b>
          </div>
          <div className="now">
            <b>{activePackInfo?.title ?? songs[selected][0]}</b>
            <small>
              ♪ {currentTrackName} · {activePackInfo?.bpm ?? songs[selected][2]} BPM · 02:30
            </small>
            <button className={`sound-toggle ${audioStatus}`} onClick={toggleAudio}>
              {audioStatus === 'playing' ? <Volume2 /> : <VolumeX />}
              {audioStatus === 'playing'
                ? 'Tắt nhạc'
                : audioStatus === 'loading'
                  ? 'Đang tải…'
                  : 'Bật nhạc'}
            </button>
          </div>
          <div>
            <small>COMBO</small>
            <b>{combo}</b>
          </div>
        </div>
        <div className="bar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="dance-bg">
          <div className="spotlight left" />
          <div className="spotlight right" />
          <div className="crowd" />
        </div>
        {directionCountdown > 0 && (
          <div className="direction-transition" role="status" aria-live="assertive">
            <span>第二回合 · HIỆP 2</span>
            <h2>Chuyển sang Việt → Trung</h2>
            <b>{directionCountdown}</b>
            <p>Chuẩn bị chọn chữ Hán</p>
          </div>
        )}
        <section className="audition-stage">
          <div className="round-info">
            <span>ROUND {round}</span>
            <b>{roundTime}s</b>
          </div>
          <article className="quiz-card">
            <span>
              {round <= directionSplit ? 'CHỌN NGHĨA TIẾNG VIỆT' : 'CHỌN CHỮ HÁN'}
            </span>
            <h1>{round <= directionSplit ? vocab[word][0] : vocab[word][3]}</h1>
            <p>{round <= directionSplit ? vocab[word][1] : 'Từ nào có nghĩa như trên?'}</p>
            {phase === 'answer' ? (
              <div className="answer-options">
                {options.map((o, i) => (
                  <button key={o} onClick={() => chooseAnswer(o)}>
                    <kbd>{i + 1}</kbd>
                    {o}
                  </button>
                ))}
              </div>
            ) : (
              <div className="answer-reveal">
                <b>{judgment}</b>
                <span>{vocab[word][0]} · {vocab[word][1]} · {vocab[word][3]}</span>
              </div>
            )}
          </article>
          <div className="learning-hint">
            <strong>{judgment}</strong>
            <p>Chọn đáp án bằng cách chạm hoặc nhấn phím 1 · 2 · 3 · 4</p>
          </div>
        </section>
        <aside className="audition-side">
          <span>VOCAB HIT</span>
          <b>{correct}</b>
          <small>/ {round} từ</small>
          <button onClick={() => speak(vocab[word][1])}>
            <Volume2 /> Phát âm
          </button>
        </aside>
      </main>
    );
  if (screen === 'result')
    return (
      <main className="result">
        {historyControls}
        <section>
          <span className="eyebrow">
            {mode === 'typing' ? 'TYPING BATTLE COMPLETE!' : 'RHYTHM QUIZ COMPLETE!'}
          </span>
          <div className="rank">A</div>
          <h1>{dailyChallenge ? '每日挑战' : (activePackInfo?.title ?? songs[selected][0])}</h1>
          <p>{dailyChallenge ? 'Daily Challenge · HSK 1–9' : (activePackInfo?.subtitle ?? songs[selected][1])}</p>
          <b className="final">{score.toLocaleString()}</b>
          <div className="stats">
            <span>
              <b>{round}</b>Lượt
            </span>
            <span>
              <b>{correct}</b>Từ đúng
            </span>
            <span>
              <b>{combo}</b>Combo
            </span>
            <span>
              <b>{Math.round((correct / Math.max(1, round)) * 100)}%</b>Chính
              xác
            </span>
          </div>
          {lastReward && (
            <div className="match-reward">
              <small className="reward-label">奖励 · PHẦN THƯỞNG</small>
              <span className="reward-chip reward-xp"><i>XP</i><b>×{lastReward.xp}</b></span>
              {lastReward.jade > 0 && <span className="reward-chip"><img src="/items/jade-fragment.png" alt="Mảnh Ngọc"/><b>×{lastReward.jade}</b></span>}
              {(lastReward.wood ?? 0) > 0 && <span className="reward-chip"><img src="/items/spin-wood.png" alt="Gỗ"/><b>×{lastReward.wood}</b></span>}
              {(lastReward.ink ?? 0) > 0 && <span className="reward-chip"><img src="/items/spin-ink.png" alt="Mực"/><b>×{lastReward.ink}</b></span>}
              {(lastReward.spins ?? 0) > 0 && <span className="reward-chip"><img src="/items/spin-refund.png" alt="Spin"/><b>×{lastReward.spins}</b></span>}
            </div>
          )}
          {pvpRoom && (() => {
            const me = pvpRoom.host.id === authUser?.id ? pvpRoom.host : pvpRoom.guest;
            const rival = pvpRoom.host.id === authUser?.id ? pvpRoom.guest : pvpRoom.host;
            const finished = pvpRoom.status === 'finished' && me?.score !== null && rival?.score !== null;
            const outcome = finished ? (me!.score! > rival!.score! ? 'CHIẾN THẮNG!' : me!.score! < rival!.score! ? 'THUA CUỘC' : 'HÒA!') : 'Đang chờ đối thủ hoàn thành...';
            const delta = pvpRoom.rankChanges?.[authUser?.id ?? ''] ?? 0;
            const castleRate = mainCastleJadeBonusRates[progression?.castle.buildings.main ?? 1] ?? 10;
            return <div className="pvp-result"><span>PVP RANK · PHÒNG {pvpRoom.code}</span><h2>{outcome}</h2><div><b>{me?.name}<small>{me?.score?.toLocaleString() ?? score.toLocaleString()}</small></b><i>VS</i><b>{rival?.name ?? 'Đối thủ'}<small>{rival?.score?.toLocaleString() ?? 'Đang chơi'}</small></b></div>{finished && <div className={`rank-verdict ${pvpRoom.integrity?.valid ? 'valid' : 'invalid'}`}><b>{pvpRoom.integrity?.rankedEligible ? `${delta >= 0 ? '+' : ''}${delta} MMR` : 'Không tính Rank'}</b><span>{pvpRoom.integrity?.rewardEligible ? `+3 玉片 · +8 XP${castleRate > 0 ? ` · Nhà Chính +${castleRate}%` : ''}` : pvpRoom.integrity?.reason ?? 'Đã đạt giới hạn thưởng cùng đối thủ'}</span></div>}</div>;
          })()}
          {!pvpRoom && <div className="score-submit">
            <input
              value={playerName}
              onChange={(event) => {
                setPlayerName(event.target.value);
                if (scoreStatus === 'error') setScoreStatus('idle');
              }}
              maxLength={20}
              placeholder="Tên người chơi"
              aria-label="Tên người chơi"
            />
            <button onClick={submitScore} disabled={scoreStatus === 'saving' || scoreStatus === 'saved'}>
              <Trophy />
              {scoreStatus === 'saving'
                ? 'Đang lưu...'
                : scoreStatus === 'saved'
                  ? 'Đã lên hạng'
                  : 'Đăng điểm'}
            </button>
          </div>}
          {!pvpRoom && scoreStatus === 'error' && <p className="score-error">Không thể đăng điểm. Hãy thử lại.</p>}
          {((lastReward?.wood ?? 0) > 0 || (lastReward?.ink ?? 0) > 0) && (
            <div className="result-castle-hint">
              <span>🔨 Nhận được vật liệu xây thành! Ghé thăm <b>Hán Tự Thành</b> để xây dựng & nâng cấp.</span>
              <button type="button" onClick={() => navigate('castle')}>Đến Thành Trì →</button>
            </div>
          )}
          <div className="actions">
            <button onClick={() => start()}>
              <Play /> Chơi lại
            </button>
            <button onClick={() => navigate('dictionary')}>
              <BookOpen /> Ôn từ
            </button>
            <button onClick={openLeaderboard}>
              <Trophy /> Xếp hạng
            </button>
            <button onClick={() => navigate('home')}>Về menu</button>
          </div>
        </section>
      </main>
    );
  if (screen === 'auth')
    return (
      <main className="auth-page">
        {historyControls}
        <section className="auth-card">
          <button className="auth-brand" onClick={() => navigate('home')}><span>汉</span><b>Hanzi Beat</b></button>
          {authUser ? (
            <div className="auth-profile">
              <section className="profile-identity">
                <div className={`profile-avatar ${progression?.equipped.frame ?? ''}`}>{authUser.name.slice(0, 1).toUpperCase()}</div>
                <div className="profile-identity-copy"><span>个人主页 · HỒ SƠ NGƯỜI CHƠI</span><h1>{authUser.name}</h1><p>{authUser.email}</p>{progression?.equipped.seal && <strong className="equipped-seal">学者印 · HỌC GIẢ</strong>}</div>
              </section>
              {progression && <div className="profile-progression">
                <span><b>Lv.{progression.level}</b>Cấp tài khoản</span>
                <span><b>{progression.jade}</b>玉片</span>
                <span><b>{progression.streak}</b>Chuỗi Nhật Ấn</span>
              </div>}
              <div className="profile-links">
                <button className="auth-inventory" onClick={() => navigate('inventory')}><Package /> <span>Inventory<small>{progression ? `${Object.values(progression.inventory ?? {}).reduce((sum, count) => sum + count, 0)} vật phẩm` : 'Kho vật phẩm'}</small></span></button>
                <button className="auth-codex" onClick={() => navigate('codex')}><BookOpen /> <span>Hán Tự Đồ Giám<small>{progression ? `${progression.discoveries.length} từ đã khám phá` : 'Bộ sưu tập HSK'}</small></span></button>
                <button className="auth-castle" onClick={() => navigate('castle')}><MapIcon /> <span>Hán Tự Thành<small>{progression ? `Thành cấp ${Object.values(progression.castle.buildings).reduce((sum, level) => sum + level, 0)}` : 'Xây thành từ việc học'}</small></span></button>
                <button className="auth-shop" onClick={() => navigate('shop')}><ShoppingBag /> <span>Cửa hàng<small>Khung và hiệu ứng</small></span></button>
                <button className="auth-music" onClick={() => { setAudioOpen(true); navigate('home'); }}><Music2 /> <span>Thư viện nhạc<small>{audioTracks.length} bài đã lưu</small></span></button>
              </div>
              <div className="profile-footer-actions"><button className="auth-home" onClick={() => navigate('home')}>Về trang chủ</button><button className="profile-logout" onClick={logout}><LogOut /> Đăng xuất</button></div>
            </div>
          ) : <>
            <div className="auth-tabs">
              <button className={authMode === 'login' ? 'on' : ''} onClick={() => { setAuthMode('login'); setAuthError(''); }}>Đăng nhập</button>
              <button className={authMode === 'register' ? 'on' : ''} onClick={() => { setAuthMode('register'); setAuthError(''); }}>Đăng ký</button>
            </div>
            <div className="auth-title"><span>{authMode === 'login' ? '欢迎回来' : '加入我们'}</span><h1>{authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}</h1><p>{authMode === 'login' ? 'Tiếp tục hành trình học tiếng Trung của bạn.' : 'Lưu danh tính người chơi cho bảng xếp hạng và PvP.'}</p></div>
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'register' && <label>Tên hiển thị<input value={authName} onChange={(event) => setAuthName(event.target.value)} minLength={2} maxLength={24} required placeholder="Ví dụ: Minh Anh" autoComplete="name" /></label>}
              <label>Email<input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" required placeholder="ban@example.com" autoComplete="email" /></label>
              <label>Mật khẩu<input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" minLength={8} maxLength={128} required placeholder="Tối thiểu 8 ký tự" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
              {authError && <p className="auth-error">{authError}</p>}
              <button className="auth-submit" disabled={authStatus === 'loading'}><LogIn /> {authStatus === 'loading' ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
            </form>
          </>}
        </section>
      </main>
    );

  if (screen === 'castle') {
    const castle = progression?.castle ?? { wood: 0, ink: 0, jadeBonusCarry: 0, shieldActiveUntil: 0, likes: 0, theme: 'classic', ownedThemes: ['classic'], attackEnergy: 5, attackUpdatedAt: Date.now(), peaceUntil: 0, newbieUntil: 0, buildings: { main: 1, library: 1, listening: 1 } };
    const castleLevel = Math.max(1, Object.values(castle.buildings).reduce((sum, level) => sum + level, 0) - 2);
    const lowestBuildingLevel = Math.min(...Object.values(castle.buildings));
    const environmentStage = Math.min(5, Math.floor(lowestBuildingLevel / 2) + 1);
    const environmentNames = ['桃源春岛 · Đào Nguyên', '月莲水境 · Nguyệt Liên', '丹霞秋谷 · Đan Hà', '冰川天境 · Băng Thiên', '紫晶神域 · Tử Tinh'];
    const extraProsperity = extraBuildings.reduce((sum, b) => sum + (b.prosperity ?? 0), 0);
    const prosperity = castleLevel * 250 + (progression?.discoveries.length ?? 0) * 5 + (progression?.streak ?? 0) * 20 + extraProsperity;
    const castleTitle = castleLevel >= 25 ? '汉字圣殿 · Thánh Điện Hán Tự' : castleLevel >= 18 ? '王城 · Vương Thành' : castleLevel >= 10 ? '书院城 · Thành Học Viện' : castleLevel >= 5 ? '小院 · Tiểu Viện' : '茅屋 · Thảo Đường';
    const mainBonusRate = mainCastleJadeBonusRates[castle.buildings.main] ?? 10;
    const buildings = [
      { id: 'main', icon: '🏯', hanzi: '主城', name: 'Chủ Thành', description: 'Trái tim của Hán Tự Thành.', coinScale: 1, woodScale: 1, inkScale: 1 },
      { id: 'library', icon: '📚', hanzi: '藏书阁', name: 'Tàng Thư Các', description: 'Lưu giữ hành trình từ vựng.', coinScale: .65, woodScale: .7, inkScale: 1.2 },
      { id: 'listening', icon: '🔔', hanzi: '听音阁', name: 'Thính Âm Các', description: 'Biểu tượng cho năng lực nghe.', coinScale: .75, woodScale: .85, inkScale: 1 },
    ] as const;
    const selectedBuilding = selectedCastleBuilding ? buildings.find((building) => building.id === selectedCastleBuilding) : null;
    const selectedExtraBuilding = selectedCastleBuilding ? extraBuildings.find((b) => b.id === selectedCastleBuilding) : null;

    const handlePlaceBuilding = (newBuilding: IsoBuildingData) => {
      if (pendingBuildingToPlace) {
        const cost = pendingBuildingToPlace.cost;
        if (castle.wood < cost.wood || castle.ink < cost.ink || (progression?.coins ?? 0) < cost.coin) {
          showCastleToast('Không đủ tài nguyên để xây dựng công trình này!', 'bad');
          return;
        }
        setProgression((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            coins: Math.max(0, prev.coins - cost.coin),
            castle: {
              ...prev.castle,
              wood: Math.max(0, prev.castle.wood - cost.wood),
              ink: Math.max(0, prev.castle.ink - cost.ink),
            },
          };
        });
      }
      const updated = [...extraBuildings, newBuilding];
      setExtraBuildings(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`castle_extra_buildings_${authUser?.id ?? 'guest'}`, JSON.stringify(updated));
      }
      debouncedSaveCastleLayout(authUser?.id, updated);
      setPendingBuildingToPlace(null);

      // Trigger 10s construction state machine
      setActiveConstructions((prev) => ({
        ...prev,
        [newBuilding.id]: {
          id: newBuilding.id,
          name: newBuilding.name,
          startTime: Date.now(),
          duration: 10000,
          type: 'build',
          newBuildingData: newBuilding,
        },
      }));
      showCastleToast(`🔨 Bắt đầu thi công [${newBuilding.name}]! (Thời gian: 10s)`, 'ok');
    };

    const handleRemoveExtraBuilding = (id: string) => {
      const b = extraBuildings.find((item) => item.id === id);
      if (!b) return;
      const refundWood = Math.floor((b.cost?.wood ?? 100) * 0.5);
      const refundCoin = Math.floor((b.cost?.coin ?? 500) * 0.5);
      setProgression((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          coins: prev.coins + refundCoin,
          castle: {
            ...prev.castle,
            wood: prev.castle.wood + refundWood,
          },
        };
      });
      const updated = extraBuildings.filter((item) => item.id !== id);
      setExtraBuildings(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`castle_extra_buildings_${authUser?.id ?? 'guest'}`, JSON.stringify(updated));
      }
      debouncedSaveCastleLayout(authUser?.id, updated);
      showCastleToast(`Đã thu hồi [${b.name}], hoàn lại 🪵 ${refundWood}, 🪙 ${refundCoin}`, 'ok');
    };

    const handleMoveBuilding = (buildingId: string, newCol: number, newRow: number, newFlipX?: boolean) => {
      if (buildingId === 'main' || buildingId === 'library' || buildingId === 'listening') {
        const nextCore: CoreBuildingPositions = {
          ...corePositions,
          [buildingId]: {
            col: newCol,
            row: newRow,
            flipX: newFlipX !== undefined ? newFlipX : corePositions[buildingId]?.flipX ?? false,
          },
        };
        setCorePositions(nextCore);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`castle_core_positions_${authUser?.id ?? 'guest'}`, JSON.stringify(nextCore));
        }
        debouncedSaveCastleCorePositions(authUser?.id, nextCore);
        setMovingBuildingToPlace(null);
        const nameMap: Record<string, string> = { main: 'Chủ Thành', library: 'Tàng Thư Các', listening: 'Thính Âm Các' };
        showCastleToast(`✨ Đã di chuyển [${nameMap[buildingId] || buildingId}] đến vị trí mới (${newCol}, ${newRow})!`, 'ok');
        return;
      }

      const updated = extraBuildings.map((b) => {
        if (b.id === buildingId) {
          return {
            ...b,
            col: newCol,
            row: newRow,
            flipX: newFlipX !== undefined ? newFlipX : b.flipX,
          };
        }
        return b;
      });
      setExtraBuildings(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`castle_extra_buildings_${authUser?.id ?? 'guest'}`, JSON.stringify(updated));
      }
      debouncedSaveCastleLayout(authUser?.id, updated);
      setMovingBuildingToPlace(null);
      showCastleToast('✨ Đã di chuyển công trình đến vị trí mới!', 'ok');
    };

    const filteredCatalog = catalogCategory === 'all'
      ? BUILDING_CATALOG
      : BUILDING_CATALOG.filter((item) => item.category === catalogCategory);
    return (
      <main className={`app castle-fullscreen-app castle-theme-${castle.theme}`}>
        {historyControls}

        {/* Top Floating HUD */}
        <header className="castle-top-hud">
          <div className="castle-hud-left">
            <button className="castle-hud-back" onClick={() => navigate('home')} title="Về trang chủ">
              <ChevronLeft size={18} />
              <span>Trang chủ</span>
            </button>
            <div className="castle-hud-player">
              <div className={`header-avatar ${progression?.equipped.frame ?? ''}`}>
                {authUser?.name.slice(0, 1).toUpperCase() ?? '汉'}
              </div>
              <div>
                <b>{authUser?.name ?? 'Người chơi'}</b>
                <small>繁荣度 {prosperity.toLocaleString('vi-VN')} · Lv.{castleLevel}</small>
              </div>
            </div>
          </div>

          <div className="castle-hud-resources">
            <div className="hud-res-pill" title="木材 · Gỗ xây dựng">🪵 <b>{castle.wood.toLocaleString('vi-VN')}</b></div>
            <div className="hud-res-pill" title="墨 · Mực học thuật">🖌 <b>{castle.ink.toLocaleString('vi-VN')}</b></div>
            <div className="hud-res-pill" title="铜钱 · Coin xây dựng">🪙 <b>{(progression?.coins ?? 0).toLocaleString('vi-VN')}</b></div>
            <div className="hud-res-pill hud-res-crystal" title="晶石 · Linh Thạch cao cấp"><img className="inline-crystal-icon" src="/items/crystal.png" alt="" /> <b>{(progression?.dragonCrystals ?? 0).toLocaleString('vi-VN')}</b></div>
            <div className="hud-res-pill hud-res-energy" title="Năng lượng công thành">⚡ <b>{castle.attackEnergy}/5</b></div>
            <div className="hud-res-pill hud-res-buff" title="Phúc lợi Mảnh Ngọc Chủ Thành">玉 <b>+{mainBonusRate}%</b></div>
          </div>

          <div className="castle-hud-right">
            <button
              className="castle-hud-sandbox-badge"
              onClick={() => navigate('castle-test')}
              title="Mở Chế Độ Thử Nghiệm Sandbox Độc Lập"
            >
              <i>🧪</i>
              <span>Sandbox</span>
            </button>
            <button
              className="castle-hud-realm-badge"
              onClick={() => setRealmInfoOpen((prev) => !prev)}
              title="Nhấn để xem thông tin Cảnh Giới"
            >
              <small>CẢNH GIỚI {environmentStage}/5</small>
              <b>{environmentNames[environmentStage - 1].split(' · ')[1] ?? environmentNames[environmentStage - 1]}</b>
            </button>
          </div>
        </header>

        {/* Cảnh Giới Modal Popup */}
        {realmInfoOpen && (
          <div className="castle-modal-backdrop" onClick={() => setRealmInfoOpen(false)}>
            <div className="castle-realm-card" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setRealmInfoOpen(false)}>×</button>
              <small className="eyebrow">TIÊN ĐẢO PHONG CẢNH</small>
              <h3>{environmentNames[environmentStage - 1]}</h3>
              <p>
                {environmentStage < 5
                  ? `Nâng toàn bộ 3 công trình (Chủ Thành, Tàng Thư Các, Thính Âm Các) lên Lv.${environmentStage * 2} để mở Cảnh giới tiếp theo.`
                  : 'Chúc mừng! Thành trì của bạn đã đắc đạo Cảnh giới cao nhất!'}
              </p>
              <div className="castle-realm-steps">
                {environmentNames.map((name, idx) => (
                  <div key={idx} className={`realm-step-item ${idx + 1 <= environmentStage ? 'unlocked' : ''}`}>
                    <i>{idx + 1 <= environmentStage ? '✦' : '○'}</i>
                    <span>{name.split(' · ')[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {castleToast && (
          <div className={`castle-iso-toast ${castleToast.kind ?? 'ok'}`}>
            {castleToast.msg}
          </div>
        )}

        {/* Not logged in prompt */}
        {!authUser ? (
          <div className="castle-login-prompt">
            <MapIcon size={48} />
            <h2>Hán Tự Thành cần tài khoản</h2>
            <p>Đăng nhập để lưu tiến độ thành trì, tài nguyên và tham gia tranh tài Công Thành.</p>
            <button onClick={() => navigate('auth')}>Đăng nhập</button>
          </div>
        ) : (
          <>
            {/* Floating Placement Helper Banner */}
            {pendingBuildingToPlace && (
              <aside className="castle-placement-bar">
                <div className="placement-bar-info">
                  <b>Đang xây: {pendingBuildingToPlace.name} ({pendingBuildingToPlace.w}×{pendingBuildingToPlace.h} ô)</b>
                  <small>Chạm vào ô đất còn trống để xây · Phím R: Lật hướng {pendingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}</small>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="placement-flip-btn"
                    onClick={handleTogglePendingFlip}
                    title="Lật ngang hướng công trình (Phím R)"
                  >
                    🔄 Lật {pendingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}
                  </button>
                  <button className="placement-cancel-btn" onClick={() => setPendingBuildingToPlace(null)}>
                    ✕ Hủy bỏ
                  </button>
                </div>
              </aside>
            )}

            {/* Floating Movement Helper Banner */}
            {movingBuildingToPlace && (
              <aside className="castle-placement-bar">
                <div className="placement-bar-info">
                  <b>Đang di chuyển: {movingBuildingToPlace.name} ({movingBuildingToPlace.w}×{movingBuildingToPlace.h} ô)</b>
                  <small>Chạm vào ô đất mới để hạ đặt · Phím R: Lật hướng {movingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}</small>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="placement-flip-btn"
                    onClick={handleToggleMovingFlip}
                    title="Lật ngang hướng công trình (Phím R)"
                  >
                    🔄 Lật {movingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}
                  </button>
                  <button className="placement-cancel-btn" onClick={() => setMovingBuildingToPlace(null)}>
                    ✕ Hủy bỏ
                  </button>
                </div>
              </aside>
            )}

            {/* Interactive 2.5D Isometric Canvas Fullscreen */}
            <CastleIsoCanvas
              castle={castle}
              environmentStage={environmentStage}
              selectedBuildingId={selectedCastleBuilding}
              onSelectBuilding={(id) => {
                setSelectedCastleBuilding(id);
              }}
              showGrid={castleShowGrid}
              calibration={islandCalibration}
              showDebugGrid={showDebugGrid}
              extraBuildings={extraBuildings}
              onPlacedBuilding={handlePlaceBuilding}
              onRemoveBuilding={handleRemoveExtraBuilding}
              pendingBuilding={pendingBuildingToPlace}
              onCancelPlacement={() => setPendingBuildingToPlace(null)}
              movingBuilding={movingBuildingToPlace}
              onConfirmMove={handleMoveBuilding}
              onCancelMove={() => setMovingBuildingToPlace(null)}
              onToggleFlip={() => handleGlobalToggleFlip(false)}
              onToast={showCastleToast}
              burstBuildingId={castleBurstBuildingId}
              burstText={castleBurstText}
              onBurstComplete={() => setCastleBurstBuildingId(null)}
              enableIdleFx={true}
              shieldActive={Boolean((castle.shieldActiveUntil && castle.shieldActiveUntil > Date.now()) || (castle.peaceUntil && castle.peaceUntil > Date.now()))}
              combatFxTrigger={castleCombatTrigger}
              corePositions={corePositions}
              buildingAnimStates={mainBuildingAnimStates}
            />

            {/* Bilinear Quad Calibration Panel */}
            {calibrationModalOpen && (
              <div
                className="castle-calibration-panel"
                style={{
                  position: 'absolute',
                  top: '72px',
                  right: '16px',
                  width: '320px',
                  background: 'rgba(20, 14, 12, 0.95)',
                  border: '1px solid #ffd43b',
                  borderRadius: '12px',
                  padding: '16px',
                  zIndex: 100,
                  color: '#fff',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
                  fontSize: '13px',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#ffd43b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎯</span> Hiệu Chuẩn Lưới Đảo
                  </h3>
                  <button
                    onClick={() => {
                      setCalibrationModalOpen(false);
                      setShowDebugGrid(false);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
                    <input
                      type="checkbox"
                      checked={showDebugGrid}
                      onChange={(e) => setShowDebugGrid(e.target.checked)}
                    />
                    <b style={{ color: '#69db7c' }}>Hiện Lưới Điểm Đỏ Debug</b>
                  </label>
                  <div style={{ fontSize: '11px', color: '#bbb', lineHeight: '1.4' }}>
                    Bilinear Quad nội suy 144 ô lưới theo đúng 4 đỉnh mặt cỏ: TOP, RIGHT, BOTTOM, LEFT.
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#ffd43b', marginBottom: '4px' }}>
                    Preset Địa Hình:
                  </label>
                  <select
                    value={islandCalibration.id}
                    onChange={(e) => {
                      if (e.target.value === 'rim-12x12') {
                        setIslandCalibration(RIM_ISLAND_CALIBRATION);
                      } else if (e.target.value === 'natural-12x12') {
                        setIslandCalibration(NATURAL_ISLAND_CALIBRATION);
                      }
                    }}
                    style={{
                      width: '100%',
                      background: '#2b1b17',
                      color: '#fff',
                      border: '1px solid #5a3c30',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      fontSize: '12px',
                    }}
                  >
                    <option value="rim-12x12">Đảo Thành Cổ Viền Đá (1024×1024)</option>
                    <option value="natural-12x12">Đảo Tiên Tự Nhiên (1024×1024)</option>
                  </select>
                </div>

                {/* 4 Corners Live Adjustment */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  {(['top', 'right', 'bottom', 'left'] as const).map((cornerKey) => {
                    const c = islandCalibration.plateauCorners[cornerKey];
                    const colors: Record<string, string> = {
                      top: '#ffd43b',
                      right: '#69db7c',
                      bottom: '#4dabf7',
                      left: '#da77f2',
                    };
                    return (
                      <div
                        key={cornerKey}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${colors[cornerKey]}`,
                        }}
                      >
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', color: colors[cornerKey] }}>
                          {cornerKey}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#888' }}>X:</span>
                          <input
                            type="number"
                            value={c.x}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setIslandCalibration((prev) => ({
                                ...prev,
                                plateauCorners: {
                                  ...prev.plateauCorners,
                                  [cornerKey]: { ...prev.plateauCorners[cornerKey], x: val },
                                },
                              }));
                            }}
                            style={{ width: '48px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '2px 4px', fontSize: '11px' }}
                          />
                          <span style={{ fontSize: '11px', color: '#888' }}>Y:</span>
                          <input
                            type="number"
                            value={c.y}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setIslandCalibration((prev) => ({
                                ...prev,
                                plateauCorners: {
                                  ...prev.plateauCorners,
                                  [cornerKey]: { ...prev.plateauCorners[cornerKey], y: val },
                                },
                              }));
                            }}
                            style={{ width: '48px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px', padding: '2px 4px', fontSize: '11px' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(islandCalibration, null, 2));
                      showCastleToast('Đã copy cấu hình Calibration JSON!', 'ok');
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: '#e0a94d',
                      color: '#1a0e08',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    📋 Copy JSON
                  </button>
                  <button
                    onClick={() => {
                      setIslandCalibration(RIM_ISLAND_CALIBRATION);
                      showCastleToast('Đã đặt lại về chuẩn mặc định', 'ok');
                    }}
                    style={{
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#ccc',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    ↺ Đặt lại
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Floating Action Dock */}
            <footer className="castle-bottom-dock">
              <div className="dock-group dock-tools">
                <button
                  className={`dock-item tool-item ${castleShowGrid ? 'active' : ''}`}
                  onClick={() => {
                    const next = !castleShowGrid;
                    setCastleShowGrid(next);
                    showCastleToast(next ? 'Đã bật lưới toạ độ (col, row)' : 'Đã tắt lưới toạ độ');
                  }}
                  title="Hiện Lưới Toạ Độ (Algorithm 1)"
                >
                  <i>📐</i>
                  <span>Lưới</span>
                </button>
                <button
                  className={`dock-item tool-item ${calibrationModalOpen ? 'active' : ''}`}
                  onClick={() => {
                    const next = !calibrationModalOpen;
                    setCalibrationModalOpen(next);
                    setShowDebugGrid(next);
                    showCastleToast(next ? 'Đã mở bảng Hiệu Chuẩn Lưới Đảo' : 'Đã đóng bảng Hiệu Chuẩn');
                  }}
                  title="Hiệu Chuẩn Lưới Mặt Cỏ (Bilinear Quad Calibration)"
                >
                  <i>🎯</i>
                  <span>Hiệu chuẩn</span>
                </button>
                <button
                  className={`dock-item tool-item highlight-gold ${castleBuildCatalogOpen ? 'active' : ''}`}
                  onClick={() => setCastleBuildCatalogOpen(true)}
                  title="Mở Xưởng Kiến Trúc để mua thêm các công trình"
                >
                  <i>🏛️</i>
                  <span>Công trình</span>
                </button>
                {pendingBuildingToPlace ? (
                  <button
                    className="dock-item tool-item active"
                    onClick={() => {
                      setPendingBuildingToPlace(null);
                      showCastleToast('Đã hủy chế độ đặt');
                    }}
                    title="Hủy đặt công trình"
                  >
                    <i>✕</i>
                    <span>Hủy đặt</span>
                  </button>
                ) : (
                  <button
                    className="dock-item tool-item"
                    onClick={() => setCastleBuildCatalogOpen(true)}
                    title="Chọn kiến trúc để lắp đặt"
                  >
                    <i>🏗️</i>
                    <span>Xây mới</span>
                  </button>
                )}
              </div>

              <div className="dock-group dock-menus">
                <button className="dock-item menu-item" onClick={() => setCastleShopOpen(true)}>
                  <i>🏯</i>
                  <span>Cửa Hàng</span>
                </button>
                <button className="dock-item menu-item highlight-gold" onClick={() => setCastleCommerceOpen(true)}>
                  <i>🛍️</i>
                  <span>Thương Hội</span>
                </button>
                <button className="dock-item menu-item" onClick={() => setCastleCombatOpen(true)}>
                  <i>⚔️</i>
                  <span>Công Thành</span>
                </button>
                <button className="dock-item menu-item" onClick={() => setCastleSocialOpen(true)}>
                  <i>🏆</i>
                  <span>Castle Rank</span>
                </button>
              </div>
            </footer>
          </>
        )}

        {/* Modal: Castle Social (Castle Rank & Visits) */}
        {castleSocialOpen && (
          <div className="castle-modal-backdrop" onClick={() => setCastleSocialOpen(false)}>
            <div className="castle-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setCastleSocialOpen(false)}>×</button>
              <section className="castle-social-panel">
                <header>
                  <div>
                    <span>社交 · XÃ HỘI</span>
                    <h2>Castle Rank · {castleSocial?.season ?? 'Mùa hiện tại'}</h2>
                  </div>
                  <b>♥ {castle.likes}</b>
                </header>
                <div className="castle-theme-picker">
                  {[{id:'classic',name:'Cổ Điển',level:1},{id:'moon',name:'Nguyệt Dạ',level:4},{id:'crimson',name:'Xích Hà',level:7}].map((theme) => (
                    <button
                      key={theme.id}
                      className={castle.theme === theme.id ? 'on' : ''}
                      disabled={castle.buildings.main < theme.level}
                      onClick={() => void runCastleSocial('theme', undefined, theme.id)}
                    >
                      {theme.name}
                      <small>Lv.{theme.level}</small>
                    </button>
                  ))}
                </div>
                <div className="castle-rank-list">
                  {castleSocial?.castles.map((entry, index) => {
                    const rival = entry.uid !== authUser?.id && !castleSocial.castles.slice(0, index).some((item) => item.uid !== authUser?.id);
                    return (
                      <article key={entry.uid} className={rival ? 'rival' : ''}>
                        <b>#{index + 1}</b>
                        <i>{entry.name.slice(0, 1).toUpperCase()}</i>
                        <span>
                          <strong>{entry.name}</strong>
                          <small>主城 Lv.{entry.buildings.main} · {entry.score.toLocaleString('vi-VN')} điểm</small>
                        </span>
                        <em>♥ {entry.likes}</em>
                        {entry.uid !== authUser?.id && (
                          <div>
                            <button onClick={() => void runCastleSocial('visit', entry.uid)}>Ghé thăm</button>
                            <button onClick={() => void runCastleSocial('like', entry.uid)}>Like</button>
                            <button className="attack" onClick={() => void runCastleCombat('start', { targetId: entry.uid })}>Công thành</button>
                          </div>
                        )}
                        {rival && <mark>RIVAL</mark>}
                      </article>
                    );
                  })}
                </div>
                <div className="castle-visitors">
                  <h3>Nhật ký khách ghé thăm</h3>
                  {castleSocial?.visitors.length ? (
                    castleSocial.visitors.map((visitor) => (
                      <p key={`${visitor.uid}-${visitor.visitedAt}`}>
                        <b>{visitor.name}</b>
                        <span>{new Date(visitor.visitedAt).toLocaleString('vi-VN')}</span>
                      </p>
                    ))
                  ) : (
                    <small>Chưa có khách ghé thăm.</small>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Modal: Castle Combat (Attack energy & Logs) */}
        {castleCombatOpen && (
          <div className="castle-modal-backdrop" onClick={() => setCastleCombatOpen(false)}>
            <div className="castle-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setCastleCombatOpen(false)}>×</button>
              <section className="castle-combat-panel">
                <header>
                  <div>
                    <span>攻城 · CÔNG THÀNH</span>
                    <h2>Attack Energy</h2>
                  </div>
                  <b>⚡ {castle.attackEnergy}/5</b>
                  <button
                    className={castle.peaceUntil > Date.now() ? 'on' : ''}
                    onClick={() => void runCastleCombat('peace')}
                  >
                    {castle.peaceUntil > Date.now() ? 'Tắt Peace Mode' : 'Bật Peace Mode 8h'}
                  </button>
                </header>
                <p>Hồi 1 năng lượng mỗi 2 giờ · thắng khi đúng ít nhất 7/10 câu · tối đa 3 trận/cặp mỗi ngày.</p>
                <div className="combat-protection">
                  <span>🛡 Hộ Thành Phù: {castle.shieldActiveUntil > Date.now() ? 'Đang bảo vệ' : 'Không hoạt động'}</span>
                  <span>🌱 Newbie Protection: {castle.newbieUntil > Date.now() ? 'Đang bảo vệ' : 'Đã kết thúc'}</span>
                </div>
                <h3>Nhật ký chiến đấu</h3>
                <div className="combat-log-list">
                  {combatLogs.length ? (
                    combatLogs.map((log) => {
                      const defending = log.defenderId === authUser?.id;
                      const rivalId = defending ? log.attackerId : log.defenderId;
                      return (
                        <article key={log.id}>
                          <b className={log.won ? 'win' : 'lose'}>
                            {log.shielded ? 'ĐÃ CHẶN' : log.won ? 'THẮNG' : 'THUA'}
                          </b>
                          <span>
                            <strong>{log.attackerName} → {log.defenderName}</strong>
                            <small>{log.correct}/10 câu · {new Date(log.createdAt).toLocaleString('vi-VN')}</small>
                          </span>
                          {defending && <button onClick={() => void runCastleCombat('start', { targetId: rivalId })}>Trả đũa</button>}
                        </article>
                      );
                    })
                  ) : (
                    <small>Chưa có trận Công Thành.</small>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Modal: Castle Commerce (Thương Hội Long Tinh, Themes, Cosmetics, Pass) */}
        {castleCommerceOpen && (
          <div className="castle-modal-backdrop" onClick={() => setCastleCommerceOpen(false)}>
            <div className="castle-modal-dialog castle-modal-wide" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setCastleCommerceOpen(false)}>×</button>
              <section className="castle-commerce-panel">
                <header>
                  <div>
                    <span>龙晶商会 · THƯƠNG MẠI HÁN TỰ THÀNH</span>
                    <h2>Linh Thạch Các</h2>
                  </div>
                  <div className="commerce-balance">
                    <b>🔮 {progression?.dragonCrystals ?? 0} Linh Thạch</b>
                    <button className="topup-trigger-btn" onClick={() => setTopupOpen(true)}>+ Nạp Linh Thạch</button>
                  </div>
                </header>
                <div className="commerce-policy-banner">
                  🛡 <b>Nguyên tắc Thương mại Công bằng:</b> Chỉ phát hành giao diện thẩm mỹ & trang trí kiến trúc. Tuyệt đối KHÔNG bán Coin, Gỗ, Mực, Năng lượng hay vật phẩm phòng thủ.
                </div>
                <div className="commerce-tabs">
                  <button className={commerceTab === 'themes' ? 'on' : ''} onClick={() => setCommerceTab('themes')}>🏯 Theme Pack</button>
                  <button className={commerceTab === 'cosmetics' ? 'on' : ''} onClick={() => setCommerceTab('cosmetics')}>✨ Khí Tượng & Linh Thú</button>
                  <button className={commerceTab === 'pass' ? 'on' : ''} onClick={() => setCommerceTab('pass')}>📜 Long Vân Pass (Mùa 1)</button>
                </div>

                {commerceTab === 'themes' && (
                  <div className="commerce-grid">
                    {[
                      { id: 'theme-classic', theme: 'classic', name: 'Theme · Cổ Điển', price: 0, preview: 'classic', desc: 'Kiến trúc phong cách cổ phong kinh điển, khởi đầu cho giang sơn.' },
                      { id: 'theme-jade', theme: 'jade', name: 'Theme Pack · Bích Ngọc Cung', price: 120, preview: 'jade', desc: 'Thành trì ngọc bích thanh tao, mái ngói lục bích tỏa ánh minh châu rực rỡ.' },
                      { id: 'theme-lantern', theme: 'lantern', name: 'Theme Pack · Đèn Lồng Phố Đêm', price: 180, preview: 'lantern', desc: 'Đêm hoa đăng ấm áp lung linh, lầu son sáng rực ngập tràn đèn trời bay cao.' },
                      { id: 'theme-frost', theme: 'frost', name: 'Theme Pack · Băng Thiên Tuyết Sơn', price: 220, preview: 'frost', desc: 'Đỉnh tuyết ngàn năm kỳ vĩ, phong thái băng thanh ngọc khiết bất diệt.' },
                      { id: 'theme-crimson', theme: 'crimson', name: 'Theme Pack · Đan Hà Thu Cảnh', price: 150, preview: 'crimson', desc: 'Ráng chiều hoàng hôn rực rỡ, sắc thu vàng son bên thành cổ tráng lệ.' },
                    ].map((item) => {
                      const owned = item.price === 0 || (castle.ownedThemes ?? []).includes(item.theme) || (castle.ownedDecorations ?? []).includes(item.theme) || (castle.ownedDecorations ?? []).includes(item.id);
                      const isEquipped = castle.theme === item.theme;
                      const canAfford = (progression?.dragonCrystals ?? 0) >= item.price;
                      return (
                        <article key={item.id} className={`commerce-card preview-${item.preview}`}>
                          <div className="commerce-card-icon">城</div>
                          <h3>{item.name}</h3>
                          <p>{item.desc}</p>
                          <footer>
                            {isEquipped ? (
                              <button disabled className="active-equipped">✓ Đang dùng</button>
                            ) : owned ? (
                              <button onClick={() => void runCastleCommerce('equip-decoration', { slot: 'theme', id: item.theme })}>Trang bị</button>
                            ) : (
                              <button disabled={!canAfford} onClick={() => void runCastleCommerce('buy', { itemId: item.id })}>
                                Mua (💎 {item.price})
                              </button>
                            )}
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                )}

                {commerceTab === 'cosmetics' && (
                  <div className="commerce-cosmetics-section">
                    <h3>Khí Tượng Thời Tiết (Weather Effects)</h3>
                    <div className="commerce-grid">
                      {[
                        { id: 'weather-petals', weather: 'weather-petals', name: 'Lạc Hoa Phù Dao', price: 70, icon: '🌸', desc: 'Cánh hoa đào hồng phớt bay lượn nhẹ nhàng trong gió xuân quanh thành trì.' },
                        { id: 'weather-lanterns', weather: 'weather-lanterns', name: 'Thiên Đăng Cầu Nguyện', price: 80, icon: '🏮', desc: 'Hàng ngàn chiếc đèn lồng giấy phát sáng bồng bềnh bay lên trời đêm phúc lộc.' },
                        { id: 'weather-snow', weather: 'weather-snow', name: 'Băng Tuyết Phiêu Diêu', price: 90, icon: '❄️', desc: 'Bông tuyết trắng tinh khôi rơi chầm chậm trên mái ngói, phong thái tiên hiệp.' },
                        { id: 'weather-clouds', weather: 'weather-clouds', name: 'Tử Khí Đông Lai', price: 110, icon: '☁️', desc: 'Làn mây tím phong thủy điềm lành bao bọc quanh vương điện uy nghiêm.' },
                      ].map((item) => {
                        const owned = (castle.ownedDecorations ?? []).includes(item.id);
                        const isEquipped = castle.decorations?.weather === item.weather;
                        const canAfford = (progression?.dragonCrystals ?? 0) >= item.price;
                        return (
                          <article key={item.id} className="commerce-card">
                            <div className="commerce-card-icon">{item.icon}</div>
                            <h3>{item.name}</h3>
                            <p>{item.desc}</p>
                            <footer>
                              {isEquipped ? (
                                <button className="unequip-btn" onClick={() => void runCastleCommerce('equip-decoration', { slot: 'weather', id: null })}>Tháo gỡ</button>
                              ) : owned ? (
                                <button onClick={() => void runCastleCommerce('equip-decoration', { slot: 'weather', id: item.weather })}>Dùng hiệu ứng</button>
                              ) : (
                                <button disabled={!canAfford} onClick={() => void runCastleCommerce('buy', { itemId: item.id })}>Mua (🔮 {item.price})</button>
                              )}
                            </footer>
                          </article>
                        );
                      })}
                    </div>

                    <h3 style={{ marginTop: '24px' }}>Linh Thú Trấn Thành (Guardian Statues)</h3>
                    <div className="commerce-grid">
                      {[
                        { id: 'guardian-lion', guardian: 'guardian-lion', name: 'Thạch Sư Uy Nghi', price: 60, icon: '🦁', desc: 'Cặp tượng sư tử đá trấn giữ bình an trước cửa thành môn.' },
                        { id: 'guardian-qilin', guardian: 'guardian-qilin', name: 'Kỳ Lân Hiến Thụy', price: 130, icon: '🦄', desc: 'Kỳ lân thần thú mang lại điềm lành, phúc thọ và hanh thông tri thức.' },
                        { id: 'guardian-dragon', guardian: 'guardian-dragon', name: 'Thanh Long Trấn Thành', price: 190, icon: '🐉', desc: 'Thần long vút bay bảo hộ giang sơn vững chãi vạn đời.' },
                      ].map((item) => {
                        const owned = (castle.ownedDecorations ?? []).includes(item.id);
                        const isEquipped = castle.decorations?.guardian === item.guardian;
                        const canAfford = (progression?.dragonCrystals ?? 0) >= item.price;
                        return (
                          <article key={item.id} className="commerce-card">
                            <div className="commerce-card-icon">{item.icon}</div>
                            <h3>{item.name}</h3>
                            <p>{item.desc}</p>
                            <footer>
                              {isEquipped ? (
                                <button className="unequip-btn" onClick={() => void runCastleCommerce('equip-decoration', { slot: 'guardian', id: null })}>Tháo gỡ</button>
                              ) : owned ? (
                                <button onClick={() => void runCastleCommerce('equip-decoration', { slot: 'guardian', id: item.guardian })}>Đặt linh thú</button>
                              ) : (
                                <button disabled={!canAfford} onClick={() => void runCastleCommerce('buy', { itemId: item.id })}>Mua (💎 {item.price})</button>
                              )}
                            </footer>
                          </article>
                        );
                      })}
                    </div>

                    <h3 style={{ marginTop: '24px' }}>Cờ Hiệu Thành (Castle Banners)</h3>
                    <div className="commerce-grid">
                      {[
                        { id: 'banner-scholar', banner: 'banner-scholar', name: 'Bác Học Văn Kỳ', price: 45, icon: '🚩', desc: 'Cờ chữ "Văn" vàng nền đỏ thêu gấm, vinh danh con đường bút nghiên.' },
                        { id: 'banner-dragon', banner: 'banner-dragon', name: 'Long Đằng Chiến Kỳ', price: 75, icon: '🐲', desc: 'Cờ rồng vàng bay lượn trên đỉnh lâu đài, khí phách ngút trời.' },
                      ].map((item) => {
                        const owned = (castle.ownedDecorations ?? []).includes(item.id);
                        const isEquipped = castle.decorations?.banner === item.banner;
                        const canAfford = (progression?.dragonCrystals ?? 0) >= item.price;
                        return (
                          <article key={item.id} className="commerce-card">
                            <div className="commerce-card-icon">{item.icon}</div>
                            <h3>{item.name}</h3>
                            <p>{item.desc}</p>
                            <footer>
                              {isEquipped ? (
                                <button className="unequip-btn" onClick={() => void runCastleCommerce('equip-decoration', { slot: 'banner', id: null })}>Tháo cờ</button>
                              ) : owned ? (
                                <button onClick={() => void runCastleCommerce('equip-decoration', { slot: 'banner', id: item.banner })}>Cắm cờ hiệu</button>
                              ) : (
                                <button disabled={!canAfford} onClick={() => void runCastleCommerce('buy', { itemId: item.id })}>Mua (💎 {item.price})</button>
                              )}
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

                {commerceTab === 'pass' && (
                  <div className="commerce-pass-section">
                    <header className="battle-pass-title"><div><span>龙脉之旅 · SEASON 1</span><h2>HÀNH TRÌNH LONG MẠCH</h2></div><b>⏳ 49 ngày còn lại</b></header>
                    <div className="battle-pass-summary">
                      <section className="pass-mission-card"><span>NHIỆM VỤ MÙA</span><h3>Đánh thức Long Mạch bằng tri thức!</h3><p>Hoàn thành bài học, Daily Challenge và PvP để thu thập Điểm Hành Trình.</p><div><b>Cấp {Math.min(50, Math.floor((progression?.battlePass?.xp ?? 0) / 100))}</b><small>{progression?.battlePass?.xp ?? 0}/5000 Điểm</small></div><div className="pass-bar"><i style={{ width: `${Math.min(100, ((progression?.battlePass?.xp ?? 0) / 5000) * 100)}%` }} /></div></section>
                      <section className="pass-premium-card"><span>PREMIUM TRACK</span><h3>Kho báu Thanh Long</h3><p>Avatar, hiệu ứng, nhạc, collectible độc quyền và hoàn lại 80 Linh Thạch.</p><div className="pass-status">
                        {progression?.battlePass?.premium ? (
                          <span className="premium-badge">★ LONG VÂN PREMIUM ĐÃ MỞ ★</span>
                        ) : (
                          <button
                            disabled={(progression?.dragonCrystals ?? 0) < 129}
                            onClick={() => void runCastleCommerce('buy', { itemId: 'premium-pass' })}
                          >
                            Mở Premium Track (🔮 129)
                          </button>
                        )}
                      </div></section>
                    </div>
                    <div className="pass-track-labels"><b>FREE TRACK</b><span>← Kéo ngang để xem đủ 50 cấp →</span><b>PREMIUM TRACK</b></div>
                    <div className="castle-pass-v2">
                      {BATTLE_PASS_TIERS.map((row) => {
                        const curXp = progression?.battlePass?.xp ?? 0;
                        const ready = curXp >= row.xpReq;
                        const isPremUser = Boolean(progression?.battlePass?.premium);
                        const freeClaimed = (progression?.battlePass?.claimed ?? []).includes(`free-${row.tier}`);
                        const premiumClaimed = (progression?.battlePass?.claimed ?? []).includes(`premium-${row.tier}`);
                        return (
                          <article key={row.tier} className={`pass-tier-card ${ready ? 'reached' : ''}`}>
                            <div className="tier-badge">Cấp {row.tier} ({row.xpReq} XP)</div>
                            <div className="tier-track free-track">
                              <small>{row.free.icon} Miễn phí: {row.free.name}</small>
                              <button
                                className={freeClaimed ? 'claimed' : ''}
                                disabled={!ready || freeClaimed}
                                onClick={() => void runCastleCommerce('claim-pass', { tier: row.tier, premium: false })}
                              >
                                {freeClaimed ? '✓ Đã nhận' : ready ? 'Nhận quà' : 'Chưa đạt'}
                              </button>
                            </div>
                            <div className="tier-track premium-track">
                              <small>{row.premium.icon} Premium: {row.premium.name}</small>
                              <button
                                className={premiumClaimed ? 'claimed' : ''}
                                disabled={!ready || !isPremUser || premiumClaimed}
                                onClick={() => void runCastleCommerce('claim-pass', { tier: row.tier, premium: true })}
                              >
                                {premiumClaimed ? '✓ Đã nhận' : !isPremUser ? 'Khóa (Cần Pass)' : ready ? 'Nhận Premium' : 'Chưa đạt'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
        {castleShopOpen && <div className="castle-shop-backdrop" onClick={() => setCastleShopOpen(false)}><section className="castle-shop-modal" role="dialog" aria-modal="true" aria-label="Cửa hàng Thành" onClick={(event) => event.stopPropagation()}><header><small>建设商店</small><h2>Cửa hàng Thành</h2><button onClick={() => setCastleShopOpen(false)}>×</button></header><div className="castle-shop-list">{buildings.map((building) => { const level = castle.buildings[building.id]; const maxed = level >= 10; const stage = castleVisualStage(level); const nextStage = castleVisualStage(Math.min(10, level + 1)); const currentAsset = building.id === 'main' ? stage : 1; const nextAsset = building.id === 'main' ? nextStage : 1; const cost = castleUpgradeCost(building, level); const enough = castle.wood >= cost.wood && castle.ink >= cost.ink && (progression?.coins ?? 0) >= cost.coin; const supportReady = building.id !== 'main' || Math.min(castle.buildings.library, castle.buildings.listening) >= level; const playerReady = building.id !== 'main' || (progression?.level ?? 1) >= (mainCastleLevelRequirements[level + 1] ?? 100); const mainReady = building.id === 'main' || level < castle.buildings.main; const canBuy = !maxed && enough && supportReady && playerReady && mainReady; return <article key={building.id}><div className="castle-shop-art"><img src={`/castle/buildings/${building.id}/stage-${currentAsset}.webp`} alt=""/>{!maxed && <><i>›</i><img src={`/castle/buildings/${building.id}/stage-${nextAsset}.webp`} alt=""/></>}</div><div className="castle-shop-info"><span>{building.hanzi}</span><h3>{building.name}</h3><div className="castle-shop-stars">{Array.from({length:10},(_,index)=><i key={index} className={index < level ? 'on' : ''}>★</i>)}</div><small>Lv.{level}/10 · 🪵 {cost.wood} · 🖌 {cost.ink}</small></div>{maxed ? <strong>HOÀN TẤT!</strong> : <div className="castle-shop-buy"><b>🪙 {cost.coin.toLocaleString('vi-VN')}</b><button disabled={rewardActionStatus === 'loading' || !canBuy} onClick={() => void runProgressionAction('upgrade-castle', building.id)}>NÂNG CẤP</button></div>}</article>; })}</div></section></div>}
        {combatQuiz && (() => { const question = combatQuiz.questions[combatQuiz.index]; const options = [question[3], ...allVocabulary.filter((entry) => entry[3] !== question[3]).slice(combatQuiz.index * 3, combatQuiz.index * 3 + 3).map((entry) => entry[3])].sort((a,b)=>a.localeCompare(b)); return <div className="combat-quiz-backdrop"><section className="combat-quiz"><span>攻城挑战 · {combatQuiz.index + 1}/10</span><h2>{combatQuiz.targetName}</h2><div className="combat-quiz-progress"><i style={{width:`${combatQuiz.index * 10}%`}}/></div><strong>{question[0]}</strong><small>{question[1]}</small><div>{options.map((option)=><button key={option} onClick={() => answerCombatQuestion(option)}>{option}</button>)}</div><p>Đúng {combatQuiz.correct} · Cần ít nhất 7 câu</p></section></div>; })()}
        {combatResult && <div className="combat-result-backdrop" onClick={() => setCombatResult(null)}><section><b>{combatResult.shielded ? '🛡' : combatResult.won ? '🏆' : '⚔️'}</b><span>攻城结果</span><h2>{combatResult.shielded ? 'BỊ HỘ THÀNH PHÙ CHẶN' : combatResult.won ? 'CÔNG THÀNH THẮNG LỢI' : 'CÔNG THÀNH THẤT BẠI'}</h2><p>{combatResult.correct}/10 câu đúng</p>{combatResult.won && <strong>🪙 ×{combatResult.reward.coins} · 🪵 ×{combatResult.reward.wood} · 🖌 ×{combatResult.reward.ink}</strong>}<button onClick={() => setCombatResult(null)}>Đóng</button></section></div>}
        {visitedCastle && (
          <div className="castle-visit-backdrop" onClick={() => setVisitedCastle(null)}>
            <section
              className={`castle-visit-card castle-theme-${visitedCastle.theme}`}
              onClick={(event) => event.stopPropagation()}
            >
              <button onClick={() => setVisitedCastle(null)}>×</button>
              <span>拜访 · GHÉ THĂM</span>
              <h2>Thành của {visitedCastle.name}</h2>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 280,
                  borderRadius: 12,
                  overflow: 'hidden',
                  margin: '10px 0',
                  border: '1px solid rgba(255, 215, 100, 0.35)',
                  background: 'rgba(15, 10, 8, 0.65)',
                }}
              >
                <CastleIsoCanvas
                  castle={{
                    theme: visitedCastle.theme,
                    buildings: visitedCastle.buildings,
                  }}
                  environmentStage={Math.min(5, Math.ceil(visitedCastle.level / 2))}
                  selectedBuildingId={null}
                  onSelectBuilding={() => {}}
                  showGrid={false}
                  extraBuildings={visitedCastle.buildingsLayout ?? []}
                  pendingBuilding={null}
                  onToast={showCastleToast}
                  shieldActive={Boolean(visitedCastle.shieldActiveUntil && visitedCastle.shieldActiveUntil > Date.now())}
                  combatFxTrigger={castleCombatTrigger}
                  corePositions={visitedCastle.corePositions}
                />
              </div>
              <p>繁荣度 {visitedCastle.score.toLocaleString('vi-VN')} · ♥ {visitedCastle.likes}</p>
              <button onClick={() => void runCastleSocial('like', visitedCastle.uid)}>♥ Like thành</button>
            </section>
          </div>
        )}
        {renderTopupModal()}
        {selectedBuilding && (() => {
          const level = castle.buildings[selectedBuilding.id];
          const visualStage = castleVisualStage(level);
          const assetStage = selectedBuilding.id === 'main' ? visualStage : 1;
          const { wood: woodCost, ink: inkCost, coin: coinCost } = castleUpgradeCost(selectedBuilding, level);
          const hasWood = castle.wood >= woodCost;
          const hasInk = castle.ink >= inkCost;
          const hasCoin = (progression?.coins ?? 0) >= coinCost;
          const maxed = level >= 10;
          const isMain = selectedBuilding.id === 'main';
          const supportLevel = Math.min(castle.buildings.library, castle.buildings.listening);
          const supportReady = !isMain || supportLevel >= level;
          const requiredPlayerLevel = isMain ? mainCastleLevelRequirements[level + 1] ?? 100 : 0;
          const playerLevelReady = !isMain || (progression?.level ?? 1) >= requiredPlayerLevel;
          const mainCapReady = isMain || level < castle.buildings.main;
          const canUpgrade = !maxed && hasWood && hasInk && hasCoin && supportReady && playerLevelReady && mainCapReady;
          const nextVisualLevel = visualStage < 5 ? visualStage * 2 + 1 : null;
          const currentBonus = mainCastleJadeBonusRates[level] ?? 10;
          const nextBonus = mainCastleJadeBonusRates[Math.min(10, level + 1)] ?? 10;
          const completedConditions = [!maxed, hasWood, hasInk, hasCoin, supportReady, playerLevelReady, mainCapReady].filter(Boolean).length;

          const curPos = corePositions[selectedBuilding.id as keyof CoreBuildingPositions];
          const curCol = curPos?.col ?? (selectedBuilding.id === 'main' ? 4 : selectedBuilding.id === 'library' ? 1 : 8);
          const curRow = curPos?.row ?? 4;
          const curFlipX = curPos?.flipX ?? false;
          const constr = activeConstructions[selectedBuilding.id];
          const isUpgrading = Boolean(constr);
          const remainingSec = constr ? Math.max(0, Math.ceil((constr.startTime + constr.duration - Date.now()) / 1000)) : 0;
          const upgradePct = constr ? Math.min(100, Math.round(((Date.now() - constr.startTime) / constr.duration) * 100)) : 0;

          return <div className="castle-upgrade-backdrop" onClick={() => setSelectedCastleBuilding(null)}><section className="castle-upgrade-modal" role="dialog" aria-modal="true" aria-label={`Nâng cấp ${selectedBuilding.name}`} onClick={(event) => event.stopPropagation()}>
            <button className="castle-upgrade-close" onClick={() => setSelectedCastleBuilding(null)} aria-label="Đóng">×</button>
            <header><span>Lv.{level}</span><div><small>{selectedBuilding.hanzi}</small><h2>{selectedBuilding.name}</h2></div></header>
            <div className="castle-upgrade-preview">
              <img src={`/castle/buildings/${selectedBuilding.id}/stage-${assetStage}.webp`} alt={selectedBuilding.name}/>
              <span>VỊ TRÍ ({curCol}, {curRow}) · HÌNH THÁI {visualStage}/5</span>
            </div>
            <div className="castle-upgrade-effect"><b>Hiệu quả nâng cấp</b>{isMain ? <><p className="castle-bonus-change"><span>玉片 sau trận</span><strong>+{currentBonus}% → +{nextBonus}%</strong></p><small>Bonus áp dụng cho Offline, Daily và PvP; tối đa 10%. Phần lẻ được tích lũy cho trận sau.</small></> : <><p>+250 繁荣度 · Mở đường nâng cấp Nhà Chính.</p>{nextVisualLevel && <small>Hình thái mới mở khi công trình đạt Lv.{nextVisualLevel}.</small>}</>}</div>
            <div className="castle-upgrade-requirements"><b>Điều kiện · {completedConditions}/7</b>
              <p className={!maxed ? 'ready' : 'missing'}><span>🏯 Cấp công trình</span><strong>{level}/10 {!maxed ? '✓' : 'MAX'}</strong></p>
              {isMain && <p className={supportReady ? 'ready' : 'missing'}><span>🏘 Công trình phụ cùng Lv.{level}</span><strong>Lv.{supportLevel}/{level} {supportReady ? '✓' : '!'}</strong></p>}
              {isMain && <p className={playerLevelReady ? 'ready' : 'missing'}><span>👤 Cấp tài khoản</span><strong>Lv.{progression?.level ?? 1}/{requiredPlayerLevel} {playerLevelReady ? '✓' : '!'}</strong></p>}
              {!isMain && <p className={mainCapReady ? 'ready' : 'missing'}><span>🏯 Giới hạn từ Nhà Chính</span><strong>Lv.{castle.buildings.main} {mainCapReady ? '✓' : '!'}</strong></p>}
              <p className={hasCoin ? 'ready' : 'missing'}><span>🪙 Coin xây dựng</span><strong>{(progression?.coins ?? 0).toLocaleString('vi-VN')}/{coinCost.toLocaleString('vi-VN')} {hasCoin ? '✓' : '!'}</strong></p>
              <p className={hasWood ? 'ready' : 'missing'}><span>🪵 木材 · Gỗ</span><strong>{castle.wood.toLocaleString('vi-VN')}/{woodCost.toLocaleString('vi-VN')} {hasWood ? '✓' : '!'}</strong></p>
              <p className={hasInk ? 'ready' : 'missing'}><span>🖌 墨 · Mực</span><strong>{castle.ink.toLocaleString('vi-VN')}/{inkCost.toLocaleString('vi-VN')} {hasInk ? '✓' : '!'}</strong></p>
            </div>
            <div className="castle-condition-progress"><i><em style={{ width: `${completedConditions / 7 * 100}%` }} /></i><span>{completedConditions}/7 hoàn tất</span></div>
            {rewardActionError && <p className="castle-upgrade-error">{rewardActionError}</p>}

            {isUpgrading ? (
              <div style={{ margin: '14px 0', padding: '12px 14px', background: 'rgba(245, 159, 0, 0.15)', border: '1px solid #f59f00', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <b style={{ color: '#ffd43b', fontSize: '14px' }}>🔨 Đang thi công nâng cấp...</b>
                  <span style={{ color: '#ffe066', fontWeight: 700 }}>{upgradePct}% (còn {remainingSec}s)</span>
                </div>
                <div style={{ width: '100%', height: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${upgradePct}%`, height: '100%', background: 'linear-gradient(90deg, #f59f00, #ffd43b)', transition: 'width 0.15s linear' }} />
                </div>
                <button
                  type="button"
                  style={{
                    marginTop: 10,
                    width: '100%',
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: '1px solid #34d399',
                    borderRadius: 8,
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleInstantCompleteConstruction(selectedBuilding.id, false)}
                >
                  ⚡ Hoàn thành ngay (Miễn phí thử nghiệm)
                </button>
              </div>
            ) : (
              <button
                className="castle-upgrade-submit"
                disabled={rewardActionStatus === 'loading' || !canUpgrade}
                onClick={() => {
                  setProgression((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      coins: Math.max(0, prev.coins - coinCost),
                      castle: {
                        ...prev.castle,
                        wood: Math.max(0, prev.castle.wood - woodCost),
                        ink: Math.max(0, prev.castle.ink - inkCost),
                      },
                    };
                  });
                  setActiveConstructions((prev) => ({
                    ...prev,
                    [selectedBuilding.id]: {
                      id: selectedBuilding.id,
                      name: selectedBuilding.name,
                      startTime: Date.now(),
                      duration: 10000,
                      type: 'upgrade',
                      targetLevel: level + 1,
                    },
                  }));
                  showCastleToast(`🔨 Bắt đầu thi công nâng cấp [${selectedBuilding.name}] lên Lv.${level + 1} (10s)!`, 'ok');
                }}
              >
                {rewardActionStatus === 'loading' ? 'Đang gửi yêu cầu…' : maxed ? 'Đã đạt cấp tối đa' : canUpgrade ? `Nâng lên Lv.${level + 1} (10s thi công)` : 'Chưa đủ điều kiện'}
              </button>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                className="castle-upgrade-submit"
                style={{
                  flex: 1,
                  background: 'linear-gradient(#f59f00, #d9480f)',
                  borderColor: '#ffd43b',
                  boxShadow: '0 4px 0 #bf360c',
                  marginTop: 0,
                }}
                onClick={() => handleToggleSelectedBuildingFlip(false)}
                title="Lật ngang hướng nhìn của công trình"
              >
                🔄 Lật {curFlipX ? '(Nghịch)' : '(Thuận)'}
              </button>
              <button
                className="castle-upgrade-submit"
                style={{
                  flex: 1,
                  background: 'linear-gradient(#4dabf7, #1c7ed6)',
                  borderColor: '#74c0fc',
                  boxShadow: '0 4px 0 #1864ab',
                  marginTop: 0,
                }}
                onClick={() => {
                  const coreBuildingData: IsoBuildingData = {
                    id: selectedBuilding.id,
                    name: selectedBuilding.name,
                    hanzi: selectedBuilding.hanzi,
                    icon: selectedBuilding.icon,
                    w: selectedBuilding.id === 'main' ? 3 : 2,
                    h: selectedBuilding.id === 'main' ? 3 : 2,
                    col: curCol,
                    row: curRow,
                    flipX: curFlipX,
                    height: selectedBuilding.id === 'main' ? 100 : 70,
                    top: selectedBuilding.id === 'main' ? '#ffd666' : selectedBuilding.id === 'library' ? '#74c0fc' : '#fcc2d7',
                    left: selectedBuilding.id === 'main' ? '#c92a2a' : selectedBuilding.id === 'library' ? '#1c7ed6' : '#d6336c',
                    right: selectedBuilding.id === 'main' ? '#961b1b' : selectedBuilding.id === 'library' ? '#1864ab' : '#a61e4d',
                    outline: selectedBuilding.id === 'main' ? '#7a1f1d' : selectedBuilding.id === 'library' ? '#1971c2' : '#c2255c',
                    imageSrc: `/castle/buildings/${selectedBuilding.id}/stage-${assetStage}.webp`,
                  };
                  setMovingBuildingToPlace(coreBuildingData);
                  setSelectedCastleBuilding(null);
                  showCastleToast(`Đang di chuyển [${selectedBuilding.name}]. Chạm vào ô đất mới để hạ đặt!`, 'ok');
                }}
              >
                🚚 Di chuyển
              </button>
            </div>
            <footer>Thời gian thi công: 10 giây · Giàn giáo 3D, búa nhấp nhô, khói bụi & hiệu ứng Thăng cấp điện ảnh</footer>
          </section></div>;
        })()}
        {/* Modal: Extra Building Inspector & Removal */}
        {selectedExtraBuilding && (() => {
          const constr = activeConstructions[selectedExtraBuilding.id];
          const isUpgrading = Boolean(constr);
          const remainingSec = constr ? Math.max(0, Math.ceil((constr.startTime + constr.duration - Date.now()) / 1000)) : 0;
          const upgradePct = constr ? Math.min(100, Math.round(((Date.now() - constr.startTime) / constr.duration) * 100)) : 0;

          return (
            <div className="castle-modal-backdrop" onClick={() => setSelectedCastleBuilding(null)}>
              <section
                className="castle-upgrade-modal"
                role="dialog"
                aria-modal="true"
                aria-label={selectedExtraBuilding.name}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="castle-upgrade-close"
                  onClick={() => setSelectedCastleBuilding(null)}
                  aria-label="Đóng"
                >
                  ×
                </button>
                <header>
                  <span>{selectedExtraBuilding.w}×{selectedExtraBuilding.h}</span>
                  <div>
                    <small>{selectedExtraBuilding.hanzi}</small>
                    <h2>{selectedExtraBuilding.name}</h2>
                  </div>
                </header>
                <div className="castle-upgrade-preview">
                  {selectedExtraBuilding.imageSrc ? (
                    <img src={selectedExtraBuilding.imageSrc} alt={selectedExtraBuilding.name} />
                  ) : (
                    <b style={{ fontSize: '56px' }}>{selectedExtraBuilding.icon}</b>
                  )}
                  <span>VỊ TRÍ ({selectedExtraBuilding.col}, {selectedExtraBuilding.row})</span>
                </div>
                <div className="castle-upgrade-effect">
                  <b>Độ phồn vinh đóng góp</b>
                  <p>+{(selectedExtraBuilding.prosperity ?? 100).toLocaleString('vi-VN')} 繁荣度</p>
                  <small>Công trình độc lập trên Tiên Đảo. Bạn có thể thu hồi để giải phóng mặt bằng bất kỳ lúc nào.</small>
                </div>

                {isUpgrading && (
                  <div style={{ margin: '14px 0', padding: '12px 14px', background: 'rgba(245, 159, 0, 0.15)', border: '1px solid #f59f00', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <b style={{ color: '#ffd43b', fontSize: '14px' }}>🔨 Đang thi công xây dựng...</b>
                      <span style={{ color: '#ffe066', fontWeight: 700 }}>{upgradePct}% (còn {remainingSec}s)</span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${upgradePct}%`, height: '100%', background: 'linear-gradient(90deg, #f59f00, #ffd43b)', transition: 'width 0.15s linear' }} />
                    </div>
                    <button
                      type="button"
                      style={{
                        marginTop: 10,
                        width: '100%',
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: '1px solid #34d399',
                        borderRadius: 8,
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleInstantCompleteConstruction(selectedExtraBuilding.id, false)}
                    >
                      ⚡ Hoàn thành ngay (Miễn phí thử nghiệm)
                    </button>
                  </div>
                )}

                <div className="castle-upgrade-requirements">
                  <b>Thông tin tháo dỡ</b>
                  <p>
                    <span>🪵 Hoàn trả 50% Gỗ</span>
                    <strong>+{(Math.floor((selectedExtraBuilding.cost?.wood ?? 100) * 0.5)).toLocaleString('vi-VN')}</strong>
                  </p>
                  <p>
                    <span>🪙 Hoàn trả 50% Coin</span>
                    <strong>+{(Math.floor((selectedExtraBuilding.cost?.coin ?? 500) * 0.5)).toLocaleString('vi-VN')}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#f59f00, #d9480f)',
                      borderColor: '#ffd43b',
                      boxShadow: '0 4px 0 #bf360c',
                      marginTop: 0,
                    }}
                    onClick={() => handleToggleSelectedBuildingFlip(false)}
                    title="Lật ngang hướng nhìn của công trình"
                  >
                    🔄 Lật {selectedExtraBuilding.flipX ? '(Nghịch)' : '(Thuận)'}
                  </button>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#4dabf7, #1c7ed6)',
                      borderColor: '#74c0fc',
                      boxShadow: '0 4px 0 #1864ab',
                      marginTop: 0,
                    }}
                    onClick={() => {
                      setMovingBuildingToPlace(selectedExtraBuilding);
                      setSelectedCastleBuilding(null);
                      showCastleToast(`Đang di chuyển [${selectedExtraBuilding.name}]. Chạm vào ô đất mới!`, 'ok');
                    }}
                  >
                    🖐️ Di chuyển
                  </button>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#d33636, #961b1b)',
                      borderColor: '#ea5454',
                      boxShadow: '0 4px 0 #6e1111',
                      marginTop: 0,
                    }}
                    onClick={() => {
                      handleRemoveExtraBuilding(selectedExtraBuilding.id);
                      setSelectedCastleBuilding(null);
                    }}
                  >
                    Thu Hồi
                  </button>
                </div>
              </section>
            </div>
          );
        })()}

        {/* Modal: Building Construction Workshop (Xưởng Xây Dựng Công Trình) */}
        {castleBuildCatalogOpen && (
          <div className="castle-modal-backdrop" onClick={() => setCastleBuildCatalogOpen(false)}>
            <div className="castle-modal-dialog castle-modal-wide" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setCastleBuildCatalogOpen(false)}>×</button>
              <section className="castle-build-panel">
                <header>
                  <div>
                    <span>建筑工坊 · XƯỞNG KIẾN TRÚC</span>
                    <h2>Xưởng Xây Dựng Công Trình</h2>
                  </div>
                  <div className="build-user-res">
                    <span>🪵 <b>{castle.wood.toLocaleString('vi-VN')}</b></span>
                    <span>🖌 <b>{castle.ink.toLocaleString('vi-VN')}</b></span>
                    <span>🪙 <b>{(progression?.coins ?? 0).toLocaleString('vi-VN')}</b></span>
                  </div>
                </header>
                <p className="build-panel-sub">
                  Chọn công trình kiến trúc cổ phong từ thư viện hình ảnh thực tế để lắp đặt lên Tiên Đảo và gia tăng điểm Phồn Vinh!
                </p>
                <div className="build-catalog-tabs">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'palace', label: 'Điện Các' },
                    { id: 'study', label: 'Học Thuật' },
                    { id: 'defense', label: 'Phòng Thủ' },
                    { id: 'nature', label: 'Tiểu Cảnh' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      className={catalogCategory === tab.id ? 'on' : ''}
                      onClick={() => setCatalogCategory(tab.id as any)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="build-catalog-grid">
                  {filteredCatalog.map((item) => {
                    const canAfford =
                      castle.wood >= item.cost.wood &&
                      castle.ink >= item.cost.ink &&
                      (progression?.coins ?? 0) >= item.cost.coin;
                    return (
                      <article key={item.templateId} className="build-catalog-card">
                        <div className="build-card-preview">
                          {item.imageSrc ? (
                            <img src={item.imageSrc} alt={item.name} />
                          ) : (
                            <b style={{ fontSize: '42px' }}>{item.icon}</b>
                          )}
                          <span className="build-card-footprint">{item.w}×{item.h} ô</span>
                        </div>
                        <div className="build-card-body">
                          <div className="build-card-header">
                            <span>{item.hanzi}</span>
                            <h3>{item.name}</h3>
                          </div>
                          <p>{item.desc}</p>
                          <div className="build-card-bonus">
                            <span>✦ +{item.prosperity} 繁荣度</span>
                          </div>
                          <div className="build-card-cost">
                            {item.cost.wood > 0 && <span>🪵 {item.cost.wood}</span>}
                            {item.cost.ink > 0 && <span>🖌 {item.cost.ink}</span>}
                            {item.cost.coin > 0 && <span>🪙 {item.cost.coin.toLocaleString('vi-VN')}</span>}
                          </div>
                          <button
                            disabled={!canAfford}
                            onClick={() => {
                              setPendingBuildingToPlace(item);
                              setCastleBuildCatalogOpen(false);
                              showCastleToast(`Đã chọn [${item.name}] · Chạm vào ô đất trống trên đảo để dựng nhà!`, 'ok');
                            }}
                          >
                            {canAfford ? 'Mua & Lắp Đặt' : 'Chưa đủ tài nguyên'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    );
  }
  if (screen === 'castle-test') {
    const castle = {
      wood: sandboxWood,
      ink: sandboxInk,
      jadeBonusCarry: 0,
      shieldActiveUntil: 0,
      likes: 99,
      theme: sandboxTheme,
      ownedThemes: ['classic', 'moon', 'crimson'],
      attackEnergy: 5,
      attackUpdatedAt: Date.now(),
      peaceUntil: 0,
      newbieUntil: 0,
      buildings: {
        main: sandboxMainLevel * 2 - 1,
        library: sandboxLibraryLevel * 2 - 1,
        listening: sandboxListeningLevel * 2 - 1,
      },
    };
    const castleLevel = Math.max(1, Object.values(castle.buildings).reduce((sum, level) => sum + level, 0) - 2);
    const environmentStage = sandboxEnvStage;
    const environmentNames = [
      '桃源春岛 · Đào Nguyên',
      '月莲水境 · Nguyệt Liên',
      '丹霞秋谷 · Đan Hà',
      '冰川天境 · Băng Thiên',
      '紫晶神域 · Tử Tinh',
    ];
    const extraProsperity = sandboxExtraBuildings.reduce((sum, b) => sum + (b.prosperity ?? 0), 0);
    const prosperity = castleLevel * 250 + extraProsperity;

    const handleSandboxPlace = (newBuilding: IsoBuildingData) => {
      const updated = [...sandboxExtraBuildings, newBuilding];
      setSandboxExtraBuildings(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('castle_sandbox_extra_buildings', JSON.stringify(updated));
      }
      setPendingBuildingToPlace(null);

      // Trigger 10s construction in Sandbox
      setSandboxActiveConstructions((prev) => ({
        ...prev,
        [newBuilding.id]: {
          id: newBuilding.id,
          name: newBuilding.name,
          startTime: Date.now(),
          duration: 10000,
          type: 'build',
          newBuildingData: newBuilding,
        },
      }));
      showCastleToast(`🔨 [Sandbox] Bắt đầu thi công [${newBuilding.name}]! (Thời gian: 10s)`, 'ok');
    };

    const handleSandboxRemove = (id: string) => {
      const updated = sandboxExtraBuildings.filter((item) => item.id !== id);
      setSandboxExtraBuildings(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('castle_sandbox_extra_buildings', JSON.stringify(updated));
      }
      showCastleToast('[Sandbox] Đã xóa công trình khỏi đảo', 'ok');
    };

    const handleSandboxMove = (buildingId: string, newCol: number, newRow: number, newFlipX?: boolean) => {
      if (buildingId === 'main' || buildingId === 'library' || buildingId === 'listening') {
        const nextCore: CoreBuildingPositions = {
          ...sandboxCorePositions,
          [buildingId]: {
            col: newCol,
            row: newRow,
            flipX: newFlipX !== undefined ? newFlipX : sandboxCorePositions[buildingId]?.flipX ?? false,
          },
        };
        setSandboxCorePositions(nextCore);
        if (typeof window !== 'undefined') {
          localStorage.setItem('castle_sandbox_core_positions', JSON.stringify(nextCore));
        }
        setMovingBuildingToPlace(null);
        const nameMap: Record<string, string> = { main: 'Chủ Thành', library: 'Tàng Thư Các', listening: 'Thính Âm Các' };
        showCastleToast(`✨ [Sandbox] Đã di chuyển [${nameMap[buildingId] || buildingId}] đến ô mới (${newCol}, ${newRow})!`, 'ok');
        return;
      }

      const updated = sandboxExtraBuildings.map((b) => {
        if (b.id === buildingId) {
          return {
            ...b,
            col: newCol,
            row: newRow,
            flipX: newFlipX !== undefined ? newFlipX : b.flipX,
          };
        }
        return b;
      });
      setSandboxExtraBuildings(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('castle_sandbox_extra_buildings', JSON.stringify(updated));
      }
      setMovingBuildingToPlace(null);
      showCastleToast('[Sandbox] Đã di chuyển công trình đến ô mới!', 'ok');
    };

    const selectedExtraBuilding = selectedCastleBuilding
      ? sandboxExtraBuildings.find((b) => b.id === selectedCastleBuilding)
      : null;

    const filteredCatalog = catalogCategory === 'all'
      ? BUILDING_CATALOG
      : BUILDING_CATALOG.filter((item) => item.category === catalogCategory);

    return (
      <main className={`app castle-fullscreen-app castle-theme-${castle.theme} castle-sandbox-screen`}>

        {/* Top Floating Sandbox Control Bar */}
        <header className="castle-top-hud castle-sandbox-hud">
          <div className="castle-hud-left">
            <button
              className="castle-hud-back castle-sandbox-exit-btn"
              onClick={() => navigate('castle')}
              title="Thoát phòng thí nghiệm và quay lại Game chính"
            >
              <ChevronLeft size={18} />
              <span>Về Game Chính</span>
            </button>
            <div className="sandbox-badge-banner">
              <span className="sandbox-tag">DEV SANDBOX</span>
              <b>PHÒNG THÍ NGHIỆM TIÊN ĐẢO</b>
              <small>Dữ liệu độc lập · Không ảnh hưởng tài khoản</small>
            </div>
          </div>

          <div className="castle-hud-resources">
            <div className="hud-res-pill">🪵 <b>{sandboxWood.toLocaleString('vi-VN')}</b></div>
            <div className="hud-res-pill">🖌 <b>{sandboxInk.toLocaleString('vi-VN')}</b></div>
            <div className="hud-res-pill">🪙 <b>{sandboxCoins.toLocaleString('vi-VN')}</b></div>
            <div className="hud-res-pill">✨ <b>{prosperity.toLocaleString('vi-VN')} 繁荣</b></div>
          </div>

          <div className="castle-hud-right">
            <button
              className="castle-hud-realm-badge"
              onClick={() => setRealmInfoOpen((prev) => !prev)}
              title="Xem thông tin cảnh giới"
            >
              <small>CẢNH GIỚI {environmentStage}/5</small>
              <b>{environmentNames[environmentStage - 1].split(' · ')[1]}</b>
            </button>
          </div>
        </header>

        {/* Floating Quick Cheat Panel */}
        <aside className="sandbox-floating-panel" aria-label="Bảng điều khiển Sandbox">
          <div className="sandbox-panel-header">
            <span>🛠️ BẢNG ĐIỀU KHIỂN THỬ NGHIỆM</span>
          </div>

          <div className="sandbox-panel-section">
            <label>Cấp Chủ Thành (Main Palace Sprite 1–5):</label>
            <div className="sandbox-btn-row">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  className={sandboxMainLevel === lvl ? 'active' : ''}
                  onClick={() => {
                    setSandboxMainLevel(lvl);
                    showCastleToast(`Chủ Thành đã chuyển sang Cấp ${lvl}`);
                  }}
                >
                  Lv.{lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="sandbox-panel-section">
            <label>Cảnh Giới Tiên Đảo (Environment Stage 1–5):</label>
            <div className="sandbox-btn-row">
              {[1, 2, 3, 4, 5].map((stg) => (
                <button
                  key={stg}
                  className={sandboxEnvStage === stg ? 'active' : ''}
                  onClick={() => {
                    setSandboxEnvStage(stg);
                    showCastleToast(`Cảnh giới đã đổi: ${environmentNames[stg - 1].split(' · ')[1]}`);
                  }}
                >
                  Stage {stg}
                </button>
              ))}
            </div>
          </div>

          <div className="sandbox-panel-section">
            <label>Chủ Đề (Theme Pack):</label>
            <div className="sandbox-btn-row">
              {[
                { id: 'classic', label: 'Cổ Điển' },
                { id: 'moon', label: 'Nguyệt Dạ' },
                { id: 'crimson', label: 'Xích Hà' },
              ].map((t) => (
                <button
                  key={t.id}
                  className={sandboxTheme === t.id ? 'active' : ''}
                  onClick={() => {
                    setSandboxTheme(t.id);
                    showCastleToast(`Đã chọn Theme: ${t.label}`);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sandbox-panel-section">
            <label>Bơm Tài Nguyên (Cheat Resources):</label>
            <div className="sandbox-btn-row">
              <button onClick={() => { setSandboxWood((w) => w + 10000); showCastleToast('+10,000 Gỗ'); }}>+10k 🪵</button>
              <button onClick={() => { setSandboxInk((i) => i + 10000); showCastleToast('+10,000 Mực'); }}>+10k 🖌</button>
              <button onClick={() => { setSandboxCoins((c) => c + 100000); showCastleToast('+100,000 Coin'); }}>+100k 🪙</button>
              <button onClick={() => { setSandboxWood(1000); setSandboxInk(1000); setSandboxCoins(10000); showCastleToast('Đã reset tài nguyên'); }}>Reset</button>
            </div>
          </div>

          <div className="sandbox-panel-section">
            <label>Kịch Bản Mẫu (Presets Bố Cục):</label>
            <div className="sandbox-btn-row presets-row">
              {Object.entries(SANDBOX_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSandboxExtraBuildings(preset.buildings);
                    localStorage.setItem('castle_sandbox_extra_buildings', JSON.stringify(preset.buildings));
                    showCastleToast(`Đã nạp kịch bản: ${preset.label.split(' (')[0]}`, 'ok');
                  }}
                >
                  {preset.label.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="sandbox-panel-section">
            <label>🎬 Diễn Hoạt & State Machine:</label>
            <div className="sandbox-btn-row">
              <button
                style={{
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  borderColor: '#f59e0b',
                  color: '#fff',
                  fontWeight: 900,
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                }}
                onClick={() => {
                  const target = selectedCastleBuilding || 'main';
                  setCastleBurstBuildingId(target);
                  setCastleBurstText('+1 CẤP · THĂNG CẤP!');
                  showCastleToast(`✨ Đã bắn hiệu ứng Level-Up Burst trên [${target}]!`);
                }}
                title="Bắn hiệu ứng thăng cấp điện ảnh: Co 0.9x -> Chớp trắng -> Hạt sao vàng -> Overshoot 1.08x -> Chữ bay -> Rung camera"
              >
                🌟 Bắn Burst
              </button>
              <button
                className={sandboxAnimState === 'upgrading' ? 'active' : ''}
                onClick={() => {
                  const next = sandboxAnimState === 'upgrading' ? 'idle' : 'upgrading';
                  setSandboxAnimState(next);
                  showCastleToast(next === 'upgrading' ? '🔨 Đã bật Giàn giáo 3D, búa nhấp nhô & thanh tiến độ' : 'Đã về trạng thái Idle');
                }}
                title="Bật/tắt giàn giáo gỗ/tre, búa đập nhấp nhô và thanh % tiến độ lơ lửng"
              >
                🔨 Giàn giáo
              </button>
              <button
                className={sandboxIdleFx ? 'active' : ''}
                onClick={() => {
                  const next = !sandboxIdleFx;
                  setSandboxIdleFx(next);
                  showCastleToast(next ? '💨 Đã bật khói nóc lầu & tiên khí' : 'Đã tắt khói & tiên khí');
                }}
                title="Bật/tắt khói bay từ nóc các lầu điện và hào quang tiên khí"
              >
                💨 Khói bay
              </button>
            </div>
          </div>

          <div className="sandbox-panel-section">
            <label>⚔️ Chiến Đấu & Thủ Thành 2.5D:</label>
            <div className="sandbox-btn-row">
              <button
                className="sandbox-combat-btn-cannon"
                onClick={() => {
                  const target = selectedCastleBuilding || 'main';
                  setCastleCombatTrigger({
                    type: 'cannon',
                    targetBuildingId: target,
                    id: Date.now(),
                  });
                  showCastleToast(`💣 Bắn pháo oanh kích [${target}]!`);
                }}
                title="Bắn pháo công thành theo quỹ đạo parabol 2.5D (Nổ lửa, đất rung, chớp đỏ)"
              >
                💣 Bắn Pháo
              </button>
              <button
                className={`sandbox-combat-btn-shield ${sandboxShieldActive ? 'active' : ''}`}
                onClick={() => {
                  const next = !sandboxShieldActive;
                  setSandboxShieldActive(next);
                  showCastleToast(next ? '🛡️ Đã bật Vòm Khiên Hộ Thành!' : 'Đã tắt Vòm Khiên Hộ Thành');
                }}
                title="Bật/Tắt Vòm Khiên Hộ Thành 2.5D (Quầng Fresnel, phù chú bảo hộ, lưới lục giác)"
              >
                🛡️ {sandboxShieldActive ? 'Khiên: BẬT' : 'Khiên: TẮT'}
              </button>
              <button
                className="sandbox-combat-btn-hit"
                onClick={() => {
                  setSandboxShieldActive(true);
                  setCastleCombatTrigger({
                    type: 'shield_hit',
                    id: Date.now(),
                  });
                  showCastleToast('💥 Bắn thẳng vào vòm khiên! Sóng xung kích lục giác tỏa rộng!');
                }}
                title="Thử nghiệm đạn pháo va chạm trên mặt khiên và sinh sóng chấn động lục giác"
              >
                💥 Bắn Vào Khiên
              </button>
              <button
                className="sandbox-combat-btn-shatter"
                onClick={() => {
                  setSandboxShieldActive(false);
                  setCastleCombatTrigger({
                    type: 'shatter',
                    id: Date.now(),
                  });
                  showCastleToast('⚡ Khiên Hộ Thành vỡ nát thành muôn mảnh pha lê!');
                }}
                title="Kích hoạt vỡ vụn khiên thành mảnh pha lê phát sáng"
              >
                ⚡ Nổ Vỡ Khiên
              </button>
            </div>
          </div>
        </aside>

        {/* Floating Toast Notification */}
        {castleToast && (
          <div className={`castle-toast ${castleToast.kind === 'bad' ? 'bad' : 'ok'}`}>
            <span>{castleToast.kind === 'bad' ? '⚠️' : '✦'}</span>
            <p>{castleToast.msg}</p>
          </div>
        )}

        {/* Floating Placement Helper Banner */}
        {pendingBuildingToPlace && (
          <aside className="castle-placement-bar">
            <div className="placement-bar-info">
              <b>Đang xây: {pendingBuildingToPlace.name} ({pendingBuildingToPlace.w}×{pendingBuildingToPlace.h} ô)</b>
              <small>Chạm vào ô đất còn trống để xây · Phím R: Lật hướng {pendingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}</small>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="placement-flip-btn"
                onClick={handleTogglePendingFlip}
                title="Lật ngang hướng công trình (Phím R)"
              >
                🔄 Lật {pendingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}
              </button>
              <button className="placement-cancel-btn" onClick={() => setPendingBuildingToPlace(null)}>
                ✕ Hủy bỏ
              </button>
            </div>
          </aside>
        )}

        {/* Floating Movement Helper Banner */}
        {movingBuildingToPlace && (
          <aside className="castle-placement-bar">
            <div className="placement-bar-info">
              <b>Đang di chuyển: {movingBuildingToPlace.name} ({movingBuildingToPlace.w}×{movingBuildingToPlace.h} ô)</b>
              <small>Chạm vào ô đất mới để hạ đặt · Phím R: Lật hướng {movingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}</small>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="placement-flip-btn"
                onClick={handleToggleMovingFlip}
                title="Lật ngang hướng công trình (Phím R)"
              >
                🔄 Lật {movingBuildingToPlace.flipX ? '(Nghịch)' : '(Thuận)'}
              </button>
              <button className="placement-cancel-btn" onClick={() => setMovingBuildingToPlace(null)}>
                ✕ Hủy bỏ
              </button>
            </div>
          </aside>
        )}

        {/* 2.5D Isometric Fullscreen Canvas */}
        <CastleIsoCanvas
          castle={castle}
          environmentStage={environmentStage}
          selectedBuildingId={selectedCastleBuilding}
          onSelectBuilding={(buildingId) => setSelectedCastleBuilding(buildingId)}
          showGrid={castleShowGrid}
          calibration={islandCalibration}
          showDebugGrid={showDebugGrid}
          extraBuildings={sandboxExtraBuildings}
          pendingBuilding={pendingBuildingToPlace}
          onPlacedBuilding={handleSandboxPlace}
          onRemoveBuilding={handleSandboxRemove}
          onCancelPlacement={() => setPendingBuildingToPlace(null)}
          movingBuilding={movingBuildingToPlace}
          onConfirmMove={handleSandboxMove}
          onCancelMove={() => setMovingBuildingToPlace(null)}
          onToggleFlip={() => handleGlobalToggleFlip(true)}
          onToast={showCastleToast}
          burstBuildingId={castleBurstBuildingId}
          burstText={castleBurstText}
          onBurstComplete={() => setCastleBurstBuildingId(null)}
          enableIdleFx={sandboxIdleFx}
          shieldActive={sandboxShieldActive}
          combatFxTrigger={castleCombatTrigger}
          corePositions={sandboxCorePositions}
          buildingAnimStates={sandboxBuildingAnimStates}
        />

        {/* Bottom Floating Action Dock */}
        <footer className="castle-bottom-dock">
          <div className="dock-group dock-tools">
            <button
              className={`dock-item tool-item ${castleShowGrid ? 'active' : ''}`}
              onClick={() => {
                const next = !castleShowGrid;
                setCastleShowGrid(next);
                showCastleToast(next ? 'Đã bật lưới toạ độ' : 'Đã tắt lưới toạ độ');
              }}
              title="Bật/tắt lưới toạ độ"
            >
              <i>📐</i>
              <span>Lưới</span>
            </button>
            <button
              className="dock-item tool-item"
              onClick={() => {
                setSandboxWood((w) => w + 50000);
                setSandboxInk((i) => i + 50000);
                setSandboxCoins((c) => c + 500000);
                showCastleToast('Đã nạp thêm +50k tài nguyên!');
              }}
              title="Bơm thêm tài nguyên thử nghiệm"
            >
              <i>⚡</i>
              <span>Bơm quà</span>
            </button>
            <button
              className="dock-item tool-item"
              onClick={() => setCastleBuildCatalogOpen(true)}
              title="Mở Xưởng Kiến Trúc để mua thêm các công trình"
            >
              <i>🏛️</i>
              <span>Công trình</span>
            </button>
            {pendingBuildingToPlace ? (
              <button
                className="dock-item tool-item active"
                onClick={() => {
                  setPendingBuildingToPlace(null);
                  showCastleToast('Đã hủy chế độ đặt');
                }}
                title="Hủy đặt công trình"
              >
                <i>✕</i>
                <span>Hủy đặt</span>
              </button>
            ) : (
              <button
                className="dock-item tool-item"
                onClick={() => setCastleBuildCatalogOpen(true)}
                title="Chọn kiến trúc để lắp đặt"
              >
                <i>🏗️</i>
                <span>Xây mới</span>
              </button>
            )}
            <button
              className="dock-item tool-item"
              onClick={() => {
                setSandboxExtraBuildings([]);
                localStorage.setItem('castle_sandbox_extra_buildings', JSON.stringify([]));
                showCastleToast('Đã dọn sạch toàn bộ công trình phụ trên đảo');
              }}
              title="Dọn sạch toàn bộ công trình phụ"
            >
              <i>🗑️</i>
              <span>Dọn sạch</span>
            </button>
          </div>
        </footer>

        {/* Modal: Sandbox Core Building Inspector & Repositioning */}
        {selectedCastleBuilding && ['main', 'library', 'listening'].includes(selectedCastleBuilding) && (() => {
          const coreKey = selectedCastleBuilding as 'main' | 'library' | 'listening';
          const names: Record<string, { name: string; hanzi: string; icon: string; w: number; h: number }> = {
            main: { name: 'Chủ Thành', hanzi: '主城', icon: '🏯', w: 3, h: 3 },
            library: { name: 'Tàng Thư Các', hanzi: '藏书阁', icon: '📚', w: 2, h: 2 },
            listening: { name: 'Thính Âm Các', hanzi: '听音阁', icon: '🔔', w: 2, h: 2 },
          };
          const info = names[coreKey];
          const level = coreKey === 'main' ? sandboxMainLevel : coreKey === 'library' ? sandboxLibraryLevel : sandboxListeningLevel;
          const visualStage = castleVisualStage(level);
          const assetStage = coreKey === 'main' ? visualStage : 1;
          const pos = sandboxCorePositions[coreKey];
          const curCol = pos?.col ?? (coreKey === 'main' ? 4 : coreKey === 'library' ? 1 : 8);
          const curRow = pos?.row ?? 4;
          const curFlipX = pos?.flipX ?? false;

          const constr = sandboxActiveConstructions[coreKey];
          const isUpgrading = Boolean(constr);
          const remainingSec = constr ? Math.max(0, Math.ceil((constr.startTime + constr.duration - Date.now()) / 1000)) : 0;
          const upgradePct = constr ? Math.min(100, Math.round(((Date.now() - constr.startTime) / constr.duration) * 100)) : 0;

          return (
            <div className="castle-modal-backdrop" onClick={() => setSelectedCastleBuilding(null)}>
              <section
                className="castle-upgrade-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`[Sandbox] ${info.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="castle-upgrade-close"
                  onClick={() => setSelectedCastleBuilding(null)}
                  aria-label="Đóng"
                >
                  ×
                </button>
                <header>
                  <span>Lv.{level}</span>
                  <div>
                    <small>{info.hanzi}</small>
                    <h2>{info.name} (Cốt Lõi)</h2>
                  </div>
                </header>
                <div className="castle-upgrade-preview">
                  <img src={`/castle/buildings/${coreKey}/stage-${assetStage}.webp`} alt={info.name} />
                  <span>VỊ TRÍ ({curCol}, {curRow}) · KÍCH THƯỚC {info.w}×{info.h}</span>
                </div>
                <div className="castle-upgrade-effect">
                  <b>[Sandbox] Công Trình Cốt Lõi</b>
                  <p>Bạn có thể tự do di chuyển, đổi hướng nhìn (Flip X), và thử nghiệm tiến trình thi công 10s.</p>
                </div>

                {isUpgrading && (
                  <div style={{ margin: '14px 0', padding: '12px 14px', background: 'rgba(245, 159, 0, 0.15)', border: '1px solid #f59f00', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <b style={{ color: '#ffd43b', fontSize: '14px' }}>🔨 Đang thi công nâng cấp...</b>
                      <span style={{ color: '#ffe066', fontWeight: 700 }}>{upgradePct}% (còn {remainingSec}s)</span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${upgradePct}%`, height: '100%', background: 'linear-gradient(90deg, #f59f00, #ffd43b)', transition: 'width 0.15s linear' }} />
                    </div>
                    <button
                      type="button"
                      style={{
                        marginTop: 10,
                        width: '100%',
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: '1px solid #34d399',
                        borderRadius: 8,
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleInstantCompleteConstruction(coreKey, true)}
                    >
                      ⚡ Hoàn thành ngay (Sandbox)
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#f59f00, #d9480f)',
                      borderColor: '#ffd43b',
                      boxShadow: '0 4px 0 #bf360c',
                      marginTop: 0,
                    }}
                    onClick={() => handleToggleSelectedBuildingFlip(true)}
                    title="Lật ngang hướng nhìn của công trình"
                  >
                    🔄 Lật {curFlipX ? '(Nghịch)' : '(Thuận)'}
                  </button>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#4dabf7, #1c7ed6)',
                      borderColor: '#74c0fc',
                      boxShadow: '0 4px 0 #1864ab',
                      marginTop: 0,
                    }}
                    onClick={() => {
                      const coreBuildingData: IsoBuildingData = {
                        id: coreKey,
                        name: info.name,
                        hanzi: info.hanzi,
                        icon: info.icon,
                        w: info.w,
                        h: info.h,
                        col: curCol,
                        row: curRow,
                        flipX: curFlipX,
                        height: coreKey === 'main' ? 100 : 70,
                        top: coreKey === 'main' ? '#ffd666' : coreKey === 'library' ? '#74c0fc' : '#fcc2d7',
                        left: coreKey === 'main' ? '#c92a2a' : coreKey === 'library' ? '#1c7ed6' : '#d6336c',
                        right: coreKey === 'main' ? '#961b1b' : coreKey === 'library' ? '#1864ab' : '#a61e4d',
                        outline: coreKey === 'main' ? '#7a1f1d' : coreKey === 'library' ? '#1971c2' : '#c2255c',
                        imageSrc: `/castle/buildings/${coreKey}/stage-${assetStage}.webp`,
                      };
                      setMovingBuildingToPlace(coreBuildingData);
                      setSelectedCastleBuilding(null);
                      showCastleToast(`[Sandbox] Đang di chuyển [${info.name}]. Chạm vào ô đất mới để hạ đặt!`, 'ok');
                    }}
                  >
                    🚚 Di chuyển
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: isUpgrading ? '#495057' : 'linear-gradient(#20c997, #099268)',
                      borderColor: '#38d9a9',
                      boxShadow: '0 4px 0 #087f5b',
                      marginTop: 0,
                    }}
                    disabled={isUpgrading}
                    onClick={() => {
                      setSandboxActiveConstructions((prev) => ({
                        ...prev,
                        [coreKey]: {
                          id: coreKey,
                          name: info.name,
                          startTime: Date.now(),
                          duration: 10000,
                          type: 'upgrade',
                          targetLevel: Math.min(10, level + 1),
                        },
                      }));
                      showCastleToast(`🔨 [Sandbox] Bắt đầu thi công nâng cấp [${info.name}] (10s)!`, 'ok');
                    }}
                  >
                    {isUpgrading ? '🔨 Đang thi công…' : `⬆️ Nâng cấp (10s thi công)`}
                  </button>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#e599f7, #ae3ec9)',
                      borderColor: '#f783ac',
                      boxShadow: '0 4px 0 #862e9c',
                      marginTop: 0,
                    }}
                    onClick={() => {
                      setCastleBurstBuildingId(coreKey);
                      setCastleBurstText('+1 CẤP · THĂNG CẤP!');
                      showCastleToast(`✨ Đã bắn hiệu ứng Level-Up Burst trên [${info.name}]!`);
                    }}
                  >
                    🌟 Bắn Burst
                  </button>
                </div>
              </section>
            </div>
          );
        })()}

        {/* Modal: Extra Building Inspector & Removal */}
        {selectedExtraBuilding && (() => {
          const constr = sandboxActiveConstructions[selectedExtraBuilding.id];
          const isUpgrading = Boolean(constr);
          const remainingSec = constr ? Math.max(0, Math.ceil((constr.startTime + constr.duration - Date.now()) / 1000)) : 0;
          const upgradePct = constr ? Math.min(100, Math.round(((Date.now() - constr.startTime) / constr.duration) * 100)) : 0;

          return (
            <div className="castle-modal-backdrop" onClick={() => setSelectedCastleBuilding(null)}>
              <section
                className="castle-upgrade-modal"
                role="dialog"
                aria-modal="true"
                aria-label={selectedExtraBuilding.name}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="castle-upgrade-close"
                  onClick={() => setSelectedCastleBuilding(null)}
                  aria-label="Đóng"
                >
                  ×
                </button>
                <header>
                  <span>{selectedExtraBuilding.w}×{selectedExtraBuilding.h}</span>
                  <div>
                    <small>{selectedExtraBuilding.hanzi}</small>
                    <h2>{selectedExtraBuilding.name}</h2>
                  </div>
                </header>
                <div className="castle-upgrade-preview">
                  {selectedExtraBuilding.imageSrc ? (
                    <img src={selectedExtraBuilding.imageSrc} alt={selectedExtraBuilding.name} />
                  ) : (
                    <b style={{ fontSize: '56px' }}>{selectedExtraBuilding.icon}</b>
                  )}
                  <span>VỊ TRÍ ({selectedExtraBuilding.col}, {selectedExtraBuilding.row})</span>
                </div>
                <div className="castle-upgrade-effect">
                  <b>[Sandbox] Thử nghiệm công trình</b>
                  <p>+{(selectedExtraBuilding.prosperity ?? 100).toLocaleString('vi-VN')} 繁荣度</p>
                  <small>Bạn đang ở chế độ Sandbox. Bạn có thể xóa công trình này bất kỳ lúc nào.</small>
                </div>

                {isUpgrading && (
                  <div style={{ margin: '14px 0', padding: '12px 14px', background: 'rgba(245, 159, 0, 0.15)', border: '1px solid #f59f00', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <b style={{ color: '#ffd43b', fontSize: '14px' }}>🔨 Đang thi công xây dựng...</b>
                      <span style={{ color: '#ffe066', fontWeight: 700 }}>{upgradePct}% (còn {remainingSec}s)</span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: 'rgba(0,0,0,0.5)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${upgradePct}%`, height: '100%', background: 'linear-gradient(90deg, #f59f00, #ffd43b)', transition: 'width 0.15s linear' }} />
                    </div>
                    <button
                      type="button"
                      style={{
                        marginTop: 10,
                        width: '100%',
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: '1px solid #34d399',
                        borderRadius: 8,
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleInstantCompleteConstruction(selectedExtraBuilding.id, true)}
                    >
                      ⚡ Hoàn thành ngay (Sandbox)
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#f59f00, #d9480f)',
                      borderColor: '#ffd43b',
                      boxShadow: '0 4px 0 #bf360c',
                      marginTop: 0,
                    }}
                    onClick={() => handleToggleSelectedBuildingFlip(true)}
                    title="Lật ngang hướng nhìn của công trình"
                  >
                    🔄 Lật {selectedExtraBuilding.flipX ? '(Nghịch)' : '(Thuận)'}
                  </button>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#4dabf7, #1c7ed6)',
                      borderColor: '#74c0fc',
                      boxShadow: '0 4px 0 #1864ab',
                      marginTop: 0,
                    }}
                    onClick={() => {
                      setMovingBuildingToPlace(selectedExtraBuilding);
                      setSelectedCastleBuilding(null);
                      showCastleToast(`[Sandbox] Đang di chuyển [${selectedExtraBuilding.name}]. Chạm vào ô đất mới!`, 'ok');
                    }}
                  >
                    🖐️ Di chuyển
                  </button>
                  <button
                    className="castle-upgrade-submit"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(#d33636, #961b1b)',
                      borderColor: '#ea5454',
                      boxShadow: '0 4px 0 #6e1111',
                      marginTop: 0,
                    }}
                    onClick={() => {
                      handleSandboxRemove(selectedExtraBuilding.id);
                      setSelectedCastleBuilding(null);
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </section>
            </div>
          );
        })()}

        {/* Modal: Building Construction Workshop */}
        {castleBuildCatalogOpen && (
          <div className="castle-modal-backdrop" onClick={() => setCastleBuildCatalogOpen(false)}>
            <div className="castle-modal-dialog castle-modal-wide" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setCastleBuildCatalogOpen(false)}>×</button>
              <section className="castle-build-panel">
                <header>
                  <div>
                    <span>建筑工坊 · XƯỞNG KIẾN TRÚC (SANDBOX)</span>
                    <h2>Xưởng Xây Dựng Công Trình</h2>
                  </div>
                  <div className="build-user-res">
                    <span>🪵 <b>{sandboxWood.toLocaleString('vi-VN')}</b></span>
                    <span>🖌 <b>{sandboxInk.toLocaleString('vi-VN')}</b></span>
                    <span>🪙 <b>{sandboxCoins.toLocaleString('vi-VN')}</b></span>
                  </div>
                </header>
                <p className="build-panel-sub">
                  Chế độ Sandbox: Bạn có thể chọn bất kỳ công trình nào để thử nghiệm cách hiển thị, sprite ảnh, và thuật toán va chạm trên Tiên Đảo!
                </p>
                <div className="build-catalog-tabs">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'palace', label: 'Điện Các' },
                    { id: 'study', label: 'Học Thuật' },
                    { id: 'defense', label: 'Phòng Thủ' },
                    { id: 'nature', label: 'Tiểu Cảnh' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      className={catalogCategory === tab.id ? 'on' : ''}
                      onClick={() => setCatalogCategory(tab.id as any)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="build-catalog-grid">
                  {filteredCatalog.map((item) => (
                    <article key={item.templateId} className="build-catalog-card">
                      <div className="build-card-preview">
                        {item.imageSrc ? (
                          <img src={item.imageSrc} alt={item.name} />
                        ) : (
                          <b style={{ fontSize: '42px' }}>{item.icon}</b>
                        )}
                        <span className="build-card-footprint">{item.w}×{item.h} ô</span>
                      </div>
                      <div className="build-card-body">
                        <div className="build-card-header">
                          <span>{item.hanzi}</span>
                          <h3>{item.name}</h3>
                        </div>
                        <p>{item.desc}</p>
                        <div className="build-card-bonus">
                          <span>✦ +{item.prosperity} 繁荣度</span>
                        </div>
                        <div className="build-card-cost">
                          {item.cost.wood > 0 && <span>🪵 {item.cost.wood}</span>}
                          {item.cost.ink > 0 && <span>🖌 {item.cost.ink}</span>}
                          {item.cost.coin > 0 && <span>🪙 {item.cost.coin.toLocaleString('vi-VN')}</span>}
                        </div>
                        <button
                          onClick={() => {
                            setPendingBuildingToPlace(item);
                            setCastleBuildCatalogOpen(false);
                            showCastleToast(`Đã chọn [${item.name}] · Chạm vào ô đất trống trên đảo để dựng nhà!`, 'ok');
                          }}
                        >
                          Lắp Đặt Thử Nghiệm
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    );
  }
  if (screen === 'codex') {
    const uniqueVocabulary = Array.from(new globalThis.Map(allVocabulary.map((entry) => [entry[0], entry])).values());
    const discovered = new Set(progression?.discoveries ?? []);
    const normalizedCodexQuery = normalizeAnswer(codexQuery);
    const atlasEntries = uniqueVocabulary.filter((entry) => !normalizedCodexQuery || entry.some((value) => normalizeAnswer(value).includes(normalizedCodexQuery)));
    return (
      <main className="app codex-page">
        {historyControls}{mobileNavigation}
        <header><button className="brand" onClick={() => navigate('home')}><span>汉</span><b>Hanzi Beat<small>Hán Tự Đồ Giám</small></b></button><button className="leaderboard-back" onClick={() => navigate('home')}>Về trang chủ</button></header>
        <section className="codex-panel">
          <div className="codex-hero"><div><span className="eyebrow"><BookOpen /> 汉字图鉴 · HÁN TỰ ĐỒ GIÁM</span><h1>Biến mỗi trận đấu thành một trang sưu tập.</h1><p>Gặp từ trong Offline, Daily hoặc PvP để ghi danh vào Đồ Giám.</p></div><div className="codex-progress"><b>{discovered.size}</b><span>/ {uniqueVocabulary.length} từ đã khám phá</span><i><em style={{ width: `${Math.min(100, discovered.size / uniqueVocabulary.length * 100)}%` }} /></i></div></div>
          {!authUser ? <div className="inventory-login"><BookOpen /><h2>Đồ Giám cần tài khoản</h2><p>Đăng nhập để lưu từ đã gặp và mở khóa Ngọc Bội.</p><button onClick={() => navigate('auth')}>Đăng nhập</button></div> : <>
            <div className="codex-tabs"><button className={codexTab === 'atlas' ? 'on' : ''} onClick={() => setCodexTab('atlas')}><BookOpen /> Đồ Giám</button><button className={codexTab === 'collections' ? 'on' : ''} onClick={() => setCodexTab('collections')}><Package /> Bộ sưu tập</button><button className={codexTab === 'journey' ? 'on' : ''} onClick={() => setCodexTab('journey')}><MapIcon /> Hành trình</button></div>
            {codexTab === 'atlas' && <><div className="codex-search"><input value={codexQuery} onChange={(event) => setCodexQuery(event.target.value)} placeholder="Tìm chữ Hán, pinyin hoặc nghĩa..." /><span>{atlasEntries.filter((entry) => discovered.has(entry[0])).length} đã mở</span></div><div className="atlas-grid">{atlasEntries.map((entry) => { const unlocked = discovered.has(entry[0]); return <article key={entry[0]} className={unlocked ? 'unlocked' : 'locked'}><span>{entry[4]}</span><h2>{unlocked ? entry[0] : '？'}</h2><b>{unlocked ? entry[1] : 'Chưa khám phá'}</b><p>{unlocked ? entry[3] : 'Gặp từ này trong một trận đấu để mở khóa.'}</p>{unlocked && <button onClick={() => speak(entry[0])}><Volume2 /> Nghe</button>}</article>; })}</div></>}
            {codexTab === 'collections' && <div className="collection-sections">
              <section><div className="inventory-heading"><div><span className="eyebrow">THEO CẤP ĐỘ</span><h2>Bộ sưu tập HSK</h2></div></div><div className="collection-grid">{[1,2,3,4].map((level) => { const entries = uniqueVocabulary.filter((entry) => entry[4] === `HSK ${level}`); const count = entries.filter((entry) => discovered.has(entry[0])).length; return <article key={level}><strong>HSK {level}</strong><b>{count}/{entries.length}</b><i><em style={{width:`${entries.length ? count / entries.length * 100 : 0}%`}} /></i><small>{count === entries.length ? 'HOÀN TẤT' : 'Đang sưu tập'}</small></article>; })}</div></section>
              <section><div className="inventory-heading"><div><span className="eyebrow">THEO CHỦ ĐỀ</span><h2>Chuyên tập</h2></div></div><div className="collection-grid topic-grid">{topicGroups.map((topic) => { const entries = uniqueVocabulary.filter(topic.test); const count = entries.filter((entry) => discovered.has(entry[0])).length; return <article key={topic.name}><strong>{topic.icon} {topic.name}</strong><b>{count}/{entries.length}</b><i><em style={{width:`${entries.length ? count / entries.length * 100 : 0}%`}} /></i><small>TẬP CHỦ ĐỀ</small></article>; })}</div></section>
              <section><div className="inventory-heading"><div><span className="eyebrow">THEO BỘ THỦ</span><h2>Dấu vết cấu tạo</h2></div></div><div className="radical-grid">{radicalGroups.map((group) => { const entries = uniqueVocabulary.filter((entry) => group.test(entry[0])); const count = entries.filter((entry) => discovered.has(entry[0])).length; return <article key={group.radical}><b>{group.radical}</b><span>{group.name}</span><small>{count}/{entries.length} đã gặp</small></article>; })}</div></section>
              <section><div className="inventory-heading"><div><span className="eyebrow">DI VẬT HIẾM</span><h2>Ngọc Bội</h2></div></div><div className="relic-grid">{jadeRelics.map((relic) => { const owned = progression?.jadeRelics.includes(relic.id); return <article key={relic.id} className={owned ? 'owned' : 'locked'}><img src={relic.image} alt={relic.name}/><span>{owned ? 'ĐÃ THỨC TỈNH' : `${Math.min(discovered.size,relic.threshold)}/${relic.threshold}`}</span><h3>{relic.name}</h3><small>{relic.hanzi}</small><p>Khám phá {relic.threshold} từ khác nhau để mở khóa.</p></article>; })}</div></section>
            </div>}
            {codexTab === 'journey' && <div className="journey-map"><div className="journey-road" />{Array.from({length:9},(_,index)=>index+1).map((level) => { const entries = uniqueVocabulary.filter((entry) => entry[4] === `HSK ${level}`); const count = entries.filter((entry) => discovered.has(entry[0])).length; const available = entries.length > 0; const unlocked = available && (level === 1 || (progression?.level ?? 1) >= level * 2); return <article key={level} className={`${unlocked ? 'unlocked' : 'locked'} ${!available ? 'future' : ''}`}><div>{unlocked ? level : '锁'}</div><span>CHƯƠNG {level}</span><h2>HSK {level}</h2><p>{available ? `${count}/${entries.length} từ đã khám phá` : 'Sắp ra mắt'}</p>{available && <i><em style={{width:`${entries.length ? count / entries.length * 100 : 0}%`}} /></i>}</article>; })}</div>}
          </>}
        </section>
      </main>
    );
  }
  if (screen === 'inventory') {
    const itemDefinitions = [
      { id: 'daily-seal', type: 'collectible', name: 'Nhật Ấn', hanzi: '每日印章', image: '/items/daily-seal.png', rarity: 'Hiếm', description: 'Dấu chứng nhận hoàn thành ít nhất 3 mục tiêu trong ngày.' },
      { id: 'daily-chest', type: 'chest', name: 'Rương Hằng Ngày', hanzi: '每日宝箱', image: '/items/daily-chest.png', rarity: 'Hiếm', description: 'Mở để nhận 5–8 Mảnh Ngọc, 30 XP và cơ hội nhận cosmetic.' },
      { id: 'streak-guard', type: 'guard', name: 'Hộ Ấn', hanzi: '护印', image: '/items/shop-streak-guard.png', rarity: 'Sử thi', description: 'Tự động cứu streak khi bỏ lỡ đúng một ngày. Hồi 7 ngày.' },
      { id: 'castle-shield', type: 'collectible', name: 'Khiên Thành', hanzi: '城盾', image: '/items/spin-castle-shield.png', rarity: 'Thường', description: 'Bảo vệ Hán Tự Thành trong một lượt Công Thành. Tối đa 5.' },
      { id: 'siege-ticket', type: 'collectible', name: 'Vé Công Thành', hanzi: '攻城券', image: '/items/spin-siege-ticket.png', rarity: 'Thường', description: 'Vé tham gia hoạt động Công Thành. Tối đa 20.' },
      { id: 'destiny-fragment', type: 'collectible', name: 'Mảnh Thiên Mệnh', hanzi: '天命碎片', image: '/items/spin-destiny-fragment.png', rarity: 'Cực hiếm', description: 'Mảnh sưu tập cực hiếm nhận từ Thiên Cơ Luân.' },
      { id: 'celestial-jackpot', type: 'collectible', name: 'Thiên Mệnh Jackpot', hanzi: '天命大奖', image: '/items/spin-jackpot.png', rarity: 'Huyền thoại', description: 'Chứng tích Jackpot với tỷ lệ xuất hiện chỉ 0,05%.' },
      { id: 'protect-charm', type: 'timed', name: 'Hộ Thân Phù', hanzi: '护身符', icon: '🛡️', rarity: 'Hiếm', description: 'Vật phẩm PvP có hạn 24 giờ · bảo vệ điểm khi thua.' },
      { id: 'revenge-order', type: 'timed', name: 'Ân Oán Lệnh', hanzi: '恩怨令', icon: '⚔️', rarity: 'Sử thi', description: 'Vật phẩm cày PvP có hạn 24 giờ · dùng cho trận tái đấu.' },
      { id: 'enlightenment-pill', type: 'timed', name: 'Khai Khiếu Đan', hanzi: '开窍丹', icon: '📜', rarity: 'Sử thi', description: 'Vật phẩm học tập có hạn 24 giờ.' },
      { id: 'peerless-order', type: 'timed', name: 'Vô Song Lệnh', hanzi: '无双令', icon: '🎯', rarity: 'Sử thi', description: 'Vật phẩm PvP giới hạn tuần · có hạn 24 giờ.' },
      { id: 'diamond-guard', type: 'timed', name: 'Kim Cương Tráo', hanzi: '金刚罩', icon: '💠', rarity: 'Sử thi', description: 'Vật phẩm phòng hộ PvP có hạn 24 giờ.' },
      { id: 'destiny-card', type: 'timed', name: 'Thiên Mệnh Bài', hanzi: '天命牌', icon: '🎴', rarity: 'Huyền thoại', description: 'Vật phẩm mạo hiểm PvP có hạn 24 giờ.' },
      { id: 'treasure-basin', type: 'timed', name: 'Tụ Bảo Bồn', hanzi: '聚宝盆', icon: '✨', rarity: 'Huyền thoại', description: 'Vật phẩm sự kiện có hạn 24 giờ.' },
      { id: 'combo-charm', type: 'timed', name: 'Liên Hoàn Phù', hanzi: '连环符', icon: '🔗', rarity: 'Hiếm', description: 'Vật phẩm chuỗi PvP có hạn 24 giờ.' },
      { id: 'time-spell', type: 'timed', name: 'Định Thân Chú', hanzi: '定身咒', icon: '⏳', rarity: 'Hiếm', description: 'Chỉ dùng khi luyện tập PvE · có hạn 24 giờ.' },
      { id: 'insight-lens', type: 'timed', name: 'Thiên Cơ Lậu', hanzi: '天机漏', icon: '👁️', rarity: 'Hiếm', description: 'Gợi ý nhỏ, chỉ dùng trong luyện tập PvE · có hạn 24 giờ.' },
      ...shopItems.filter((item) => item.type !== 'consumable'),
    ] as const;
    const totalItems = Object.values(progression?.inventory ?? {}).reduce((sum, count) => sum + count, 0)
      + (progression?.ownedCosmetics.length ?? 0);
    return (
      <main className="app inventory-page">
        {historyControls}
        {mobileNavigation}
        <header>
          <button className="brand" onClick={() => navigate('home')}><span>汉</span><b>Hanzi Beat<small>Inventory</small></b></button>
          <div className="reward-header-actions"><button onClick={() => navigate('shop')}><ShoppingBag /> Cửa hàng</button><button className="leaderboard-back" onClick={() => navigate('home')}>Về trang chủ</button></div>
        </header>
        <section className="inventory-panel">
          <div className="title"><span className="eyebrow"><Package /> 行囊 · TÚI HÀNH TRANG</span><h1>Inventory</h1><p>Currency, vật phẩm và phần thưởng bạn thu thập trong hành trình.</p></div>
          {!authUser ? <div className="inventory-login"><Package /><h2>Kho đồ cần tài khoản</h2><p>Đăng nhập để đồng bộ Mảnh Ngọc và vật phẩm trên mọi thiết bị.</p><button onClick={() => navigate('auth')}>Đăng nhập</button></div> : <>
            <div className="inventory-wallet">
              <article><img src="/items/jade-fragment.png" alt="Mảnh Ngọc" /><span><small>CURRENCY</small><b>{progression?.jade ?? 0} 玉片</b><p>Mảnh Ngọc Hán Tự</p></span></article>
              <article className="crystal-wallet"><img src="/items/crystal.png" alt="Linh Thạch"/><div><small>PREMIUM CURRENCY</small><b>{progression?.dragonCrystals ?? 0} 晶石</b><p>Linh Thạch · chỉ dùng cho cosmetic và Pass</p></div></article>
              <article className="xp-wallet"><span>XP</span><div><small>KINH NGHIỆM</small><b>{progression?.xp ?? 0} XP</b><p>Level {progression?.level ?? 1}</p></div></article>
              <article className="spin-wallet"><img src="/items/celestial-wheel-icon.png" alt="Spin"/><span><small>THIÊN CƠ LUÂN</small><b>{progression?.spins.balance ?? 0} Spin</b><p>Giữ nút vòng quay để sử dụng</p></span></article>
            </div>
            {rewardActionError && <p className="reward-action-error">{rewardActionError}</p>}
            <div className="inventory-heading">
              <div><span className="eyebrow">VẬT PHẨM</span><h2>Kho đồ của bạn</h2></div>
              <button type="button" className="inv-castle-cta-btn" onClick={() => navigate('castle')}>
                <MapIcon size={14} /> Đi tới Hán Tự Thành
              </button>
              <b>{totalItems} vật phẩm</b>
            </div>
            <div className="inventory-grid">
              {itemDefinitions.map((item) => {
                const isCosmetic = item.type === 'frame' || item.type === 'seal' || item.type === 'effect';
                const owned = isCosmetic ? Boolean(progression?.ownedCosmetics.includes(item.id)) : (progression?.inventory?.[item.id] ?? 0) > 0;
                const quantity = isCosmetic ? (owned ? 1 : 0) : progression?.inventory?.[item.id] ?? 0;
                const equipped = isCosmetic && progression?.equipped[item.type] === item.id;
                const isCastleItem = item.id === 'castle-shield' || item.id === 'siege-ticket';
                const action = item.type === 'chest'
                  ? () => runProgressionAction('open-chest')
                  : item.type === 'guard'
                    ? () => navigate('shop')
                    : isCastleItem && owned
                      ? () => runProgressionAction('use-castle-item', item.id)
                    : isCosmetic && owned
                      ? () => runProgressionAction('equip-item', item.id)
                      : undefined;
                const label = item.type === 'chest' ? 'Mở rương'
                  : item.type === 'guard' ? 'Mua thêm'
                    : item.id === 'castle-shield' ? 'Kích hoạt khiên'
                      : item.id === 'siege-ticket' ? 'Công thành'
                    : isCosmetic ? (equipped ? 'Đang trang bị' : owned ? 'Trang bị' : 'Chưa sở hữu')
                      : 'Vật phẩm sưu tầm';
                return <article key={item.id} className={!owned ? 'locked' : equipped ? 'equipped' : ''}>
                  <div className="inventory-art">{'image' in item ? <img src={item.image} alt={item.name} /> : <i className="inventory-symbol">{'icon' in item ? item.icon : '物'}</i>}{quantity > 0 && <b>×{quantity}</b>}</div>
                  <span>{item.rarity}</span><h3>{item.name}</h3><small>{item.hanzi}</small><p>{item.description}</p>
                  {item.type === 'timed' && owned && <em className="item-expiry">Hết hạn: {new Date(progression?.inventoryExpiries?.[item.id] ?? Date.now() + 86_400_000).toLocaleString('vi-VN')}</em>}
                  <button onClick={action} disabled={rewardActionStatus === 'loading' || (!owned && item.type !== 'guard') || (item.type === 'collectible' && !isCastleItem)}>{rewardActionStatus === 'loading' && action ? 'Đang xử lý…' : label}</button>
                </article>;
              })}
            </div>
            {castleEffect && <div className={`castle-item-effect ${castleEffect.type}`} role="status"><div className="siege-projectiles"><i/><i/><i/></div><div className="virtual-shield-mark"><b>盾</b></div><section><strong>{castleEffect.type === 'siege' ? '攻城成功' : '城盾展开'}</strong><h2>{castleEffect.type === 'siege' ? 'CÔNG THÀNH!' : 'KHIÊN THÀNH!'}</h2>{castleEffect.rewards && <p>🪙 ×{castleEffect.rewards.coins} · 🪵 ×{castleEffect.rewards.wood} · 🖌 ×{castleEffect.rewards.ink}</p>}{castleEffect.type === 'shield' && <p>Bảo vệ thành trong 24 giờ</p>}</section></div>}
          </>}
        </section>
        {chestReward && <div className="chest-reward-backdrop" onClick={() => setChestReward(null)}><section className="chest-reward" onClick={(event) => event.stopPropagation()}><img src="/items/daily-chest.png" alt="Rương đã mở" /><span>宝箱开启 · RƯƠNG ĐÃ MỞ</span><h2>+{chestReward.jade} 玉片 · +{chestReward.xp} XP</h2>{chestReward.bonus && <p>Bonus hiếm: {shopItems.find((item) => item.id === chestReward.bonus)?.name}</p>}<button onClick={() => setChestReward(null)}>Nhận thưởng</button></section></div>}
      </main>
    );
  }
  if (screen === 'shop')
    return (
      <main className="app shop-page">
        {historyControls}
        {mobileNavigation}
        <header>
          <button className="brand" onClick={() => navigate('home')}><span>汉</span><b>Hanzi Beat<small>Cosmetic shop</small></b></button>
          <div className="reward-header-actions"><button className="shop-topup-btn" onClick={() => setTopupOpen(true)}><img className="inline-crystal-icon" src="/items/crystal.png" alt=""/> Nạp Linh Thạch</button><button onClick={() => navigate('inventory')}><Package /> Inventory</button><button className="leaderboard-back" onClick={() => navigate('home')}>Về trang chủ</button></div>
        </header>
        <section className="shop-panel">
          <div className="shop-hero"><div><span className="eyebrow"><ShoppingBag /> 珍宝阁 · TRÂN BẢO CÁC</span><h1>Cửa hàng cosmetic</h1><p>Dùng Mảnh Ngọc kiếm từ Daily, Offline và PvP để tạo phong cách riêng.</p></div><div className="shop-account-preview"><div className={`shop-preview-avatar ${progression?.equipped.frame ?? ''}`}>{authUser?.name.slice(0, 1).toUpperCase() ?? '汉'}</div><span><small>KHUNG ĐANG DÙNG</small><b>{progression?.equipped.frame ? shopItems.find((item) => item.id === progression.equipped.frame)?.name : 'Khung mặc định'}</b></span></div><div className="shop-balance"><img src="/items/jade-fragment.png" alt="Mảnh Ngọc" /><span><small>SỐ DƯ</small><b>{progression?.jade ?? 0} 玉片</b></span></div></div>
          <nav className="shop-tabs" aria-label="Danh mục cửa hàng">
            <button className={shopTab === 'special' ? 'on' : ''} onClick={() => setShopTab('special')}>✦ Đặc Biệt</button>
            <button className={shopTab === 'cosmetics' ? 'on' : ''} onClick={() => setShopTab('cosmetics')}>🎨 Ngoại Trang</button>
            <button className={shopTab === 'items' ? 'on' : ''} onClick={() => setShopTab('items')}>🛡 Vật Phẩm</button>
            <button className={shopTab === 'pass' ? 'on' : ''} onClick={() => setShopTab('pass')}>🎫 Battle Pass</button>
            <button className={shopTab === 'crystals' ? 'on' : ''} onClick={() => setShopTab('crystals')}>🔮 Linh Thạch</button>
          </nav>
          {!authUser ? <div className="inventory-login"><ShoppingBag /><h2>Đăng nhập để mua vật phẩm</h2><p>Cosmetic và Mảnh Ngọc sẽ được đồng bộ theo tài khoản.</p><button onClick={() => navigate('auth')}>Đăng nhập</button></div> : <>
            {rewardActionError && <p className="reward-action-error">{rewardActionError}</p>}
            {(shopTab === 'special' || shopTab === 'cosmetics' || shopTab === 'items') && <div className="shop-grid">
              {shopItems.filter((item) => shopTab === 'special' ? ['frame-dragon', 'effect-golden', 'streak-guard'].includes(item.id) : shopTab === 'cosmetics' ? item.type !== 'consumable' : item.type === 'consumable').map((item) => {
                const owned = item.type !== 'consumable' && progression?.ownedCosmetics.includes(item.id);
                const guardCount = progression?.inventory['streak-guard'] ?? 0;
                const isMaxGuard = item.id === 'streak-guard' && guardCount >= 2;
                const notEnoughJade = (progression?.jade ?? 0) < item.price;
                return <article key={item.id} className={`${item.rarity === 'Huyền thoại' ? 'legendary' : ''} ${owned ? 'owned' : ''} ${isMaxGuard ? 'sold-out' : ''}`}>
                  <div className="shop-item-art"><img src={item.image} alt={item.name} />{item.id === 'streak-guard' && <b>{guardCount}/2</b>}</div>
                  <span>{item.rarity}</span><h2>{item.name}</h2><small>{item.hanzi}</small><p>{item.description}</p>
                  {owned ? (
                    <button className="shop-btn-owned" disabled>Đã mua</button>
                  ) : isMaxGuard ? (
                    <button className="shop-btn-sold-out" disabled>Sold out</button>
                  ) : (
                    <button disabled={rewardActionStatus === 'loading' || notEnoughJade} onClick={() => runProgressionAction('buy-item', item.id)}>
                      <img src="/items/jade-fragment.png" alt="" />
                      {rewardActionStatus === 'loading' ? 'Đang mua…' : `${item.price} 玉片`}
                    </button>
                  )}
                </article>;
              })}
            </div>
            }
            {shopTab === 'items' && <div className="shop-coming-grid">{[
              ['🛡️','Hộ Thân Phù','护身符','PvP thường · 2/tuần'], ['💠','Kim Cương Tráo','金刚罩','PvP thường · 3/tuần'],
              ['🎯','Vô Song Lệnh','无双令','PvP thường · 2/tuần'], ['🔗','Liên Hoàn Phù','连环符','PvP thường · 3/tuần'],
              ['📜','Khai Khiếu Đan','开窍丹','Phần thưởng học tập'], ['⏳','Định Thân Chú','定身咒','Chỉ dùng PvE'],
            ].map(([icon,name,hanzi,note]) => <article key={name}><i>{icon}</i><span>SẮP MỞ</span><h3>{name}</h3><small>{hanzi}</small><p>{note}</p><button disabled>Đang hoàn thiện</button></article>)}</div>}
            {shopTab === 'pass' && <section className="shop-feature-panel pass"><div><span>龙脉之旅 · MÙA 1</span><h2>Hành Trình Long Mạch</h2><p>Battle Pass gồm đủ 50 cấp, hai nhánh phần thưởng và 80 Linh Thạch hoàn lại. Premium chỉ chứa cosmetic và vật phẩm sưu tầm.</p><b>{progression?.battlePass.xp ?? 0}/5000 XP · Cấp {Math.min(50, Math.floor((progression?.battlePass.xp ?? 0) / 100))}</b></div><button onClick={() => { setCommerceTab('pass'); setCastleCommerceOpen(true); navigate('castle'); }}>Xem Battle Pass</button></section>}
            {shopTab === 'crystals' && <section className="shop-feature-panel crystals"><img src="/items/crystal.png" alt="Linh Thạch"/><div><span>晶石 · PREMIUM CURRENCY</span><h2>{progression?.dragonCrystals ?? 0} Linh Thạch</h2><p>Chỉ dùng cho cosmetic, trải nghiệm tùy biến và Battle Pass. Không đổi được thành sức mạnh hoặc tài nguyên xây dựng.</p></div><button onClick={() => setTopupOpen(true)}>Nạp Linh Thạch</button></section>}
          </>}
        </section>
        {renderTopupModal()}
      </main>
    );
  if (screen === 'pvp')
    return (
      <main className="app pvp-page">
        {historyControls}
        {mobileNavigation}
        <header>
          <button className="brand" onClick={() => navigate('home')}><span>汉</span><b>Hanzi Beat<small>Online battle</small></b></button>
          <button className="leaderboard-back" onClick={() => navigate('home')}>Về trang chủ</button>
        </header>
        <section className="pvp-panel">
          <div className="title"><span className="eyebrow"><Trophy /> ĐẤU TRƯỜNG TRỰC TUYẾN</span><h1>PvP Online</h1><p>Hai người cùng chế độ, cùng 20 từ · Điểm cao hơn chiến thắng</p></div>
          {authUser && pvpRank && <div className="pvp-rank-card">
            <div className="pvp-rank-identity">
              {PVP_RANK_BADGES[pvpRank.rank] && <img src={PVP_RANK_BADGES[pvpRank.rank]} alt={`Huy hiệu rank ${pvpRank.rank}`} />}
              <div><span>赛季 {pvpRank.season}</span><h2>{pvpRank.rank}</h2><small>PvP Rank theo mùa</small></div>
            </div>
            <strong>{pvpRank.mmr}<small>MMR</small></strong>
            <ul><li><b>{pvpRank.wins}</b>Thắng</li><li><b>{pvpRank.losses}</b>Thua</li><li><b>{pvpRank.draws}</b>Hòa</li></ul>
          </div>}
          {!authUser ? <div className="pvp-login-required"><Trophy /><h2>Đăng nhập để đấu Rank</h2><p>Rank, lịch sử và kiểm tra công bằng được gắn với tài khoản Firebase.</p><button onClick={() => navigate('auth')}>Đăng nhập</button></div> : !pvpRoom && !pvpWaiting ? <>
            <label className="pvp-name">Tên thi đấu<input value={authUser.name} disabled /></label>
            <div className="pvp-mode-picker">
              <button className={pvpGameMode === 'audition' ? 'on' : ''} onClick={() => setPvpGameMode('audition')}><b>Rhythm Quiz</b><small>Chọn nghĩa tiếng Việt hoặc chữ Hán</small></button>
              <button className={pvpGameMode === 'typing' ? 'on' : ''} onClick={() => setPvpGameMode('typing')}><b>Typing Battle</b><small>Gõ nghĩa tiếng Việt hoặc chữ Hán</small></button>
            </div>
            <div className="pvp-choices">
              <article><span>⚔</span><h2>Ghép trận</h2><p>Tìm một đối thủ đang chờ trên toàn hệ thống.</p><button onClick={() => pvpAction('match')}>Tìm đối thủ</button></article>
              <article><span>🏮</span><h2>Tạo phòng</h2><p>Tạo mã riêng và gửi cho bạn bè cùng tham gia.</p><button onClick={() => pvpAction('create')}>Tạo phòng mới</button></article>
            </div>
            <div className="join-room"><input value={pvpCode} maxLength={6} onChange={(event) => setPvpCode(event.target.value.toUpperCase())} placeholder="NHẬP MÃ PHÒNG" /><button onClick={() => pvpAction('join')}>Vào phòng</button></div>
          </> : <div className="pvp-waiting"><div className="pvp-spinner">汉</div><span>{pvpRoom ? `MÃ PHÒNG: ${pvpRoom.code}` : 'ĐANG GHÉP TRẬN'}</span><h2>{pvpRoom?.guest ? 'Đã tìm thấy đối thủ!' : 'Đang chờ đối thủ...'}</h2><p className="pvp-waiting-mode">{(pvpRoom?.mode ?? pvpGameMode) === 'audition' ? 'Rhythm Quiz' : 'Typing Battle'}</p>{pvpRoom && <><p>Gửi mã này cho bạn bè:</p><button className="room-code" onClick={() => navigator.clipboard.writeText(pvpRoom.code)}>{pvpRoom.code}</button></>}<small>Trận đấu sẽ tự bắt đầu khi đủ 2 người.</small></div>}
          {pvpError && <p className="pvp-error">{pvpError}</p>}
        </section>
      </main>
    );
  if (screen === 'leaderboard')
    return (
      <main className="app leaderboard-page">
        {historyControls}
        {mobileNavigation}
        <header>
          <button className="brand" onClick={() => navigate('home')}>
            <span>汉</span>
            <b>Hanzi Beat<small>Global ranking</small></b>
          </button>
          <button className="leaderboard-back" onClick={() => navigate('home')}>Về trang chủ</button>
        </header>
        <section className="leaderboard-panel">
          <div className="title">
            <span className="eyebrow"><Trophy /> BẢNG VÀNG TOÀN CẦU</span>
            <h1>Xếp hạng người chơi</h1>
            <p>{leaderboardTab === 'songs' ? 'Top 50 điểm cao nhất của từng màn và chế độ.' : 'Bảng vàng tôn vinh những thành trì phồn vinh và kỳ vĩ nhất thiên hạ.'}</p>
          </div>
          <div className="leaderboard-category-tabs">
            <button
              type="button"
              className={leaderboardTab === 'songs' ? 'on' : ''}
              onClick={() => setLeaderboardTab('songs')}
            >
              🎵 Điểm Bài Hát
            </button>
            <button
              type="button"
              className={leaderboardTab === 'castle' ? 'on' : ''}
              onClick={() => {
                setLeaderboardTab('castle');
                void runCastleSocial();
              }}
            >
              🏯 Phồn Vinh Thành Trì
            </button>
          </div>
          {leaderboardTab === 'songs' ? (
            <>
              <div className="leaderboard-filters">
                <div>
                  {songs.map((song, index) => (
                    <button key={song[0]} className={leaderboardLevel === index ? 'on' : ''} onClick={() => setLeaderboardLevel(index)}>
                      {song[0]}
                    </button>
                  ))}
                </div>
                <div>
                  <button className={leaderboardMode === 'audition' ? 'on' : ''} onClick={() => setLeaderboardMode('audition')}>Trắc nghiệm</button>
                  <button className={leaderboardMode === 'typing' ? 'on' : ''} onClick={() => setLeaderboardMode('typing')}>Gõ chữ</button>
                </div>
              </div>
              <div className="leaderboard-table">
                <div className="leaderboard-row leaderboard-head">
                  <span>Hạng</span><span>Người chơi</span><span>Từ đúng</span><span>Điểm</span>
                </div>
                {leaderboardLoading ? (
                  <p className="leaderboard-empty">Đang tải bảng xếp hạng...</p>
                ) : leaderboard.length === 0 ? (
                  <p className="leaderboard-empty">Chưa có điểm. Hãy trở thành người đầu tiên!</p>
                ) : leaderboard.map((entry, index) => (
                  <div className="leaderboard-row" key={entry.id}>
                    <span className={`place place-${index + 1}`}>{index + 1}</span>
                    <span><b>{entry.name}</b></span>
                    <span>{entry.correct}/20</span>
                    <strong>{entry.score.toLocaleString('vi-VN')}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="leaderboard-table">
              <div className="leaderboard-row leaderboard-head" style={{ gridTemplateColumns: '40px 1fr 120px 80px 110px' }}>
                <span>Hạng</span><span>Thành Trì</span><span>Phồn Vinh</span><span>Like</span><span>Hành động</span>
              </div>
              {castleSocial?.castles && castleSocial.castles.length > 0 ? (
                castleSocial.castles.map((c, index) => (
                  <div className="leaderboard-row" key={c.uid} style={{ gridTemplateColumns: '40px 1fr 120px 80px 110px' }}>
                    <span className={`place place-${index + 1}`}>{index + 1}</span>
                    <span>
                      <b>{c.name}</b>
                      <small style={{ display: 'block', color: '#887463', fontSize: '11px' }}>
                        Thành Lv.{c.level} · Chủ {c.buildings.main} · Thư {c.buildings.library} · Thính {c.buildings.listening}
                      </small>
                    </span>
                    <strong style={{ color: '#b5272d' }}>✨ {c.score.toLocaleString('vi-VN')}</strong>
                    <span style={{ color: '#e03131' }}>❤️ {c.likes}</span>
                    <div>
                      <button
                        type="button"
                        className="leaderboard-castle-visit-btn"
                        onClick={() => void runCastleSocial('visit', c.uid)}
                      >
                        🏯 Thăm Thành
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="leaderboard-empty">Đang đồng bộ danh sách thành trì toàn cầu...</p>
              )}
            </div>
          )}
        </section>
        {visitedCastle && (
          <div className="castle-visit-backdrop" onClick={() => setVisitedCastle(null)}>
            <section
              className={`castle-visit-card castle-theme-${visitedCastle.theme}`}
              onClick={(event) => event.stopPropagation()}
            >
              <button onClick={() => setVisitedCastle(null)}>×</button>
              <span>拜访 · GHÉ THĂM</span>
              <h2>Thành của {visitedCastle.name}</h2>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 280,
                  borderRadius: 12,
                  overflow: 'hidden',
                  margin: '10px 0',
                  border: '1px solid rgba(255, 215, 100, 0.35)',
                  background: 'rgba(15, 10, 8, 0.65)',
                }}
              >
                <CastleIsoCanvas
                  castle={{
                    theme: visitedCastle.theme,
                    buildings: visitedCastle.buildings,
                  }}
                  environmentStage={Math.min(5, Math.ceil(visitedCastle.level / 2))}
                  selectedBuildingId={null}
                  onSelectBuilding={() => {}}
                  showGrid={false}
                  extraBuildings={visitedCastle.buildingsLayout ?? []}
                  pendingBuilding={null}
                  onToast={showCastleToast}
                  shieldActive={Boolean(visitedCastle.shieldActiveUntil && visitedCastle.shieldActiveUntil > Date.now())}
                  combatFxTrigger={castleCombatTrigger}
                  corePositions={visitedCastle.corePositions}
                />
              </div>
              <p>繁荣度 {visitedCastle.score.toLocaleString('vi-VN')} · ♥ {visitedCastle.likes}</p>
              <button onClick={() => void runCastleSocial('like', visitedCastle.uid)}>♥ Like thành</button>
            </section>
          </div>
        )}
      </main>
    );
  return (
    <main className="app">
      {historyControls}
      {mobileNavigation}
      <header>
        <button className="brand" onClick={() => navigate('home')}>
          <span>汉</span>
          <b>
            Hanzi Beat<small>Learn Chinese in rhythm</small>
          </b>
        </button>
        <nav>
          <button
            className={screen === 'home' ? 'on' : ''}
            onClick={() => navigate('home')}
          >
            Trang chủ
          </button>
          <button
            className={screen === 'dictionary' ? 'on' : ''}
            onClick={() => navigate('dictionary')}
          >
            Từ điển
          </button>
          <button onClick={openLeaderboard}>Xếp hạng</button>
          <button onClick={() => navigate('inventory')}>Inventory</button>
          <button onClick={() => navigate('shop')}>Cửa hàng</button>
          <button onClick={openPvp}>PvP Online</button>
        </nav>
        <button
          className="user account-button"
          onClick={() => navigate('auth')}
        >
          <span className={`header-avatar ${progression?.equipped.frame ?? ''}`}>
            {authUser ? authUser.name.slice(0, 1).toUpperCase() : <LogIn />}
          </span>
          <b>
            {authUser ? authUser.name : 'Đăng nhập'}
            {!authUser && <small>Đăng ký tài khoản</small>}
          </b>
        </button>
      </header>
      {playModeOpen && (
        <div
          className="play-mode-backdrop"
          onMouseDown={() => setPlayModeOpen(false)}
        >
          <section
            className={`play-mode-modal step-${playModeStep}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-mode-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {playModeStep !== 'mode' && (
              <button
                className="play-mode-back"
                onClick={() =>
                  setPlayModeStep(playModeStep === 'difficulty' ? 'gameplay' : 'mode')
                }
                aria-label="Quay lại bước trước"
                type="button"
              >
                <ChevronLeft size={16} /> Quay lại
              </button>
            )}
            <button
              className="play-mode-close"
              onClick={() => setPlayModeOpen(false)}
              aria-label="Đóng"
              type="button"
            >
              ×
            </button>

            {playModeStep === 'mode' && (
              <div className="play-mode-step-content">
                <div className="play-mode-heading">
                  <span>选择模式 · CHỌN CHẾ ĐỘ</span>
                  <h2 id="play-mode-title">Bạn muốn chơi theo cách nào?</h2>
                  <p>Mỗi hành trình đều giúp mở khóa Hán tự và phần thưởng tài khoản.</p>
                </div>
                <div className="play-mode-options">
                  <button
                    type="button"
                    onClick={() => setPlayModeStep('gameplay')}
                  >
                    <i>单</i>
                    <span>
                      <small>SOLO JOURNEY</small>
                      <b>Chơi đơn</b>
                      <p>Rèn luyện theo tốc độ của bạn: chọn lối chơi và cấp độ từ HSK đến mẫu câu.</p>
                      <em>Tiếp tục chọn lối chơi →</em>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pvp-option"
                    onClick={() => {
                      setPlayModeOpen(false);
                      openPvp();
                    }}
                  >
                    <i>战</i>
                    <span>
                      <small>ONLINE ARENA</small>
                      <b>PvP Online</b>
                      <p>Ghép trận hoặc tạo phòng, thi đấu Rank cùng người chơi khác.</p>
                      <em>Vào Đấu trường →</em>
                    </span>
                  </button>
                </div>
                <footer>
                  <span>汉</span> Học một mình · Tiến bộ cùng nhau
                </footer>
              </div>
            )}

            {playModeStep === 'gameplay' && (
              <div className="play-mode-step-content">
                <div className="play-mode-heading">
                  <span>选择玩法 · CHỌN LỐI CHƠI</span>
                  <h2 id="play-mode-title">Bạn muốn luyện tập theo hình thức nào?</h2>
                  <p>Lựa chọn cơ chế thử thách phù hợp với mục tiêu học tập của bạn.</p>
                </div>
                <div className="mode-picker">
                  <button
                    type="button"
                    className={mode === 'audition' ? 'active' : ''}
                    onClick={() => {
                      setMode('audition');
                      setPlayModeStep('difficulty');
                    }}
                  >
                    <span className="mode-artwork">
                      <img
                        src="/lesson-rhythm-quiz.webp"
                        alt="Minh họa Rhythm Quiz với thẻ từ vựng và bốn đáp án theo nhịp"
                      />
                    </span>
                    <b>Rhythm Quiz</b>
                    <small>Luân phiên chọn nghĩa tiếng Việt và chữ Hán</small>
                  </button>
                  <button
                    type="button"
                    className={mode === 'typing' ? 'active typing' : ''}
                    onClick={() => {
                      setMode('typing');
                      setPlayModeStep('difficulty');
                    }}
                  >
                    <span className="mode-artwork">
                      <img
                        src="/lesson-typing-battle.webp"
                        alt="Minh họa Typing Battle với bàn phím Hán tự phát sáng"
                      />
                    </span>
                    <b>Typing Battle</b>
                    <small>Luân phiên dịch chữ Hán và nghĩa tiếng Việt</small>
                  </button>
                </div>
                <footer>
                  <span>♪</span> Bắt nhịp âm thanh · Khắc sâu Hán tự
                </footer>
              </div>
            )}

            {playModeStep === 'difficulty' && (
              <div className="play-mode-step-content">
                <div className="play-mode-heading">
                  <span>选择难度 · CHỌN ĐỘ KHÓ</span>
                  <h2 id="play-mode-title">Chọn cấp độ thử thách của bạn</h2>
                  <p>Từ từ vựng HSK nền tảng đến cụm từ kết hợp và mẫu câu đàm thoại thực tế.</p>
                </div>
                <div className="play-mode-options difficulty-grid">
                  <button
                    type="button"
                    className="diff-card diff-easy"
                    onClick={() => {
                      setDifficultyTab('easy');
                      setActivePackInfo(null);
                      activeMatchPool.current = null;
                      setPlayModeOpen(false);
                      navigate('songs');
                    }}
                  >
                    <i>🟢</i>
                    <span>
                      <small>CẤP ĐỘ 1 · HSK 1 - 4</small>
                      <b>Dễ (HSK)</b>
                      <p>Kho từ vựng HSK 1 đến 4, rèn từ đơn và từ vựng thông dụng theo bài hát.</p>
                      <em>Vào cấp Dễ →</em>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="diff-card diff-normal"
                    onClick={() => {
                      setDifficultyTab('normal');
                      setSelectedNormalPack(0);
                      setPlayModeOpen(false);
                      navigate('songs');
                    }}
                  >
                    <i>🟡</i>
                    <span>
                      <small>CẤP ĐỘ 2 · COLLOCATIONS</small>
                      <b>Bình Thường</b>
                      <p>Kết hợp từ thường gặp & Quán ngữ, Thành ngữ 4 chữ chuẩn bản xứ.</p>
                      <em>Vào cấp Bình Thường →</em>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="diff-card diff-hard"
                    onClick={() => {
                      setDifficultyTab('hard');
                      setSelectedHardPack(0);
                      setPlayModeOpen(false);
                      navigate('songs');
                    }}
                  >
                    <i>🔴</i>
                    <span>
                      <small>CẤP ĐỘ 3 · MẪU CÂU</small>
                      <b>Khó (Mẫu Câu)</b>
                      <p>Sentence patterns liên từ phức & Câu ngắn ngữ cảnh đàm thoại thực chiến.</p>
                      <em>Vào cấp Khó →</em>
                    </span>
                  </button>
                </div>
                <footer>
                  <span>阶</span> Tiến bước từng cấp · Chinh phục đỉnh cao
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
      {audioOpen && (
        <div
          className="audio-modal-backdrop"
          onMouseDown={() => setAudioOpen(false)}
        >
          <section
            className="audio-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="audio-modal-head">
              <div>
                <span className="eyebrow">GAME AUDIO</span>
              <h2>Thư viện âm thanh</h2>
                <p>Game tự chọn một trong 7 bài nhạc chính khi bắt đầu trận.</p>
              </div>
              <button onClick={() => setAudioOpen(false)} aria-label="Đóng">
                ×
              </button>
            </div>
            <div className="default-audio-list">
              <span className="eyebrow">NHẠC CHÍNH · {defaultAudioTracks.length} BÀI</span>
              {defaultAudioTracks.map((track) => (
                <button
                  key={track.src}
                  onClick={() => {
                    audioPlayer.current?.pause();
                    const player = new Audio(track.src);
                    player.volume = volume;
                    audioPlayer.current = player;
                    setCurrentTrackName(track.name);
                    void player.play().catch(() => undefined);
                  }}
                >
                  <Play /> {track.name}
                </button>
              ))}
            </div>
            <label className="audio-upload">
              <Upload />
              <span>
                <b>Thêm nhạc cá nhân để nghe thử</b>
                <small>MP3, WAV, OGG hoặc M4A · Có thể chọn nhiều file</small>
              </span>
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={(event) => void uploadAudio(event.target.files)}
              />
            </label>
            <div className="volume-setting">
              <Volume2 />
              <span>Âm lượng trong trận</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <b>{Math.round(volume * 100)}%</b>
            </div>
            <div className="audio-list">
              {audioTracks.length ? (
                audioTracks.map((track) => (
                  <article key={track.id}>
                    <button
                      className="track-play"
                      onClick={() => previewAudio(track)}
                    >
                      <Play />
                    </button>
                    <div>
                      <b>{track.name}</b>
                      <small>
                        {(track.blob.size / 1024 / 1024).toFixed(1)} MB
                      </small>
                    </div>
                    <button
                      className="track-delete"
                      onClick={() => void removeAudio(track.id)}
                      aria-label={`Xóa ${track.name}`}
                    >
                      <Trash2 />
                    </button>
                  </article>
                ))
              ) : (
                <div className="audio-empty">
                  <Music2 />
                  <b>Chưa có bài nhạc nào</b>
                  <span>
                    Tải nhạc lên để game phát ngẫu nhiên khi vào trận.
                  </span>
                </div>
              )}
            </div>
            <div className="audio-note">
              <span>♪</span>
              <p>
                File nhạc được lưu riêng trên trình duyệt của thiết bị này,
                không tải lên máy chủ.
              </p>
            </div>
          </section>
        </div>
      )}
      {screen === 'home' && (
        <div className="home">
          <section className="hero">
            <div>
              <span className="eyebrow">
                <Sparkles /> HỌC TIẾNG TRUNG QUA ÂM NHẠC
              </span>
              <h1>
                Bắt đúng nhịp.
                <br />
                <em>Nhớ trọn Hán tự.</em>
              </h1>
              <p>
                Mỗi nhịp bấm là một chữ Hán mới. Chinh phục từ HSK 1 đến HSK 6
                qua giai điệu, pinyin và phản xạ thật tự nhiên.
              </p>
              <div className="actions">
                <button onClick={openPlayModeModal}>
                  <Play /> Chơi ngay
                </button>
                <button onClick={() => navigate('dictionary')}>
                  <BookOpen /> Từ điển của tôi
                </button>
              </div>
              <div className="streak">
                <Flame />
                <span>
                  <b>{progression ? `${progression.streak} ngày Nhật Ấn` : 'Đăng nhập để lưu hành trình'}</b>
                  <small>{progression ? `${progression.stamps} con dấu đã thu thập` : 'Đồng bộ level, XP và Mảnh Ngọc'}</small>
                </span>
              </div>
            </div>
            <div className="china-visual">
              <img
                src="/og.png"
                alt="Sân khấu âm nhạc Hanzi Beat với Hán tự phát sáng"
              />
              <span className="seal">汉<br />韵</span>
              <b className="visual-caption">
                华语节奏<small>Nhịp điệu Hoa ngữ</small>
              </b>
            </div>
          </section>
          <aside>
            <section className="daily">
              <div className="daily-pattern" aria-hidden="true">回</div>
              <div className="daily-copy">
                <span className="eyebrow">每日挑战 · DAILY CHALLENGE</span>
                <h3>Thử thách hôm nay</h3>
                <p>20 câu hỏi bất ngờ · Chinh phục trước 23:59</p>
                <span className="daily-reward">火 Giữ chuỗi ngày học</span>
              </div>
              <div className="daily-seal" aria-hidden="true">挑<br />战</div>
              <button onClick={startDailyChallenge}>
                <Play />
              </button>
            </section>
            <section className="today">
              <article className="today-summary">
                <span><small>今日进度</small><b>Tiến độ hôm nay</b></span>
                <strong>{progression?.completedTasks ?? 0}<small>/4</small></strong>
                <i><b style={{ width: `${((progression?.completedTasks ?? 0) / 4) * 100}%` }} /></i>
                <p>{(progression?.completedTasks ?? 0) >= 3 ? 'Đã đủ điều kiện nhận Nhật Ấn' : `Hoàn thành ${3 - (progression?.completedTasks ?? 0)} nhiệm vụ nữa để nhận Nhật Ấn`}</p>
              </article>
              {progression ? <ul className="daily-tasks">
                <li className={progression.daily.correct >= 20 ? 'done' : ''}><i /> <span>Ôn đúng 20 câu</span><b>{Math.min(progression.daily.correct, 20)}/20</b></li>
                <li className={progression.daily.dailyCompleted ? 'done' : ''}><i /> <span>Daily Challenge</span><b>{progression.daily.dailyCompleted ? 'Đã xong' : '0/1'}</b></li>
                <li className={progression.daily.offlineMatches >= 1 ? 'done' : ''}><i /> <span>Chơi offline</span><b>{Math.min(progression.daily.offlineMatches, 1)}/1</b></li>
                <li className={progression.daily.pvpMatches >= 2 ? 'done' : ''}><i /> <span>Chơi PvP</span><b>{Math.min(progression.daily.pvpMatches, 2)}/2</b></li>
              </ul> : <p className="today-login">Đăng nhập để bắt đầu nhiệm vụ và nhận Nhật Ấn.</p>}
              {progression && <div className="daily-limits"><span>OFFLINE 玉片 <b>{progression.daily.offlineJade}/20</b></span><span>PVP THƯỞNG <b>{progression.daily.rewardedPvpMatches}/10</b></span></div>}
              {progression?.daily.stampEarned && <strong className="stamp-earned"><img src="/items/daily-seal.png" alt="" /> Nhật Ấn hôm nay đã nhận</strong>}
            </section>
          </aside>
          <section className="continue">
            <div>
              <span className="eyebrow">TIẾP TỤC HÀNH TRÌNH</span>
              <h2>HSK 1 · Chào hỏi & Hằng ngày</h2>
            </div>
            <article>
              <div className="album">
                早<Music2 />
              </div>
              <div>
                <h3>
                  早安节拍 <small>Morning Pulse</small>
                </h3>
                <p>128 BPM · 12 từ vựng</p>
                <i>
                  <b />
                </i>
              </div>
              <strong>
                84,650<small>BEST SCORE</small>
              </strong>
              <button onClick={() => start()}>
                <Play />
              </button>
            </article>
          </section>
          <CastleHomeWidget
            castle={progression?.castle ?? null}
            coins={progression?.coins ?? 0}
            streak={progression?.streak ?? 0}
            discoveriesCount={progression?.discoveries.length ?? 0}
            extraBuildingsCount={extraBuildings.length}
            extraProsperity={extraBuildings.reduce((sum, b) => sum + (b.prosperity ?? 0), 0)}
            onNavigateCastle={() => navigate('castle')}
            harvestAvailable={{
              wood: lastHarvestTime > 0 ? Math.floor((Math.min(12 * 3600 * 1000, Math.max(0, Date.now() - lastHarvestTime)) / (3600 * 1000)) * (4 + (progression?.castle.buildings.main ?? 1) * 1.5)) : 0,
              ink: lastHarvestTime > 0 ? Math.floor((Math.min(12 * 3600 * 1000, Math.max(0, Date.now() - lastHarvestTime)) / (3600 * 1000)) * (2 + (progression?.castle.buildings.main ?? 1) * 0.8)) : 0,
              coins: lastHarvestTime > 0 ? Math.floor((Math.min(12 * 3600 * 1000, Math.max(0, Date.now() - lastHarvestTime)) / (3600 * 1000)) * (100 + (progression?.castle.buildings.main ?? 1) * 50)) : 0,
            }}
            onHarvest={handleHarvest}
          />
          <section className="quick">
            <span>
              <Trophy />
              <b>Lv.{progression?.level ?? 1}</b>Cấp tài khoản
            </span>
            <span>
              <BookOpen />
              <b>{progression?.xp ?? 0}</b>Tổng XP
            </span>
            <button className="quick-inventory" onClick={() => navigate('inventory')}>
              <img className="currency-icon" src="/items/jade-fragment.png" alt="Mảnh Ngọc" />
              <b>{progression?.jade ?? 0}</b>Mảnh Ngọc 玉片
            </button>
          </section>
        </div>
      )}
      {screen === 'songs' && (
        <section className="page lessons-page">
          <div className="lessons-header-bar">
            <button
              type="button"
              className="lessons-change-mode-btn"
              onClick={() => openPlayModeModal()}
              title="Nhấn để đổi hình thức chơi hoặc cấp độ thử thách"
            >
              ← Đổi Chế Độ / Độ Khó
            </button>
            <div className="lessons-current-badges">
              <span className="badge-item mode">
                {mode === 'audition' ? '🎵 Rhythm Quiz' : '⌨️ Typing Battle'}
              </span>
              <span className="badge-item diff">
                {difficultyTab === 'easy'
                  ? '🟢 Cấp 1 · Dễ (HSK)'
                  : difficultyTab === 'normal'
                  ? '🟡 Cấp 2 · Bình Thường'
                  : '🔴 Cấp 3 · Khó (Mẫu Câu)'}
              </span>
            </div>
          </div>

          {difficultyTab === 'easy' && (
            <div className="difficulty-content-section">
              <div className="filters">
                {songs.map((song, index) => (
                  <button
                    key={song[3]}
                    className={selected === index ? 'on' : ''}
                    onClick={() => setSelected(index)}
                  >
                    {song[3]} · {allVocabulary.filter((entry) => entry[4] === song[3]).length} từ
                  </button>
                ))}
              </div>
              <div className="songs">
                {songs.map((s, i) => (
                  <article
                    className={selected === i ? 'selected' : ''}
                    onClick={() => setSelected(i)}
                    key={s[0]}
                  >
                    <div className="album" style={{ background: s[5] }}>
                      {s[0][0]}
                      <Music2 />
                    </div>
                    <div>
                      <small>{s[3]}</small>
                      <h2>{s[0]}</h2>
                      <p>{s[1]}</p>
                    </div>
                    <strong>
                      {s[4]}
                      <small>
                        {s[2]} BPM · {allVocabulary.filter((entry) => entry[4] === s[3]).length} từ
                      </small>
                    </strong>
                    <button
                      aria-label={`Bắt đầu bài ${s[0]}`}
                      onClick={() => {
                        setActivePackInfo(null);
                        activeMatchPool.current = null;
                        start(i);
                      }}
                    >
                      <Play />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {difficultyTab === 'normal' && (
            <div className="difficulty-content-section">
              <div className="filters">
                {normalPacks.map((pack, index) => (
                  <button
                    key={pack.id}
                    className={selectedNormalPack === index ? 'on' : ''}
                    onClick={() => setSelectedNormalPack(index)}
                  >
                    {pack.name} · {pack.vocabulary.length} mục
                  </button>
                ))}
              </div>
              <div className="songs">
                {normalPacks.map((pack, i) => (
                  <article
                    className={selectedNormalPack === i ? 'selected' : ''}
                    onClick={() => setSelectedNormalPack(i)}
                    key={pack.id}
                  >
                    <div className="album" style={{ background: pack.color }}>
                      {pack.name.slice(0, 2)}
                      <Sparkles />
                    </div>
                    <div>
                      <small>{pack.tag}</small>
                      <h2>{pack.name}</h2>
                      <p>{pack.description}</p>
                    </div>
                    <strong>
                      {pack.levelBadge}
                      <small>
                        {pack.bpm} BPM · {pack.vocabulary.length} mục
                      </small>
                    </strong>
                    <button
                      aria-label={`Bắt đầu gói ${pack.name}`}
                      onClick={() => {
                        start(
                          i,
                          pack.vocabulary,
                          false,
                          { title: pack.name, subtitle: pack.subtitle, bpm: pack.bpm },
                        );
                      }}
                    >
                      <Play />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {difficultyTab === 'hard' && (
            <div className="difficulty-content-section">
              <div className="filters">
                {hardPacks.map((pack, index) => (
                  <button
                    key={pack.id}
                    className={selectedHardPack === index ? 'on' : ''}
                    onClick={() => setSelectedHardPack(index)}
                  >
                    {pack.name} · {pack.vocabulary.length} câu
                  </button>
                ))}
              </div>
              <div className="songs">
                {hardPacks.map((pack, i) => (
                  <article
                    className={selectedHardPack === i ? 'selected' : ''}
                    onClick={() => setSelectedHardPack(i)}
                    key={pack.id}
                  >
                    <div className="album" style={{ background: pack.color }}>
                      {pack.name.slice(0, 2)}
                      <Sparkles />
                    </div>
                    <div>
                      <small>{pack.tag}</small>
                      <h2>{pack.name}</h2>
                      <p>{pack.description}</p>
                    </div>
                    <strong>
                      {pack.levelBadge}
                      <small>
                        {pack.bpm} BPM · {pack.vocabulary.length} câu
                      </small>
                    </strong>
                    <button
                      aria-label={`Bắt đầu gói ${pack.name}`}
                      onClick={() => {
                        start(
                          i,
                          pack.vocabulary,
                          false,
                          { title: pack.name, subtitle: pack.subtitle, bpm: pack.bpm },
                        );
                      }}
                    >
                      <Play />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {screen === 'dictionary' && (
        <section className="page">
          <div className="title">
            <span className="eyebrow">MY VOCABULARY</span>
            <h1>{selectedHskFolder ? `Từ vựng HSK ${selectedHskFolder}` : 'Thư mục từ vựng'}</h1>
            <p>{selectedHskFolder ? `${filteredVocabulary.length} từ trong thư mục HSK ${selectedHskFolder}.` : `${allVocabulary.length} từ được sắp xếp theo từng cấp độ HSK.`}</p>
          </div>
          <div className="castle-buff-banner">
            <span className="buff-icon">📚</span>
            <div>
              <b>Tàng Thư Các Lv.{progression?.castle.buildings.library ?? 1}</b>
              <p>Phúc lợi Thư Các: Tăng +{(progression?.castle.buildings.library ?? 1) * 5}% hiệu quả ghi nhớ từ vựng và kinh nghiệm ôn tập.</p>
            </div>
            <button type="button" onClick={() => navigate('castle')}>Nâng Cấp Thư Các →</button>
          </div>
          {selectedHskFolder === null ? (
            <div className="hsk-folders">
              {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => {
                const count = allVocabulary.filter((entry) => entry[4] === `HSK ${level}`).length;
                return (
                  <button
                    key={level}
                    className={count === 0 ? 'empty' : ''}
                    onClick={() => {
                      setSelectedHskFolder(level);
                      setDictionaryQuery('');
                    }}
                  >
                    <Folder />
                    <span><b>HSK {level}</b><small>{count > 0 ? `${count} từ vựng` : 'Chưa có dữ liệu'}</small></span>
                    <ChevronRight />
                  </button>
                );
              })}
            </div>
          ) : <>
          <div className="dictionary-folder-bar">
            <button onClick={() => { setSelectedHskFolder(null); setDictionaryQuery(''); }}><ChevronLeft /> Tất cả thư mục</button>
            <span><FolderOpen /> HSK {selectedHskFolder}</span>
          </div>
          <div className="dictionary-tools">
            <input
              value={dictionaryQuery}
              onChange={(event) => setDictionaryQuery(event.target.value)}
              placeholder="Tìm chữ Hán, pinyin hoặc nghĩa tiếng Việt…"
              aria-label="Tìm từ vựng"
            />
            <span>{filteredVocabulary.length} từ</span>
          </div>
          <div className="words">
            {filteredVocabulary.map((w, i) => (
              <article key={`${w[0]}-${w[2]}`}>
                <div>
                  <span className={`master ${w[4] === 'HSK 2' ? 'hsk2' : ''}`}>
                    {w[4]}
                  </span>
                  <h2>{w[0]}</h2>
                  <p>
                    {w[1]} · {w[2]}
                  </p>
                  <b>{w[3]}</b>
                </div>
                <button onClick={() => speak(w[1])}>
                  <Volume2 />
                </button>
              </article>
            ))}
            {filteredVocabulary.length === 0 && <div className="empty-folder"><FolderOpen /><h2>Thư mục chưa có từ vựng</h2><p>Dữ liệu HSK {selectedHskFolder} sẽ xuất hiện tại đây khi được bổ sung.</p></div>}
          </div>
          </>}
        </section>
      )}
    </main>
  );
}
