'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Flame, Music2, Play, Sparkles, Trophy, Volume2 } from 'lucide-react';

type Screen = 'home' | 'songs' | 'game' | 'result' | 'dictionary';
const vocab = [
  ['食べ物','たべもの','tabemono','đồ ăn'],['友達','ともだち','tomodachi','bạn bè'],['学校','がっこう','gakkou','trường học'],['音楽','おんがく','ongaku','âm nhạc'],['大好き','だいすき','daisuki','rất thích'],['おはよう','おはよう','ohayou','chào buổi sáng']
];
const songs = [
  ['桜ステップ','Sakura Step','128','N5','Easy','#ff5f91'],['星空ドライブ','Hoshizora Drive','154','N4','Normal','#7857ff'],['東京ネオン','Tokyo Neon','178','N3','Hard','#19c6d3']
];
const keys = ['D','F','J','K'];

export default function Home() {
  const [screen,setScreen]=useState<Screen>('home');
  const [selected,setSelected]=useState(0);
  const [score,setScore]=useState(0);
  const [combo,setCombo]=useState(0);
  const [word,setWord]=useState(0);
  const [progress,setProgress]=useState(0);
  const [judgment,setJudgment]=useState('READY?');
  const [active,setActive]=useState(-1);
  const start=()=>{setScore(0);setCombo(0);setProgress(0);setJudgment('READY?');setScreen('game')};
  const hit=useCallback((lane:number)=>{if(screen!=='game')return;setActive(lane);setTimeout(()=>setActive(-1),120);setCombo(c=>c+1);setScore(s=>s+900+combo*15);setWord(w=>(w+lane+1)%vocab.length);setJudgment(combo%4===3?'PERFECT':'GREAT')},[screen,combo]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{const lane=keys.indexOf(e.key.toUpperCase());if(lane>=0)hit(lane)};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey)},[hit]);
  useEffect(()=>{if(screen!=='game')return;const t=setInterval(()=>setProgress(p=>{if(p>=100){setScreen('result');return 100}return p+1}),100);return()=>clearInterval(t)},[screen]);
  useEffect(()=>{
    const controller=new AbortController();
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void}}).modelContext;
    if(!context?.registerTool)return;
    try{context.registerTool({name:'start_rhythm_song',title:'Bắt đầu bài hát',description:'Chọn và bắt đầu một bài hát trong Nihon Beat.',inputSchema:{type:'object',properties:{songIndex:{type:'integer',minimum:0,maximum:2}},required:['songIndex'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{const i=(input as {songIndex:number}).songIndex;if(!Number.isInteger(i)||i<0||i>=songs.length)throw new Error('songIndex không hợp lệ');setSelected(i);setScore(0);setCombo(0);setProgress(0);setScreen('game');return{status:'started',song:songs[i][1]}}},{signal:controller.signal})}catch{/* Browser chưa hỗ trợ WebMCP. */}
    return()=>controller.abort();
  },[]);
  const speak=(text:string)=>speechSynthesis.speak(new SpeechSynthesisUtterance(text));

  if(screen==='game') return <main className="game"><div className="hud"><button onClick={()=>setScreen('songs')}>EXIT</button><div><small>SCORE</small><b>{score.toLocaleString()}</b></div><div className="now"><b>{songs[selected][0]}</b><small>{songs[selected][1]} · {songs[selected][2]} BPM</small></div><div><small>COMBO</small><b>{combo}</b></div></div><div className="bar"><i style={{width:`${progress}%`}}/></div><div className="stage"><aside className="word-card"><small>NOW LEARNING</small><h2>{vocab[word][0]}</h2><p>{vocab[word][1]} · {vocab[word][2]}</p><b>{vocab[word][3]}</b><button onClick={()=>speak(vocab[word][1])}><Volume2/> Nghe lại</button></aside><section className="lanes"><strong className="judgment">{judgment}</strong>{keys.map((key,lane)=><div className={`lane c${lane} ${active===lane?'pressed':''}`} key={key}>{[0,1,2].map((n)=><span className="note" style={{top:`${10+n*25+(progress%15)}%`}} key={n}>{vocab[(word+n+lane)%vocab.length][1][0]}</span>)}<button onPointerDown={()=>hit(lane)}>{key}</button></div>)}</section><aside className="combo"><Flame/><b>{combo}</b><small>COMBO</small><p>Bắt nhịp cùng từ vựng!</p></aside></div></main>;
  if(screen==='result') return <main className="result"><section><span className="eyebrow">SONG CLEARED!</span><div className="rank">A</div><h1>{songs[selected][0]}</h1><p>{songs[selected][1]}</p><b className="final">{score.toLocaleString()}</b><div className="stats"><span><b>12</b>Perfect</span><span><b>3</b>Great</span><span><b>1</b>Good</span><span><b>0</b>Miss</span></div><div className="actions"><button onClick={start}><Play/> Chơi lại</button><button onClick={()=>setScreen('dictionary')}><BookOpen/> Ôn từ</button><button onClick={()=>setScreen('home')}>Về menu</button></div></section></main>;
  return <main className="app"><header><button className="brand" onClick={()=>setScreen('home')}><span>日</span><b>Nihon Beat<small>Learn Japanese in rhythm</small></b></button><nav><button className={screen==='home'?'on':''} onClick={()=>setScreen('home')}>Trang chủ</button><button className={screen==='songs'?'on':''} onClick={()=>setScreen('songs')}>Bài hát</button><button className={screen==='dictionary'?'on':''} onClick={()=>setScreen('dictionary')}>Từ điển</button></nav><div className="user"><span>12</span><b>Hana<small>Level 8</small></b></div></header>
  {screen==='home'&&<div className="home"><section className="hero"><div><span className="eyebrow"><Sparkles/> HỌC TIẾNG NHẬT QUA ÂM NHẬC</span><h1>Chạm đúng nhịp.<br/><em>Nhớ đúng từ.</em></h1><p>Mỗi phím bấm là một từ vựng mới. Bắt đầu hành trình từ N5 đến N1 theo cách vui nhất.</p><div className="actions"><button onClick={()=>setScreen('songs')}><Play/> Chơi ngay</button><button onClick={()=>setScreen('dictionary')}><BookOpen/> Từ điển của tôi</button></div><div className="streak"><Flame/><span><b>7 ngày liên tiếp!</b><small>Thêm 1 ngày nữa để nhận 100 XP</small></span></div></div><div className="mascot"><div className="head">◡ ‿ ◡</div><div className="body">日</div><span>♪</span><b>Let’s go!<small>がんばって！</small></b></div></section><aside><section className="daily"><span className="eyebrow">DAILY CHALLENGE</span><h3>Tokyo Morning</h3><p>Hoàn thành trước 23:59</p><button onClick={start}><Play/></button></section><section className="today"><h3>Tiến độ hôm nay</h3><div><span>13<small>/ 20 từ</small></span></div><p>Chỉ còn <b>7 từ</b> để đạt mục tiêu!</p></section></aside><section className="continue"><div><span className="eyebrow">TIẾP TỤC HÀNH TRÌNH</span><h2>N5 · Chào hỏi & Hằng ngày</h2></div><article><div className="album">桜<Music2/></div><div><h3>桜ステップ <small>Sakura Step</small></h3><p>128 BPM · 12 từ vựng</p><i><b/></i></div><strong>84,650<small>BEST SCORE</small></strong><button onClick={start}><Play/></button></article></section><section className="quick"><span><Trophy/><b>18</b>Bài đã xong</span><span><BookOpen/><b>126</b>Từ đã học</span><span><Flame/><b>42</b>Combo cao nhất</span></section></div>}
  {screen==='songs'&&<section className="page"><div className="title"><span className="eyebrow">FREE PLAY</span><h1>Chọn giai điệu của bạn</h1><p>Mỗi bài hát là một chủ đề từ vựng mới.</p></div><div className="filters"><button>Tất cả</button><button>N5</button><button>N4</button><button>N3</button></div><div className="songs">{songs.map((s,i)=><article className={selected===i?'selected':''} onClick={()=>setSelected(i)} key={s[0]}><div className="album" style={{background:s[5]}}>{s[0][0]}<Music2/></div><div><small>{s[3]}</small><h2>{s[0]}</h2><p>{s[1]}</p></div><strong>{s[4]}<small>{s[2]} BPM · {12+i*6} từ</small></strong><button onClick={()=>{setSelected(i);start()}}><Play/></button></article>)}</div></section>}
  {screen==='dictionary'&&<section className="page"><div className="title"><span className="eyebrow">MY VOCABULARY</span><h1>Từ điển của tôi</h1><p>Những từ bạn đã gặp trên hành trình âm nhạc.</p></div><div className="words">{vocab.map((w,i)=><article key={w[2]}><div><span className={`master m${i%3}`}>{i%3===0?'Đã thuộc':i%3===1?'Đang học':'Cần ôn'}</span><h2>{w[0]}</h2><p>{w[1]} · {w[2]}</p><b>{w[3]}</b></div><button onClick={()=>speak(w[1])}><Volume2/></button></article>)}</div></section>}</main>;
}
