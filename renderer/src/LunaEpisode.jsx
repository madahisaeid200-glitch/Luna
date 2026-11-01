import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';

const COLORS = ['#17243b', '#33243e', '#243c3b', '#3d2d2b'];

const secondsFrom = (shot) => {
  const raw = String(shot?.duration || '').match(/(\d+(?:\.\d+)?)/);
  return raw ? Math.max(2, Math.min(20, Number(raw[1]))) : 6;
};

export const getEpisodeConfig = (props = {}) => {
  const shots = Array.isArray(props.shots) && props.shots.length ? props.shots : [{id: 1, duration: '6 seconds'}];
  const fps = 30;
  const durationInFrames = shots.reduce((sum, shot) => sum + secondsFrom(shot) * fps, 0);
  const vertical = props.targetFormat !== '16:9';
  return {fps, durationInFrames, width: vertical ? 1080 : 1920, height: vertical ? 1920 : 1080};
};

const Scene = ({shot, index, episode, totalFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = secondsFrom(shot) * fps;
  const opacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lift = interpolate(frame, [0, duration], [28, -12], {extrapolateRight: 'clamp'});
  const dialogue = shot.dialogue || shot.caption || '';
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 78% 18%, #b98b6855, transparent 34%), linear-gradient(145deg, ${COLORS[index % COLORS.length]}, #10131f)`, color: '#fff', fontFamily: 'Arial, sans-serif', justifyContent: 'space-between', padding: '9% 8%', opacity}}>
      <div style={{fontSize: 26, letterSpacing: 7, color: '#e7c8a5'}}>LUNA & LEO  ·  {String(index + 1).padStart(2, '0')}</div>
      <div style={{transform: `translateY(${lift}px)`, textAlign: 'center'}}>
        <div style={{fontSize: 22, letterSpacing: 4, color: '#e7c8a5', marginBottom: 30}}>A LUXURY ROMANTIC COMEDY</div>
        <div style={{fontSize: 58, lineHeight: 1.15, fontWeight: 700, textShadow: '0 8px 35px #0008'}}>{shot.title || shot.action || `Scene ${index + 1}`}</div>
        {shot.emotion ? <div style={{fontSize: 26, marginTop: 28, color: '#e8d9cc'}}>{shot.emotion}</div> : null}
      </div>
      <div>
        {dialogue ? <div style={{fontSize: 34, lineHeight: 1.35, textAlign: 'center', padding: '26px 22px', border: '1px solid #ffffff55', borderRadius: 22, background: '#080b15aa'}}>{dialogue}</div> : null}
        <div style={{fontSize: 19, textAlign: 'center', color: '#d7c5b5', marginTop: 28}}>{episode.title || 'An L+L Story'}  ·  LUNA STUDIO</div>
      </div>
    </AbsoluteFill>
  );
};

export const LunaEpisode = ({episode = {}, shots = []}) => {
  const scenes = shots.length ? shots : [{id: 1, duration: '6 seconds', action: 'A little misunderstanding becomes a big adventure.'}];
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: '#10131f'}}>
      {scenes.map((shot, index) => {
        const durationInFrames = secondsFrom(shot) * 30;
        const start = from;
        from += durationInFrames;
        return <Sequence key={shot.id ?? index} from={start} durationInFrames={durationInFrames}><Scene shot={shot} index={index} episode={episode} totalFrames={durationInFrames}/></Sequence>;
      })}
    </AbsoluteFill>
  );
};
