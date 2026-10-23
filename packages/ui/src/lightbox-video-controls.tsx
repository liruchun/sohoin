"use client";

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type PhotoSwipe from 'photoswipe';
import {useTranslations} from 'next-intl';
import {Pause,Play,Volume2,VolumeX} from 'lucide-react';
import {Button} from './button';
import styles from './image-lightbox.module.css';

function time(value:number){const seconds=Math.max(0,Math.floor(value));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
export function LightboxVideoControls({instance,video,top,width}:{instance:PhotoSwipe;video:HTMLVideoElement;top:number;width:number}){
 const t=useTranslations('UI'),active=useRef(true);
 const [state,setState]=useState({playing:!video.paused,time:video.currentTime,duration:Number.isFinite(video.duration)?video.duration:0,volume:video.volume,muted:video.muted});
 useEffect(()=>{
  active.current=true;
  const update=()=>setState({playing:!video.paused&&!video.ended,time:video.currentTime,duration:Number.isFinite(video.duration)?video.duration:0,volume:video.volume,muted:video.muted});
  const events=['play','pause','ended','timeupdate','durationchange','loadedmetadata','volumechange'];
  events.forEach(event=>video.addEventListener(event,update));update();
  return ()=>{active.current=false;events.forEach(event=>video.removeEventListener(event,update));};
 },[video]);
 const isActive=()=>active.current&&!instance.isDestroying&&instance.element?.dataset.controlsState!=='exiting'&&video.isSameNode(instance.currSlide?.content.element??null);
 async function toggle(){
  if(!video.paused){video.pause();return;}
  try{await video.play();}catch(error){
   if(!isActive()||!(error instanceof DOMException)||error.name!=='NotAllowedError')return;
   video.muted=true;
   try{await video.play();}catch{/* Browser may still require another play gesture. */}
  }
  if(!isActive())video.pause();
 }
 const volume=state.muted?0:Math.round(state.volume*100);
 return <div className={styles.videoControls} style={{top:`calc(${top}px + .5rem)`,'--video-width':`${width}px`} as CSSProperties}>
  <Button variant="plain" size="icon-sm" className={styles.playButton} aria-label={t(state.playing?'pauseMedia':'playMedia')} onClick={()=>void toggle()}>{state.playing?<Pause aria-hidden="true"/>:<Play aria-hidden="true"/>}</Button>
  <label className={styles.timeline} style={{'--range-value':`${state.duration?Math.min(100,state.time/state.duration*100):0}%`} as CSSProperties}>
   <span className={styles.time}><span>{time(state.time)}</span><span> / {time(state.duration)}</span></span>
   <input className={styles.mediaRange} type="range" min={0} max={state.duration||1} step={.1} value={Math.min(state.time,state.duration||1)} disabled={!state.duration} aria-label={t('mediaProgress')} aria-valuetext={`${time(state.time)} / ${time(state.duration)}`} onChange={event=>{const time=Number(event.target.value);video.currentTime=time;setState(previous=>({...previous,time}));}}/>
  </label>
  <div className={styles.volumeControl} style={{'--range-value':`${volume}%`} as CSSProperties}>
   <Button variant="plain" size="icon-sm" aria-label={t(state.muted?'unmuteMedia':'muteMedia')} onClick={()=>{if(video.muted||video.volume===0){if(video.volume===0)video.volume=.5;video.muted=false;}else video.muted=true;}}>{volume===0?<VolumeX aria-hidden="true"/>:<Volume2 aria-hidden="true"/>}</Button>
   <label className={styles.volumeRange}><input className={styles.mediaRange} type="range" min={0} max={100} step={1} value={volume} aria-label={t('mediaVolume')} aria-valuetext={`${volume}%`} onChange={event=>{video.volume=Number(event.target.value)/100;video.muted=video.volume===0;setState(previous=>({...previous,volume:video.volume,muted:video.muted}));}}/><span>{volume}</span></label>
  </div>
 </div>;
}
