'use client';

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
  Music2,
  Play,
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
  | 'auth';
type AuthUser = { id: string; name: string; email: string };
type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  correct: number;
  createdAt: string;
};
type PvpPlayer = { id: string; name: string; score: number | null; correct: number | null };
type PvpRoom = { code: string; seed: number; mode: 'audition' | 'typing'; status: 'waiting' | 'playing' | 'finished'; host: PvpPlayer; guest: PvpPlayer | null };
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
  const [audioOpen, setAudioOpen] = useState(false);
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
  const [dailyChallenge, setDailyChallenge] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [authError, setAuthError] = useState('');
  const pvpPlayerId = useRef('');
  const pvpStarted = useRef(false);
  const pvpScoreSent = useRef(false);
  const cloudMatchSaved = useRef(false);
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
    window.history.pushState({ hanzibeatScreen: nextScreen }, '');
    animateScreenChange(() => setScreen(nextScreen));
  }, [screen, animateScreenChange]);
  const historyControls = (
    <div className="history-controls" aria-label="Điều hướng trang">
      <button onClick={() => window.history.back()} aria-label="Quay lại trang trước" title="Trang trước"><ChevronLeft /></button>
      <button onClick={() => window.history.forward()} aria-label="Đi tới trang sau" title="Trang sau"><ChevronRight /></button>
    </div>
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
    const column = round % 2 === 1 ? 3 : 0;
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
  }, [round, vocab.length]);
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
    setScoreStatus('idle');
    cloudMatchSaved.current = false;
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
    setPvpRoom(room);
    setMode(room.mode ?? 'typing');
    const sharedWords = shuffleVocabulary(allVocabulary, room.seed).slice(0, WORDS_PER_MATCH);
    start(1, sharedWords);
  }, []);
  const pvpAction = async (action: 'match' | 'create' | 'join') => {
    const name = (pvpName || playerName).trim();
    if (name.length < 2) {
      setPvpError('Hãy nhập tên có ít nhất 2 ký tự.');
      return;
    }
    setPvpError('');
    setPvpWaiting(true);
    try {
      const response = await fetch('/api/pvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerId: ensurePvpPlayer(), name, code: pvpCode, mode: pvpGameMode }),
      });
      const data = (await response.json()) as { room?: PvpRoom | null; error?: string };
      if (!response.ok) throw new Error(data.error || 'Không thể kết nối PvP.');
      localStorage.setItem('hanzibeat-player-name', name);
      setPlayerName(name);
      setPvpRoom(data.room ?? null);
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
      <button className={screen === 'songs' ? 'on' : ''} onClick={() => navigate('songs')}>
        <Music2 /><span>Bài học</span>
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
        return;
      }
      const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Người chơi';
      setAuthUser({ id: firebaseUser.uid, name, email: firebaseUser.email || '' });
      setPlayerName(name);
      setPvpName(name);
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
    window.history.replaceState({ hanzibeatScreen: screen }, '');
    const validScreens: Screen[] = ['home', 'songs', 'game', 'result', 'dictionary', 'leaderboard', 'pvp', 'auth'];
    const handleHistory = (event: PopStateEvent) => {
      const previousScreen = event.state?.hanzibeatScreen as Screen | undefined;
      if (previousScreen && validScreens.includes(previousScreen)) {
        animateScreenChange(() => setScreen(previousScreen));
      }
    };
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, [animateScreenChange]);
  useEffect(() => {
    if (screen === 'leaderboard') void loadLeaderboard();
  }, [screen, loadLeaderboard]);
  useEffect(() => {
    if (screen !== 'pvp' || (!pvpWaiting && !pvpRoom)) return;
    const timer = window.setInterval(async () => {
      try {
        const query = pvpRoom?.code
          ? `code=${pvpRoom.code}`
          : `playerId=${ensurePvpPlayer()}`;
        const response = await fetch(`/api/pvp?${query}`, { cache: 'no-store' });
        const data = (await response.json()) as { room?: PvpRoom | null };
        if (data.room) {
          setPvpRoom(data.room);
          if (data.room.status === 'playing') beginPvpGame(data.room);
        }
      } catch { /* retry on next poll */ }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [screen, pvpWaiting, pvpRoom?.code, beginPvpGame]);
  useEffect(() => {
    if (screen !== 'result' || !pvpRoom || pvpScoreSent.current) return;
    pvpScoreSent.current = true;
    void fetch('/api/pvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'score', playerId: ensurePvpPlayer(), code: pvpRoom.code, score, correct }),
    }).then((response) => response.json() as Promise<{ room?: PvpRoom }>).then((data) => data.room && setPvpRoom(data.room));
  }, [screen, pvpRoom?.code, score, correct]);
  useEffect(() => {
    if (screen !== 'result' || !pvpRoom || pvpRoom.status === 'finished') return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/pvp?code=${pvpRoom.code}`, { cache: 'no-store' });
      const data = (await response.json()) as { room?: PvpRoom | null };
      if (data.room) setPvpRoom(data.room);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [screen, pvpRoom?.code, pvpRoom?.status]);
  const nextTypingWord = useCallback(() => {
    if (round >= vocab.length) {
      setProgress(100);
      navigate('result');
      return;
    }
    setWord((w) => (w + 1) % vocab.length);
    setRound((r) => r + 1);
    setProgress((round / vocab.length) * 100);
    setTypingInput('');
    setTypingTime(8);
    setTypingFeedback('NHẬP ĐÁP ÁN');
    setTypingLocked(false);
  }, [round, vocab.length]);
  const submitTyping = (event: FormEvent) => {
    event.preventDefault();
    if (typingLocked || !typingInput.trim()) return;
    setTypingLocked(true);
    const typingToHanzi = round % 2 === 0;
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
      const target = vocab[word][round % 2 === 1 ? 3 : 0];
      if (answer === target) {
        playAnswerSound('correct');
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
    [phase, word, round, combo, roundTime, makeRound],
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
        <section className="typing-stage">
          <div className="typing-round">
            <span>CÂU {round}</span>
            <b>{typingTime}s</b>
          </div>
          <article className={`typing-card ${typingLocked ? 'locked' : ''}`}>
            <span className="typing-label">
              {round % 2 === 0 ? 'NHẬP CHỮ HÁN' : 'NHẬP NGHĨA TIẾNG VIỆT'}
            </span>
            <button className="pronounce" onClick={() => speak(vocab[word][0])}>
              <Volume2 /> Nghe phát âm
            </button>
            <h1>{round % 2 === 0 ? vocab[word][3] : vocab[word][0]}</h1>
            <p>{round % 2 === 0 ? 'Dịch sang tiếng Trung' : vocab[word][1]}</p>
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
                  round % 2 === 0 ? 'Ví dụ: 你好' : 'Ví dụ: xin chào'
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
        <section className="audition-stage">
          <div className="round-info">
            <span>ROUND {round}</span>
            <b>{roundTime}s</b>
          </div>
          <article className="quiz-card">
            <span>
              {round % 2 === 1 ? 'CHỌN NGHĨA TIẾNG VIỆT' : 'CHỌN CHỮ HÁN'}
            </span>
            <h1>{round % 2 === 1 ? vocab[word][0] : vocab[word][3]}</h1>
            <p>{round % 2 === 1 ? vocab[word][1] : 'Từ nào có nghĩa như trên?'}</p>
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
          {pvpRoom && (() => {
            const me = pvpRoom.host.id === pvpPlayerId.current ? pvpRoom.host : pvpRoom.guest;
            const rival = pvpRoom.host.id === pvpPlayerId.current ? pvpRoom.guest : pvpRoom.host;
            const finished = pvpRoom.status === 'finished' && me?.score !== null && rival?.score !== null;
            const outcome = finished ? (me!.score! > rival!.score! ? 'CHIẾN THẮNG!' : me!.score! < rival!.score! ? 'THUA CUỘC' : 'HÒA!') : 'Đang chờ đối thủ hoàn thành...';
            return <div className="pvp-result"><span>PVP · PHÒNG {pvpRoom.code}</span><h2>{outcome}</h2><div><b>{me?.name}<small>{me?.score?.toLocaleString() ?? score.toLocaleString()}</small></b><i>VS</i><b>{rival?.name ?? 'Đối thủ'}<small>{rival?.score?.toLocaleString() ?? 'Đang chơi'}</small></b></div></div>;
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
              <div>{authUser.name.slice(0, 1).toUpperCase()}</div>
              <span>ĐÃ ĐĂNG NHẬP</span>
              <h1>{authUser.name}</h1>
              <p>{authUser.email}</p>
              <button className="auth-music" onClick={() => { setAudioOpen(true); navigate('home'); }}><Music2 /> Thư viện nhạc <small>{audioTracks.length} bài đã lưu</small></button>
              <button onClick={logout}><LogOut /> Đăng xuất</button>
              <button className="auth-home" onClick={() => navigate('home')}>Về trang chủ</button>
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
          {!pvpRoom && !pvpWaiting ? <>
            <label className="pvp-name">Tên người chơi<input value={pvpName} maxLength={20} onChange={(event) => setPvpName(event.target.value)} placeholder="Nhập tên của bạn" /></label>
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
            className={screen === 'songs' ? 'on' : ''}
            onClick={() => navigate('songs')}
          >
            Bài học
          </button>
          <button
            className={screen === 'dictionary' ? 'on' : ''}
            onClick={() => navigate('dictionary')}
          >
            Từ điển
          </button>
          <button onClick={openLeaderboard}>Xếp hạng</button>
          <button onClick={openPvp}>PvP Online</button>
        </nav>
        <button
          className="user account-button"
          onClick={() => navigate('auth')}
        >
          <span>
            {authUser ? authUser.name.slice(0, 1).toUpperCase() : <LogIn />}
          </span>
          <b>
            {authUser ? authUser.name : 'Đăng nhập'}
            <small>
              {authUser ? 'Tài khoản & cài đặt' : 'Đăng ký tài khoản'}
            </small>
          </b>
        </button>
      </header>
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
                <button onClick={() => navigate('songs')}>
                  <Play /> Chơi ngay
                </button>
                <button onClick={() => navigate('dictionary')}>
                  <BookOpen /> Từ điển của tôi
                </button>
              </div>
              <div className="streak">
                <Flame />
                <span>
                  <b>7 ngày liên tiếp!</b>
                  <small>Thêm 1 ngày nữa để nhận 100 XP</small>
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
              <h3>Tiến độ hôm nay</h3>
              <div>
                <span>
                  13<small>/ 20 từ</small>
                </span>
              </div>
              <p>
                Chỉ còn <b>7 từ</b> để đạt mục tiêu!
              </p>
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
              <b>18</b>Bài đã xong
            </span>
            <span>
              <BookOpen />
              <b>126</b>Từ đã học
            </span>
            <span>
              <Flame />
              <b>42</b>Combo cao nhất
            </span>
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
              <span>← ↓ ↑ →</span>
              <b>Rhythm Quiz</b>
              <small>Luân phiên chọn nghĩa tiếng Việt và chữ Hán</small>
            </button>
            <button
              className={mode === 'typing' ? 'active typing' : ''}
              onClick={() => setMode('typing')}
            >
              <span>汉 ⇄ Việt</span>
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
