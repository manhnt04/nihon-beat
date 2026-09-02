'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  BookOpen,
  Flame,
  Music2,
  Play,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  deleteAudioTrack,
  getAudioTracks,
  saveAudioFiles,
  type AudioTrack,
} from '@/lib/audio-library';

type Screen = 'home' | 'songs' | 'game' | 'result' | 'dictionary';
const vocab = [
  ['食べ物', 'たべもの', 'tabemono', 'đồ ăn'],
  ['友達', 'ともだち', 'tomodachi', 'bạn bè'],
  ['学校', 'がっこう', 'gakkou', 'trường học'],
  ['音楽', 'おんがく', 'ongaku', 'âm nhạc'],
  ['大好き', 'だいすき', 'daisuki', 'rất thích'],
  ['おはよう', 'おはよう', 'ohayou', 'chào buổi sáng'],
];
const songs = [
  ['桜ステップ', 'Sakura Step', '128', 'N5', 'Easy', '#ff5f91'],
  ['星空ドライブ', 'Hoshizora Drive', '154', 'N4', 'Normal', '#7857ff'],
  ['東京ネオン', 'Tokyo Neon', '178', 'N3', 'Hard', '#19c6d3'],
];
const arrowKeys = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const arrowGlyphs = ['←', '↓', '↑', '→'];

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
  const [roundTime, setRoundTime] = useState(6);
  const [beat, setBeat] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [typingInput, setTypingInput] = useState('');
  const [typingTime, setTypingTime] = useState(8);
  const [typingFeedback, setTypingFeedback] = useState('NHẬP ĐÁP ÁN');
  const [typingLocked, setTypingLocked] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [volume, setVolume] = useState(0.65);
  const [currentTrackName, setCurrentTrackName] = useState('Chưa có nhạc');
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const typingInputRef = useRef<HTMLInputElement | null>(null);
  const options = useMemo(() => {
    const column = round % 3 === 0 ? 2 : 3;
    return [
      vocab[word][column],
      vocab[(word + 2) % vocab.length][column],
      vocab[(word + 4) % vocab.length][column],
    ].sort(() => 0.5 - Math.random());
  }, [word, round]);
  const makeRound = useCallback(() => {
    setWord((w) => (w + 1) % vocab.length);
    setRound((r) => r + 1);
    setPhase('answer');
    setEntered([]);
    setRoundTime(6);
    setJudgment('DỊCH TỪ');
    setSequence(
      Array.from(
        { length: Math.min(3 + Math.floor(round / 3), 7) },
        (_, i) => (round * 3 + i * 2) % 4,
      ),
    );
  }, [round]);
  const start = () => {
    setScore(0);
    setCombo(0);
    setProgress(0);
    setWord(0);
    setCorrect(0);
    setRound(1);
    setRoundTime(6);
    setSequence([0, 1, 3]);
    setEntered([]);
    setPhase('answer');
    setJudgment('DỊCH TỪ');
    setTypingInput('');
    setTypingTime(8);
    setTypingFeedback('NHẬP ĐÁP ÁN');
    setTypingLocked(false);
    setScreen('game');
    if (audioTracks.length) {
      const track = audioTracks[Math.floor(Math.random() * audioTracks.length)];
      audioPlayer.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(track.blob);
      const player = new Audio(audioUrl.current);
      player.loop = true;
      player.volume = volume;
      audioPlayer.current = player;
      setCurrentTrackName(track.name);
      void player.play().catch(() => undefined);
    } else {
      setCurrentTrackName('Chưa tải nhạc');
    }
  };
  const normalizeAnswer = (value: string) =>
    value
      .trim()
      .toLocaleLowerCase('vi')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  const nextTypingWord = useCallback(() => {
    setWord((w) => (w + 1) % vocab.length);
    setRound((r) => r + 1);
    setTypingInput('');
    setTypingTime(8);
    setTypingFeedback('NHẬP ĐÁP ÁN');
    setTypingLocked(false);
  }, []);
  const submitTyping = (event: FormEvent) => {
    event.preventDefault();
    if (typingLocked || !typingInput.trim()) return;
    setTypingLocked(true);
    const target = vocab[word][round % 2 === 0 ? 2 : 3];
    if (normalizeAnswer(typingInput) === normalizeAnswer(target)) {
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
      setCombo(0);
      setTypingFeedback(`ĐÁP ÁN: ${target}`);
    }
    setTimeout(nextTypingWord, 800);
  };
  const chooseAnswer = useCallback(
    (answer: string) => {
      if (phase !== 'answer') return;
      const target = vocab[word][round % 3 === 0 ? 2 : 3];
      if (answer === target) {
        setCorrect((c) => c + 1);
        setScore((s) => s + 500);
        setJudgment('CHÍNH XÁC!');
        setPhase('sequence');
      } else {
        setCombo(0);
        setJudgment('SAI NGHĨA');
        setTimeout(() => setPhase('sequence'), 450);
      }
    },
    [phase, word, round],
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
      if (e.code === 'Space') {
        e.preventDefault();
        hitBeat();
        return;
      }
      if (
        phase === 'answer' &&
        ['Digit1', 'Digit2', 'Digit3'].includes(e.code)
      ) {
        chooseAnswer(options[Number(e.code.slice(-1)) - 1]);
        return;
      }
      const lane = arrowKeys.indexOf(e.key);
      if (lane >= 0) {
        e.preventDefault();
        pressArrow(lane);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [screen, mode, phase, options, chooseAnswer, pressArrow, hitBeat]);
  useEffect(() => {
    if (screen !== 'game') return;
    const started = Date.now();
    const duration = 150000;
    const t = setInterval(() => {
      const elapsed = Date.now() - started;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      setBeat((elapsed / 12) % 100);
      if (elapsed >= duration) setScreen('result');
    }, 50);
    return () => clearInterval(t);
  }, [screen]);
  useEffect(() => {
    if (screen !== 'game' || mode !== 'audition' || phase === 'beat') return;
    const t = setInterval(
      () =>
        setRoundTime((v) => {
          if (v <= 1) {
            setCombo(0);
            setJudgment('TIME OUT');
            setTimeout(makeRound, 350);
            return 6;
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
    const savedVolume = Number(localStorage.getItem('nihon-beat-volume'));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1)
      setVolume(savedVolume);
    return () => {
      audioPlayer.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, [refreshAudioTracks]);
  useEffect(() => {
    if (audioPlayer.current) audioPlayer.current.volume = volume;
    localStorage.setItem('nihon-beat-volume', String(volume));
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
          description: 'Chọn và bắt đầu một bài hát trong Nihon Beat.',
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
            setScreen('game');
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
  const speak = (text: string) =>
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));

  if (screen === 'game' && mode === 'typing')
    return (
      <main className="game typing-battle">
        <div className="hud">
          <button onClick={() => setScreen('songs')}>EXIT</button>
          <div>
            <small>SCORE</small>
            <b>{score.toLocaleString()}</b>
          </div>
          <div className="now">
            <b>TYPING BATTLE · {songs[selected][0]}</b>
            <small>♪ {currentTrackName} · 02:30</small>
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
          <span>あ</span>
          <span>日</span>
          <span>語</span>
          <span>♪</span>
        </div>
        <section className="typing-stage">
          <div className="typing-round">
            <span>CÂU {round}</span>
            <b>{typingTime}s</b>
          </div>
          <article className={`typing-card ${typingLocked ? 'locked' : ''}`}>
            <span className="typing-label">
              {round % 2 === 0 ? 'NHẬP ROMAJI' : 'NHẬP NGHĨA TIẾNG VIỆT'}
            </span>
            <button className="pronounce" onClick={() => speak(vocab[word][1])}>
              <Volume2 /> Nghe phát âm
            </button>
            <h1>{vocab[word][0]}</h1>
            <p>{vocab[word][1]}</p>
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
                  round % 2 === 0 ? 'Ví dụ: tabemono' : 'Ví dụ: đồ ăn'
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
          <button onClick={() => setScreen('songs')}>EXIT</button>
          <div>
            <small>SCORE</small>
            <b>{score.toLocaleString()}</b>
          </div>
          <div className="now">
            <b>{songs[selected][0]}</b>
            <small>
              ♪ {currentTrackName} · {songs[selected][2]} BPM · 02:30
            </small>
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
              {round % 3 === 0 ? 'DỊCH SANG ROMAJI' : 'DỊCH SANG TIẾNG VIỆT'}
            </span>
            <h1>{vocab[word][0]}</h1>
            <p>{vocab[word][1]}</p>
            {phase === 'answer' ? (
              <div className="answer-options">
                {options.map((o, i) => (
                  <button key={o} onClick={() => chooseAnswer(o)}>
                    <kbd>{i + 1}</kbd>
                    {round % 3 === 0 && o === vocab[word][3]
                      ? vocab[word][2]
                      : o}
                  </button>
                ))}
              </div>
            ) : (
              <div className="answer-reveal">
                <b>{vocab[word][2]}</b>
                <span>{vocab[word][3]}</span>
              </div>
            )}
          </article>
          <div className="dance-avatar">
            <div className="dancer-head">◡ ‿ ◡</div>
            <div className="dancer-body">日</div>
          </div>
          <div className={`command-panel ${phase}`}>
            <strong className="judgment">{judgment}</strong>
            <div className="sequence">
              {sequence.map((lane, i) => (
                <span
                  className={`c${lane} ${i < entered.length ? 'done' : ''} ${i === entered.length ? 'current' : ''}`}
                  key={`${lane}-${i}`}
                >
                  {arrowGlyphs[lane]}
                </span>
              ))}
            </div>
            {phase === 'beat' && (
              <div className="beat-track">
                <i style={{ left: `${beat}%` }} />
                <b>SPACE</b>
              </div>
            )}
            <div className="touch-controls">
              {arrowGlyphs.map((glyph, lane) => (
                <button
                  className={`c${lane} ${active === lane ? 'pressed' : ''}`}
                  onPointerDown={() => pressArrow(lane)}
                  key={glyph}
                >
                  {glyph}
                </button>
              ))}
              <button className="space-button" onPointerDown={hitBeat}>
                SPACE
              </button>
            </div>
            <p>
              {phase === 'answer'
                ? 'Chọn nghĩa bằng phím 1 · 2 · 3'
                : phase === 'sequence'
                  ? 'Nhập chuỗi phím mũi tên'
                  : 'Nhấn SPACE khi vệt sáng vào giữa'}
            </p>
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
        <section>
          <span className="eyebrow">
            {mode === 'typing' ? 'TYPING BATTLE COMPLETE!' : 'DANCE COMPLETE!'}
          </span>
          <div className="rank">A</div>
          <h1>{songs[selected][0]}</h1>
          <p>{songs[selected][1]}</p>
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
          <div className="actions">
            <button onClick={start}>
              <Play /> Chơi lại
            </button>
            <button onClick={() => setScreen('dictionary')}>
              <BookOpen /> Ôn từ
            </button>
            <button onClick={() => setScreen('home')}>Về menu</button>
          </div>
        </section>
      </main>
    );
  return (
    <main className="app">
      <header>
        <button className="brand" onClick={() => setScreen('home')}>
          <span>日</span>
          <b>
            Nihon Beat<small>Learn Japanese in rhythm</small>
          </b>
        </button>
        <nav>
          <button
            className={screen === 'home' ? 'on' : ''}
            onClick={() => setScreen('home')}
          >
            Trang chủ
          </button>
          <button
            className={screen === 'songs' ? 'on' : ''}
            onClick={() => setScreen('songs')}
          >
            Bài hát
          </button>
          <button
            className={screen === 'dictionary' ? 'on' : ''}
            onClick={() => setScreen('dictionary')}
          >
            Từ điển
          </button>
        </nav>
        <button
          className="user audio-library-button"
          onClick={() => setAudioOpen(true)}
        >
          <span>
            <Music2 />
          </span>
          <b>
            Thư viện nhạc
            <small>
              {audioTracks.length} bài · <Settings /> Cài đặt
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
                <p>Mỗi trận sẽ chọn ngẫu nhiên một bài trong danh sách.</p>
              </div>
              <button onClick={() => setAudioOpen(false)} aria-label="Đóng">
                ×
              </button>
            </div>
            <label className="audio-upload">
              <Upload />
              <span>
                <b>Tải file âm thanh</b>
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
                <Sparkles /> HỌC TIẾNG NHẬT QUA ÂM NHẬC
              </span>
              <h1>
                Chạm đúng nhịp.
                <br />
                <em>Nhớ đúng từ.</em>
              </h1>
              <p>
                Mỗi phím bấm là một từ vựng mới. Bắt đầu hành trình từ N5 đến N1
                theo cách vui nhất.
              </p>
              <div className="actions">
                <button onClick={() => setScreen('songs')}>
                  <Play /> Chơi ngay
                </button>
                <button onClick={() => setScreen('dictionary')}>
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
            <div className="mascot">
              <div className="head">◡ ‿ ◡</div>
              <div className="body">日</div>
              <span>♪</span>
              <b>
                Let’s go!<small>がんばって！</small>
              </b>
            </div>
          </section>
          <aside>
            <section className="daily">
              <span className="eyebrow">DAILY CHALLENGE</span>
              <h3>Tokyo Morning</h3>
              <p>Hoàn thành trước 23:59</p>
              <button onClick={start}>
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
              <h2>N5 · Chào hỏi & Hằng ngày</h2>
            </div>
            <article>
              <div className="album">
                桜<Music2 />
              </div>
              <div>
                <h3>
                  桜ステップ <small>Sakura Step</small>
                </h3>
                <p>128 BPM · 12 từ vựng</p>
                <i>
                  <b />
                </i>
              </div>
              <strong>
                84,650<small>BEST SCORE</small>
              </strong>
              <button onClick={start}>
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
            <h1>Chọn giai điệu của bạn</h1>
            <p>Mỗi bài hát là một chủ đề từ vựng mới.</p>
          </div>
          <div className="mode-picker">
            <button
              className={mode === 'audition' ? 'active' : ''}
              onClick={() => setMode('audition')}
            >
              <span>← ↓ ↑ →</span>
              <b>Rhythm Dance</b>
              <small>Nhập chuỗi phím và canh Space đúng nhịp</small>
            </button>
            <button
              className={mode === 'typing' ? 'active typing' : ''}
              onClick={() => setMode('typing')}
            >
              <span>あ → A</span>
              <b>Typing Battle</b>
              <small>Gõ đáp án thật nhanh để tạo chuỗi Perfect</small>
            </button>
          </div>
          <div className="filters">
            <button>Tất cả</button>
            <button>N5</button>
            <button>N4</button>
            <button>N3</button>
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
                    {s[2]} BPM · {12 + i * 6} từ
                  </small>
                </strong>
                <button
                  onClick={() => {
                    setSelected(i);
                    start();
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
            <h1>Từ điển của tôi</h1>
            <p>Những từ bạn đã gặp trên hành trình âm nhạc.</p>
          </div>
          <div className="words">
            {vocab.map((w, i) => (
              <article key={w[2]}>
                <div>
                  <span className={`master m${i % 3}`}>
                    {i % 3 === 0
                      ? 'Đã thuộc'
                      : i % 3 === 1
                        ? 'Đang học'
                        : 'Cần ôn'}
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
          </div>
        </section>
      )}
    </main>
  );
}
