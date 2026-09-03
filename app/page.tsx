'use client';

import './castle.css';
import './spin.css';

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
  | 'auth';
const screenPaths: Record<Screen, string> = {
  home: '/', songs: '/lessons', game: '/play', result: '/result',
  dictionary: '/dictionary', leaderboard: '/leaderboard', pvp: '/pvp',
  inventory: '/inventory', shop: '/shop', codex: '/profile/codex', castle: '/profile/castle', auth: '/profile',
};
const screenFromPath = (pathname: string): Screen => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
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
type Progression = {
  xp: number;
  level: number;
  jade: number;
  coins: number;
  streak: number;
  stamps: number;
  inventory: Record<string, number>;
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
    buildings: { main: number; library: number; listening: number };
  };
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
const castleCoinCost = (baseCoin: number, level: number) => Math.round(baseCoin * level ** 1.7);
const castleVisualStage = (level: number) => Math.min(5, Math.max(1, Math.ceil(level / 2)));
const CastleMapBuilding = ({ kind, level, label, onSelect }: { kind: CastleBuildingKind; level: number; label: string; onSelect: (kind: CastleBuildingKind) => void }) => {
  const stage = castleVisualStage(level);
  const assetStage = kind === 'main' ? stage : 1;
  return <button className={`map-building map-building-${kind} visual-stage-${stage}`} onClick={() => onSelect(kind)} aria-label={`${label}, cấp ${level}, hình thái ${stage}`}><img src={`/castle/buildings/${kind}/stage-${assetStage}.webp`} alt=""/><span><b>{label}</b><small>Lv.{level} · Hình thái {stage}/5</small></span></button>;
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<'audition' | 'typing'>('audition');
  const [selected, setSelected] = useState(0);
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
  const [dictionaryQuery, setDictionaryQuery] = useState('');
  const [selectedHskFolder, setSelectedHskFolder] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [scoreStatus, setScoreStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [leaderboardLevel, setLeaderboardLevel] = useState(0);
  const [leaderboardMode, setLeaderboardMode] = useState<'audition' | 'typing'>('audition');
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
  const [cosmeticEffect, setCosmeticEffect] = useState<string | null>(null);
  const [codexTab, setCodexTab] = useState<'atlas' | 'collections' | 'journey'>('atlas');
  const [codexQuery, setCodexQuery] = useState('');
  const [selectedCastleBuilding, setSelectedCastleBuilding] = useState<CastleBuildingKind | null>(null);
  const [spinOpen, setSpinOpen] = useState(false);
  const [slotResult, setSlotResult] = useState<SlotResult | null>(null);
  const [reelOffsets, setReelOffsets] = useState([0, 0, 0]);
  const [reelRun, setReelRun] = useState(0);
  const [spinError, setSpinError] = useState('');
  const [spinBusy, setSpinBusy] = useState(false);
  const spinHoldRef = useRef(false);
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
      await new Promise((resolve) => window.setTimeout(resolve, 2950));
      setSlotResult(data.slotResult);
      if (spinHoldRef.current && (data.progression?.spins.balance ?? 0) > 0) {
        spinBusyRef.current = false;
        setSpinBusy(false);
        window.setTimeout(() => void spinOnce(), 90);
        return;
      }
    } catch (error) {
      setSpinError(error instanceof Error ? error.message : 'Không thể quay Thiên Cơ Luân.');
      spinHoldRef.current = false;
    } finally {
      spinBusyRef.current = false;
      setSpinBusy(false);
    }
  }
  const stopHoldingSpin = () => { spinHoldRef.current = false; };
  const historyControls = (
    <>
      <div className="history-controls" aria-label="Điều hướng trang">
        <button onClick={() => window.history.back()} aria-label="Quay lại trang trước" title="Trang trước"><ChevronLeft /></button>
        <button onClick={() => window.history.forward()} aria-label="Đi tới trang sau" title="Trang sau"><ChevronRight /></button>
      </div>
      <button className="spin-fab" onClick={() => authUser ? setSpinOpen(true) : navigate('auth')} aria-label="Mở Thiên Cơ Luân"><img src="/items/celestial-wheel-icon.png" alt=""/><span><b>{progression?.spins.balance ?? 0}</b><small>SPIN</small></span></button>
      {spinOpen && <div className="spin-modal-backdrop" onClick={() => { stopHoldingSpin(); setSpinOpen(false); }}><section className="spin-modal jackpot-layout" role="dialog" aria-modal="true" aria-label="Thiên Cơ Jackpot" onClick={(event) => event.stopPropagation()}>
        <button className="spin-modal-close" onClick={() => { stopHoldingSpin(); setSpinOpen(false); }} aria-label="Đóng">×</button>
        <div className="jackpot-topbar"><span><img src="/items/coin.png" alt="Coin"/><b>{(progression?.coins ?? 0).toLocaleString('vi-VN')}</b></span><strong>天机 JACKPOT</strong><span><img src="/items/spin-refund.png" alt="Spin"/><b>{progression?.spins.balance ?? 0}</b></span></div>
        <div className={`jackpot-machine ${slotResult?.triple ? 'jackpot-win' : ''}`}><div className="jackpot-marquee">天机宝库</div><div className="jackpot-payline"/><div className="jackpot-reels">{[0,1,2].map((reelIndex) => <div className="jackpot-reel" key={`${reelRun}-${reelIndex}`}><div className="jackpot-strip" style={{ transform: `translateY(-${reelOffsets[reelIndex]}px)`, transition: `transform ${2.1 + reelIndex * .35}s cubic-bezier(.12,.78,.16,1)` }}>{slotStrip.map((symbol, symbolIndex) => <div className="jackpot-symbol" key={`${reelIndex}-${symbolIndex}`}><img src={symbol.image} alt={symbol.label}/></div>)}</div></div>)}</div></div>
        <div className={`slot-result ${slotResult ? 'show' : ''}`}><small>{slotResult?.triple ? '🎉 TAM TRỤ ĐỒNG NHẤT' : 'PHẦN THƯỞNG'}</small><div>{slotResult && Object.entries(slotResult.rewards).filter(([,amount]) => amount > 0).map(([kind,amount]) => { const rewardAssets: Record<string,string> = { coins:'/items/coin.png',spins:'/items/spin-refund.png',wood:'/items/spin-wood.png',ink:'/items/spin-ink.png',jade:'/items/jade-fragment.png',chests:'/items/daily-chest.png',shields:'/items/spin-castle-shield.png',tickets:'/items/spin-siege-ticket.png',fragments:'/items/spin-destiny-fragment.png',jackpots:'/items/spin-jackpot.png' }; return <span key={kind}><img src={rewardAssets[kind]} alt=""/><b>×{amount}</b></span>; })}</div>{!slotResult && <p>Coin và Spin xuất hiện thường xuyên trên payline.</p>}</div>
        {spinError && <p className="spin-error">{spinError}</p>}
        <button className={`spin-hold-button ${spinBusy ? 'spinning' : ''}`} disabled={!authUser || (progression?.spins.balance ?? 0) < 1} onPointerDown={() => { spinHoldRef.current = true; void spinOnce(); }} onPointerUp={stopHoldingSpin} onPointerCancel={stopHoldingSpin} onPointerLeave={stopHoldingSpin} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { spinHoldRef.current = true; void spinOnce(); } }} onKeyUp={stopHoldingSpin}>{spinBusy ? 'ĐANG QUAY…' : (progression?.spins.balance ?? 0) > 0 ? 'QUAY' : 'HẾT LƯỢT'}<small>Giữ để tự quay</small></button>
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
    const column = round <= 10 ? 3 : 0;
    return [
      vocab[word][column],
      vocab[(word + 2) % vocab.length][column],
      vocab[(word + 4) % vocab.length][column],
      vocab[(word + 6) % vocab.length][column],
    ].sort(() => 0.5 - Math.random());
  }, [word, round, selected]);
  const makeRound = useCallback(() => {
    if (round >= vocab.length) {
      setProgress(100);
      navigate('result');
      return;
    }
    if (round === 10 && !directionBreakDone) {
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
    setRoundTime(8);
    setJudgment('CHỌN ĐÁP ÁN');
    setSequence(
      Array.from(
        { length: Math.min(3 + Math.floor(round / 3), 7) },
        (_, i) => (round * 3 + i * 2) % 4,
      ),
    );
  }, [round, vocab.length, directionBreakDone]);
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
    const nextVocabulary = forcedVocabulary ?? shuffleVocabulary(pool).slice(0, WORDS_PER_MATCH);
    if (!forcedVocabulary) setPvpRoom(null);
    setDailyChallenge(isDailyChallenge);
    setSelected(nextSong);
    setMatchVocabulary(nextVocabulary);
    setScore(0);
    setCombo(0);
    setProgress(0);
    setWord(0);
    setCorrect(0);
    setRound(1);
    setRoundTime(8);
    setSequence([0, 1, 3]);
    setEntered([]);
    setPhase('answer');
    setJudgment('CHỌN ĐÁP ÁN');
    setTypingInput('');
    setTypingTime(8);
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
    const sharedWords = shuffleVocabulary(allVocabulary, room.seed).slice(0, WORDS_PER_MATCH);
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
  const runProgressionAction = async (action: 'buy-item' | 'equip-item' | 'open-chest' | 'upgrade-castle', itemId?: string) => {
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
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Không thể thực hiện thao tác.');
      if (data.progression) setProgression(data.progression);
      if (data.chestReward) setChestReward(data.chestReward);
    } catch (error) {
      setRewardActionError(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.');
    } finally {
      setRewardActionStatus('idle');
    }
  };
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
    return <aside className="pvp-live-score" aria-label="Điểm trực tiếp PvP"><header><span>实时比分</span><b>LIVE</b></header><div className="pvp-live-player me"><i>{me?.name.slice(0, 1).toUpperCase()}</i><span><small>BẠN · {me?.name}</small><b>{myScore.toLocaleString('vi-VN')}</b><em>{Math.max(correct, Number(me?.liveCorrect ?? 0))}/20 đúng</em></span></div><div className="pvp-live-vs">VS</div><div className="pvp-live-player"><i>{rival?.name.slice(0, 1).toUpperCase() ?? '?'}</i><span><small>ĐỐI THỦ · {rival?.name ?? 'Đang kết nối'}</small><b>{Number(rival?.liveScore ?? 0).toLocaleString('vi-VN')}</b><em>{Number(rival?.liveCorrect ?? 0)}/20 đúng</em></span></div></aside>;
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
    const initialScreen = screenFromPath(window.location.pathname);
    if (initialScreen !== screen) animateScreenChange(() => setScreen(initialScreen));
    window.history.replaceState({ hanzibeatScreen: initialScreen }, '', screenPaths[initialScreen]);
    const handleHistory = (event: PopStateEvent) => {
      const previousScreen = (event.state?.hanzibeatScreen as Screen | undefined) ?? screenFromPath(window.location.pathname);
      animateScreenChange(() => setScreen(previousScreen));
    };
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, [animateScreenChange]);
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
    if (round === 10 && !directionBreakDone) {
      setDirectionBreakDone(true);
      setDirectionCountdown(10);
      setTypingLocked(true);
      return;
    }
    setWord((w) => (w + 1) % vocab.length);
    setRound((r) => r + 1);
    setProgress((round / vocab.length) * 100);
    setTypingInput('');
    setTypingTime(8);
    setTypingFeedback('NHẬP ĐÁP ÁN');
    setTypingLocked(false);
  }, [round, vocab.length, directionBreakDone]);
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
    const typingToHanzi = round > 10;
    const target = vocab[word][typingToHanzi ? 0 : 3];
    const normalizedInput = normalizeAnswer(typingInput);
    const acceptedAnswers = typingToHanzi
      ? [normalizeAnswer(target)]
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
      const target = vocab[word][round <= 10 ? 3 : 0];
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
            return 8;
          }
          return v - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [screen, mode, phase, makeRound]);
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
            <b>TYPING BATTLE · {songs[selected][0]}</b>
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
              {round > 10 ? 'NHẬP CHỮ HÁN' : 'NHẬP NGHĨA TIẾNG VIỆT'}
            </span>
            <button className="pronounce" onClick={() => speak(vocab[word][0])}>
              <Volume2 /> Nghe phát âm
            </button>
            <h1>{round > 10 ? vocab[word][3] : vocab[word][0]}</h1>
            <p>{round > 10 ? 'Dịch sang tiếng Trung' : vocab[word][1]}</p>
            <div
              className="time-ring"
              style={
                { '--time': `${(typingTime / 8) * 360}deg` } as CSSProperties
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
                  round > 10 ? 'Ví dụ: 你好' : 'Ví dụ: xin chào'
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
            <b>{songs[selected][0]}</b>
            <small>
              ♪ {currentTrackName} · {songs[selected][2]} BPM · 02:30
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
              {round <= 10 ? 'CHỌN NGHĨA TIẾNG VIỆT' : 'CHỌN CHỮ HÁN'}
            </span>
            <h1>{round <= 10 ? vocab[word][0] : vocab[word][3]}</h1>
            <p>{round <= 10 ? vocab[word][1] : 'Từ nào có nghĩa như trên?'}</p>
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
          <h1>{dailyChallenge ? '每日挑战' : songs[selected][0]}</h1>
          <p>{dailyChallenge ? 'Daily Challenge · HSK 1–9' : songs[selected][1]}</p>
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
    const castle = progression?.castle ?? { wood: 0, ink: 0, jadeBonusCarry: 0, buildings: { main: 1, library: 1, listening: 1 } };
    const castleLevel = Math.max(1, Object.values(castle.buildings).reduce((sum, level) => sum + level, 0) - 2);
    const lowestBuildingLevel = Math.min(...Object.values(castle.buildings));
    const environmentStage = Math.min(5, Math.floor(lowestBuildingLevel / 2) + 1);
    const environmentNames = ['桃源春岛 · Đào Nguyên', '月莲水境 · Nguyệt Liên', '丹霞秋谷 · Đan Hà', '冰川天境 · Băng Thiên', '紫晶神域 · Tử Tinh'];
    const prosperity = castleLevel * 250 + (progression?.discoveries.length ?? 0) * 5 + (progression?.streak ?? 0) * 20;
    const castleTitle = castleLevel >= 25 ? '汉字圣殿 · Thánh Điện Hán Tự' : castleLevel >= 18 ? '王城 · Vương Thành' : castleLevel >= 10 ? '书院城 · Thành Học Viện' : castleLevel >= 5 ? '小院 · Tiểu Viện' : '茅屋 · Thảo Đường';
    const mainBonusRate = mainCastleJadeBonusRates[castle.buildings.main] ?? 10;
    const buildings = [
      { id: 'main', icon: '🏯', hanzi: '主城', name: 'Chủ Thành', description: 'Trái tim của Hán Tự Thành.', baseWood: 80, baseInk: 25, baseCoin: 300 },
      { id: 'library', icon: '📚', hanzi: '藏书阁', name: 'Tàng Thư Các', description: 'Lưu giữ hành trình từ vựng.', baseWood: 55, baseInk: 40, baseCoin: 220 },
      { id: 'listening', icon: '🔔', hanzi: '听音阁', name: 'Thính Âm Các', description: 'Biểu tượng cho năng lực nghe.', baseWood: 65, baseInk: 35, baseCoin: 250 },
    ] as const;
    const selectedBuilding = selectedCastleBuilding ? buildings.find((building) => building.id === selectedCastleBuilding) : null;
    return (
      <main className="app castle-page">
        {historyControls}
        <header className="reward-header"><button className="brand" onClick={() => navigate('home')}><span>汉</span><b>Hanzi Beat</b></button><div className="reward-header-actions"><button onClick={() => navigate('auth')}>Profile</button><button className="leaderboard-back" onClick={() => navigate('home')}>Về trang chủ</button></div></header>
        <section className="castle-panel">
          <div className="castle-hero">
            <div className="castle-copy"><span className="eyebrow">汉字城 · HÁN TỰ THÀNH</span><h1>{castleTitle}</h1><p>Học Hán tự, thu thập nguyên liệu và xây dựng thành trì của riêng bạn.</p><div className="castle-owner-card"><div className={`header-avatar ${progression?.equipped.frame ?? ''}`}>{authUser?.name.slice(0,1).toUpperCase() ?? '汉'}</div><span><small>{authUser?.name ?? 'Người chơi'}</small><b>繁荣度 {prosperity.toLocaleString('vi-VN')}</b></span></div><div className="castle-level"><b>Lv.{castleLevel}</b><span>Điểm phát triển thành</span></div></div>
            <div className={`castle-scene environment-stage-${environmentStage}`} aria-label={castleTitle}><img key={environmentStage} className="castle-map-base" src={environmentStage === 1 ? '/castle/map-empty.webp' : `/castle/environment-stage-${environmentStage}.webp`} alt={`Cảnh giới ${environmentNames[environmentStage - 1]}`}/><div className="castle-environment-badge"><small>CẢNH GIỚI {environmentStage}/5</small><b>{environmentNames[environmentStage - 1]}</b>{environmentStage < 5 && <span>Nâng tất cả công trình lên Lv.{environmentStage * 2} để mở cảnh tiếp theo</span>}</div><CastleMapBuilding kind="main" level={castle.buildings.main} label="主城" onSelect={setSelectedCastleBuilding}/><CastleMapBuilding kind="library" level={castle.buildings.library} label="藏书阁" onSelect={setSelectedCastleBuilding}/><CastleMapBuilding kind="listening" level={castle.buildings.listening} label="听音阁" onSelect={setSelectedCastleBuilding}/></div>
          </div>
          {!authUser ? <div className="inventory-login"><MapIcon /><h2>Hán Tự Thành cần tài khoản</h2><p>Đăng nhập để lưu tài nguyên và công trình trên mọi thiết bị.</p><button onClick={() => navigate('auth')}>Đăng nhập</button></div> : <>
            <div className="castle-resources"><article><span>木</span><div><small>木材 · GỖ</small><b>{castle.wood}</b><p>Nhận từ Offline, Daily và Jackpot</p></div></article><article><span>墨</span><div><small>墨 · MỰC</small><b>{castle.ink}</b><p>Dùng cho công trình học thuật</p></div></article><article className="castle-coin"><img src="/items/coin.png" alt="Coin"/><div><small>铜钱 · COIN XÂY DỰNG</small><b>{progression?.coins ?? 0}</b><p>Nhận chủ yếu từ Jackpot Tam Trụ</p></div></article><article className="castle-economy"><span>玉</span><div><small>PHÚC LỢI CHỦ THÀNH</small><b>+{mainBonusRate}% 玉片</b><p>Áp dụng cho Offline, Daily và PvP · tối đa 10%</p></div></article></div>
            {rewardActionError && <p className="reward-action-error">{rewardActionError}</p>}
            <div className="inventory-heading"><div><span className="eyebrow">建设 · KIẾN THIẾT</span><h2>Công trình trong thành</h2></div><b>Giai đoạn 1</b></div>
            <div className="castle-buildings" id="castle-buildings">{buildings.map((building) => { const level = castle.buildings[building.id]; const visualStage = castleVisualStage(level); const assetStage = building.id === 'main' ? visualStage : 1; const woodCost = building.baseWood * level; const inkCost = building.baseInk * level; const coinCost = castleCoinCost(building.baseCoin, level); const maxed = level >= 10; const affordable = castle.wood >= woodCost && castle.ink >= inkCost && (progression?.coins ?? 0) >= coinCost; return <article key={building.id} id={`building-${building.id}`}><div className={`building-art building-${building.id}`}><img src={`/castle/buildings/${building.id}/stage-${assetStage}.webp`} alt={`${building.name} hình thái ${visualStage}`}/><i>{building.hanzi}</i><b>Hình thái {visualStage}/5</b></div><div className="building-title"><div><small>{building.hanzi}</small><h2>{building.name}</h2></div><b>Lv.{level}</b></div><p>{building.description}</p><div className="building-progress"><i><em style={{width:`${level * 10}%`}} /></i><span>{level}/10</span></div><button disabled={rewardActionStatus === 'loading' || maxed || !affordable} onClick={() => runProgressionAction('upgrade-castle', building.id)}>{maxed ? 'Đã đạt cấp tối đa' : `Nâng cấp · ${coinCost.toLocaleString('vi-VN')} Coin`}</button></article>; })}</div>
          </>}
        </section>
        {selectedBuilding && (() => {
          const level = castle.buildings[selectedBuilding.id];
          const visualStage = castleVisualStage(level);
          const assetStage = selectedBuilding.id === 'main' ? visualStage : 1;
          const woodCost = selectedBuilding.baseWood * level;
          const inkCost = selectedBuilding.baseInk * level;
          const coinCost = castleCoinCost(selectedBuilding.baseCoin, level);
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
          return <div className="castle-upgrade-backdrop" onClick={() => setSelectedCastleBuilding(null)}><section className="castle-upgrade-modal" role="dialog" aria-modal="true" aria-label={`Nâng cấp ${selectedBuilding.name}`} onClick={(event) => event.stopPropagation()}>
            <button className="castle-upgrade-close" onClick={() => setSelectedCastleBuilding(null)} aria-label="Đóng">×</button>
            <header><span>Lv.{level}</span><div><small>{selectedBuilding.hanzi}</small><h2>{selectedBuilding.name}</h2></div></header>
            <div className="castle-upgrade-preview"><img src={`/castle/buildings/${selectedBuilding.id}/stage-${assetStage}.webp`} alt={selectedBuilding.name}/><span>HÌNH THÁI {visualStage}/5</span></div>
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
            <button className="castle-upgrade-submit" disabled={rewardActionStatus === 'loading' || !canUpgrade} onClick={() => runProgressionAction('upgrade-castle', selectedBuilding.id)}>{rewardActionStatus === 'loading' ? 'Đang xây dựng…' : maxed ? 'Đã đạt cấp tối đa' : canUpgrade ? `Nâng lên Lv.${level + 1}` : 'Chưa đủ điều kiện'}</button>
            <footer>Nâng cấp tức thời · Dữ liệu được đồng bộ theo tài khoản</footer>
          </section></div>;
        })()}
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
              <article className="coin-wallet"><img src="/items/coin.png" alt="Coin"/><span><small>XÂY DỰNG</small><b>{progression?.coins ?? 0} Coin</b><p>Dùng nâng cấp Hán Tự Thành</p></span></article>
              <article className="xp-wallet"><span>XP</span><div><small>KINH NGHIỆM</small><b>{progression?.xp ?? 0} XP</b><p>Level {progression?.level ?? 1}</p></div></article>
              <article className="spin-wallet"><img src="/items/celestial-wheel-icon.png" alt="Spin"/><span><small>THIÊN CƠ LUÂN</small><b>{progression?.spins.balance ?? 0} Spin</b><p>Giữ nút vòng quay để sử dụng</p></span></article>
            </div>
            {rewardActionError && <p className="reward-action-error">{rewardActionError}</p>}
            <div className="inventory-heading"><div><span className="eyebrow">VẬT PHẨM</span><h2>Kho đồ của bạn</h2></div><b>{totalItems} vật phẩm</b></div>
            <div className="inventory-grid">
              {itemDefinitions.map((item) => {
                const isCosmetic = item.type === 'frame' || item.type === 'seal' || item.type === 'effect';
                const owned = isCosmetic ? Boolean(progression?.ownedCosmetics.includes(item.id)) : (progression?.inventory?.[item.id] ?? 0) > 0;
                const quantity = isCosmetic ? (owned ? 1 : 0) : progression?.inventory?.[item.id] ?? 0;
                const equipped = isCosmetic && progression?.equipped[item.type] === item.id;
                const action = item.type === 'chest'
                  ? () => runProgressionAction('open-chest')
                  : item.type === 'guard'
                    ? () => navigate('shop')
                    : isCosmetic && owned
                      ? () => runProgressionAction('equip-item', item.id)
                      : undefined;
                const label = item.type === 'chest' ? 'Mở rương'
                  : item.type === 'guard' ? 'Mua thêm'
                    : isCosmetic ? (equipped ? 'Đang trang bị' : owned ? 'Trang bị' : 'Chưa sở hữu')
                      : 'Vật phẩm sưu tầm';
                return <article key={item.id} className={!owned ? 'locked' : equipped ? 'equipped' : ''}>
                  <div className="inventory-art"><img src={item.image} alt={item.name} />{quantity > 0 && <b>×{quantity}</b>}</div>
                  <span>{item.rarity}</span><h3>{item.name}</h3><small>{item.hanzi}</small><p>{item.description}</p>
                  <button onClick={action} disabled={rewardActionStatus === 'loading' || (!owned && item.type !== 'guard') || item.type === 'collectible'}>{rewardActionStatus === 'loading' && action ? 'Đang xử lý…' : label}</button>
                </article>;
              })}
            </div>
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
          <div className="reward-header-actions"><button onClick={() => navigate('inventory')}><Package /> Inventory</button><button className="leaderboard-back" onClick={() => navigate('home')}>Về trang chủ</button></div>
        </header>
        <section className="shop-panel">
          <div className="shop-hero"><div><span className="eyebrow"><ShoppingBag /> 珍宝阁 · TRÂN BẢO CÁC</span><h1>Cửa hàng cosmetic</h1><p>Dùng Mảnh Ngọc kiếm từ Daily, Offline và PvP để tạo phong cách riêng.</p></div><div className="shop-account-preview"><div className={`shop-preview-avatar ${progression?.equipped.frame ?? ''}`}>{authUser?.name.slice(0, 1).toUpperCase() ?? '汉'}</div><span><small>KHUNG ĐANG DÙNG</small><b>{progression?.equipped.frame ? shopItems.find((item) => item.id === progression.equipped.frame)?.name : 'Khung mặc định'}</b></span></div><div className="shop-balance"><img src="/items/jade-fragment.png" alt="Mảnh Ngọc" /><span><small>SỐ DƯ</small><b>{progression?.jade ?? 0} 玉片</b></span></div></div>
          {!authUser ? <div className="inventory-login"><ShoppingBag /><h2>Đăng nhập để mua vật phẩm</h2><p>Cosmetic và Mảnh Ngọc sẽ được đồng bộ theo tài khoản.</p><button onClick={() => navigate('auth')}>Đăng nhập</button></div> : <>
            {rewardActionError && <p className="reward-action-error">{rewardActionError}</p>}
            <div className="shop-grid">
              {shopItems.map((item) => {
                const owned = item.type !== 'consumable' && progression?.ownedCosmetics.includes(item.id);
                const equipped = item.type !== 'consumable' && progression?.equipped[item.type] === item.id;
                const guardCount = progression?.inventory['streak-guard'] ?? 0;
                const cannotBuy = (progression?.jade ?? 0) < item.price || (item.id === 'streak-guard' && guardCount >= 2);
                return <article key={item.id} className={`${item.rarity === 'Huyền thoại' ? 'legendary' : ''} ${equipped ? 'equipped' : ''}`}>
                  <div className="shop-item-art"><img src={item.image} alt={item.name} />{item.id === 'streak-guard' && <b>{guardCount}/2</b>}</div>
                  <span>{item.rarity}</span><h2>{item.name}</h2><small>{item.hanzi}</small><p>{item.description}</p>
                  {owned ? <button className="equip-button" disabled={rewardActionStatus === 'loading'} onClick={() => runProgressionAction('equip-item', item.id)}>{rewardActionStatus === 'loading' ? 'Đang đồng bộ…' : equipped ? '✓ Đang dùng · Bấm để tháo' : item.type === 'frame' ? 'Trang bị lên Avatar' : 'Trang bị'}</button> : <button disabled={rewardActionStatus === 'loading' || cannotBuy} onClick={() => runProgressionAction('buy-item', item.id)}><img src="/items/jade-fragment.png" alt="" />{cannotBuy && item.id === 'streak-guard' && guardCount >= 2 ? 'Đã đạt tối đa' : `${item.price} 玉片`}</button>}
                </article>;
              })}
            </div>
          </>}
        </section>
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
          {authUser && pvpRank && <div className="pvp-rank-card"><div><span>赛季 {pvpRank.season}</span><h2>{pvpRank.rank}</h2><small>PvP Rank theo mùa</small></div><strong>{pvpRank.mmr}<small>MMR</small></strong><ul><li><b>{pvpRank.wins}</b>Thắng</li><li><b>{pvpRank.losses}</b>Thua</li><li><b>{pvpRank.draws}</b>Hòa</li></ul></div>}
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
            <p>Top 50 điểm cao nhất của từng màn và chế độ.</p>
          </div>
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
        </section>
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
      {playModeOpen && <div className="play-mode-backdrop" onMouseDown={() => setPlayModeOpen(false)}><section className="play-mode-modal" role="dialog" aria-modal="true" aria-labelledby="play-mode-title" onMouseDown={(event) => event.stopPropagation()}><button className="play-mode-close" onClick={() => setPlayModeOpen(false)} aria-label="Đóng">×</button><div className="play-mode-heading"><span>选择模式 · CHỌN CHẾ ĐỘ</span><h2 id="play-mode-title">Bạn muốn chơi theo cách nào?</h2><p>Mỗi hành trình đều giúp mở khóa Hán tự và phần thưởng tài khoản.</p></div><div className="play-mode-options"><button onClick={() => { setPlayModeOpen(false); navigate('songs'); }}><i>单</i><span><small>SOLO JOURNEY</small><b>Chơi đơn</b><p>Chọn bài học HSK và luyện tập theo nhịp của riêng bạn.</p><em>Vào Bài học →</em></span></button><button className="pvp-option" onClick={() => { setPlayModeOpen(false); openPvp(); }}><i>战</i><span><small>ONLINE ARENA</small><b>PvP Online</b><p>Ghép trận hoặc tạo phòng, thi đấu Rank cùng người chơi khác.</p><em>Vào Đấu trường →</em></span></button></div><footer><span>汉</span> Học một mình · Tiến bộ cùng nhau</footer></section></div>}
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
                <button onClick={() => setPlayModeOpen(true)}>
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
        <section className="page">
          <div className="title">
            <span className="eyebrow">FREE PLAY</span>
            <h1>Chọn kho từ vựng</h1>
            <p>Mỗi cấp HSK dùng trực tiếp từ vựng đang có trong từ điển.</p>
          </div>
          <div className="mode-picker">
            <button
              className={mode === 'audition' ? 'active' : ''}
              onClick={() => setMode('audition')}
            >
              <span className="mode-artwork"><img src="/lesson-rhythm-quiz.webp" alt="Minh họa Rhythm Quiz với thẻ từ vựng và bốn đáp án theo nhịp" /></span>
              <b>Rhythm Quiz</b>
              <small>Luân phiên chọn nghĩa tiếng Việt và chữ Hán</small>
            </button>
            <button
              className={mode === 'typing' ? 'active typing' : ''}
              onClick={() => setMode('typing')}
            >
              <span className="mode-artwork"><img src="/lesson-typing-battle.webp" alt="Minh họa Typing Battle với bàn phím Hán tự phát sáng" /></span>
              <b>Typing Battle</b>
              <small>Luân phiên dịch chữ Hán và nghĩa tiếng Việt</small>
            </button>
          </div>
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
                  onClick={() => {
                    start(i);
                  }}
                >
                  <Play />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {screen === 'dictionary' && (
        <section className="page">
          <div className="title">
            <span className="eyebrow">MY VOCABULARY</span>
            <h1>{selectedHskFolder ? `Từ vựng HSK ${selectedHskFolder}` : 'Thư mục từ vựng'}</h1>
            <p>{selectedHskFolder ? `${filteredVocabulary.length} từ trong thư mục HSK ${selectedHskFolder}.` : `${allVocabulary.length} từ được sắp xếp theo từng cấp độ HSK.`}</p>
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
