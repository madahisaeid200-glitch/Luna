import React, {useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {renderMediaOnWeb, canRenderMediaOnWeb} from '@remotion/web-renderer';
import {useCurrentFrame, interpolate} from 'remotion';
import './style.css';

const demoPack = {
  episode: {title: 'The Five-Star Mix-Up'},
  shots: [
    {id: 1, duration: '5 seconds', title: 'The Grand Arrival', action: 'Luna and Leo arrive at a glamorous European hotel.', emotion: 'Excited'},
    {id: 2, duration: '6 seconds', title: 'The Wrong Key', action: 'Leo realizes he has the key to the honeymoon suite next door.', emotion: 'Awkward surprise', dialogue: 'Leo: I can explain.\nLuna: I hope so!'},
    {id: 3, duration: '5 seconds', title: 'The Look', action: 'Luna gives Leo a teasing smile as the elevator doors close.', emotion: 'Playful romance', dialogue: 'Luna: This holiday just got interesting.'}
  ]
};
const duration = (s) => {
  const n = Number(String(s?.duration || '').match(/\d+(?:\.\d+)?/)?.[0] || 5);
  return Math.max(2, Math.min(12, n));
};
const getTotalFrames = (shots) => shots.reduce((sum, s) => sum + duration(s) * 24, 0);

function LUNAComposition({episode, shots}) {
  const frame = useCurrentFrame();
  let offset = 0;
  let active = shots[shots.length - 1];
  let index = shots.length - 1;
  let localFrame = 0;
  for (let i = 0; i < shots.length; i++) {
    const len = duration(shots[i]) * 24;
    if (frame < offset + len) { active = shots[i]; index = i; localFrame = frame - offset; break; }
    offset += len;
  }
  const len = duration(active) * 24;
  const opacity = interpolate(localFrame, [0, 10, len - 10, len], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lift = interpolate(localFrame, [0, len], [24, -10], {extrapolateRight: 'clamp'});
  return <div className="frame" style={{opacity, background: ['linear-gradient(145deg,#253b56,#10131f)','linear-gradient(145deg,#50334d,#171523)','linear-gradient(145deg,#31534e,#10131f)'][index % 3]}}>
    <div className="brand">LUNA &amp; LEO <span>· {String(index + 1).padStart(2,'0')}</span></div>
    <div className="scene" style={{transform: `translateY(${lift}px)`}}>
      <div className="eyebrow">A LUXURY ROMANTIC COMEDY</div>
      <div className="headline">{active.title || active.action || `Scene ${index + 1}`}</div>
      {active.emotion ? <div className="emotion">{active.emotion}</div> : null}
      {active.action && active.title ? <div className="action">{active.action}</div> : null}
    </div>
    <div className="footer">
      {active.dialogue ? <div className="dialogue">{active.dialogue}</div> : null}
      <div className="episode">{episode?.title || 'An L+L Story'} · LUNA STUDIO</div>
    </div>
  </div>;
}

function App() {
  const [pack, setPack] = useState(demoPack);
  const [fileName, setFileName] = useState('Built-in demo');
  const [status, setStatus] = useState('Choose a LUNA JSON export or render the built-in sample.');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const shots = Array.isArray(pack.shots) ? pack.shots : [];
  const frames = useMemo(() => getTotalFrames(shots), [pack]);
  const loadFile = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.shots) || !data.shots.length) throw new Error('No structured scenes found. Generate a production pack with numbered Shot/Scene headings.');
      setPack(data); setFileName(file.name); setVideoUrl(''); setStatus(`Loaded ${data.shots.length} scenes.`);
    } catch (e) { setStatus(e.message || 'Could not read this JSON file.'); }
  };
  const render = async () => {
    setBusy(true); setProgress(0); setVideoUrl('');
    try {
      const supported = await canRenderMediaOnWeb();
      if (!supported) throw new Error('This browser does not currently support the WebCodecs video renderer. Try an updated Chrome browser.');
      const result = await renderMediaOnWeb({
        composition: {id: 'LUNA-Browser-Render', component: LUNAComposition, durationInFrames: frames, fps: 24, width: 720, height: 1280},
        inputProps: {episode: pack.episode || {}, shots},
        videoCodec: 'h264',
        videoBitrate: 'low',
        pageResponsiveness: 'medium',
        onProgress: ({progress: p}) => setProgress(Math.round(p * 100))
      });
      const blob = await result.getBlob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url); setStatus(`Ready · ${(blob.size / 1024 / 1024).toFixed(1)} MB · ${shots.length} scenes`);
    } catch (e) { setStatus(e?.message || 'Render failed.'); }
    finally { setBusy(false); }
  };
  return <main>
    <header><div className="mark">L</div><div><h1>LUNA STUDIO</h1><p>Browser video renderer · no server required</p></div></header>
    <section className="panel">
      <h2>Turn your episode into an MP4</h2>
      <p className="muted">Import the JSON exported by the Producer. Rendering runs on this device.</p>
      <label className="file">Choose production JSON<input type="file" accept="application/json,.json" onChange={e => loadFile(e.target.files?.[0])}/></label>
      <div className="fileinfo">{fileName}</div>
      <div className="stats"><span>{shots.length} scenes</span><span>{Math.round(frames/24)} sec</span><span>720 × 1280</span></div>
      <button onClick={render} disabled={busy || !shots.length}>{busy ? 'Rendering…' : 'Render MP4 on this device'}</button>
      {busy ? <div className="progress"><div style={{width: progress + '%'}}/></div> : null}
      <div className="status">{status}</div>
      {videoUrl ? <div className="result"><video controls playsInline src={videoUrl}/><a href={videoUrl} download="LUNA-episode.mp4">Download MP4</a></div> : null}
    </section>
    <section className="note"><strong>Prototype limits</strong><p>This first version creates animated scene cards with text and dialogue. It does not yet generate character footage, voice, lip-sync or music. Short clips are recommended on phones because rendering uses device memory and battery.</p></section>
    <footer>Made for Luna &amp; Leo · LUNA Studio</footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
