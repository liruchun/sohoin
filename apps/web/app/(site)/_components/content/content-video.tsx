"use client";

import {useEffect,useRef,useState} from 'react';
import {useTranslations} from 'next-intl';
import {Volume2,VolumeX} from 'lucide-react';
import {Button} from '@sohoin/ui/button';
import {useReducedMotionPreference} from '@sohoin/ui/theme-provider';
import styles from './content-media.module.css';

type AudioVideo=HTMLVideoElement&{audioTracks?:{length:number};mozHasAudio?:boolean;webkitAudioDecodedByteCount?:number};
export function ContentVideo({src,poster,width,height,label,hasAudio,lightboxIndex}:{src:string;poster?:string;width:number;height:number;label:string;hasAudio?:boolean|null;lightboxIndex?:number}){
 const t=useTranslations('Web'),video=useRef<HTMLVideoElement>(null),manualPause=useRef(false);
 const [muted,setMuted]=useState(true),[playing,setPlaying]=useState(false),[audio,setAudio]=useState(hasAudio===true);
 const reduce=useReducedMotionPreference();
 function detectAudio(){
  if(hasAudio!=null)return;
  const element=video.current as AudioVideo|null;
  if(element&&(element.audioTracks?.length||element.mozHasAudio||element.webkitAudioDecodedByteCount))setAudio(true);
 }
 useEffect(()=>{
  const element=video.current;if(!element)return;
  let visible=false;
  const sync=()=>{
   if(!visible||document.hidden)element.pause();
   else if(!reduce&&!manualPause.current)void element.play().catch(()=>{});
  };
  if(reduce)element.pause();
  const observer=new IntersectionObserver(entries=>{
   visible=!!entries[0]?.isIntersecting&&entries[0].intersectionRatio>=.5;sync();
  },{threshold:[0,.5]});
  observer.observe(element);document.addEventListener('visibilitychange',sync);
  return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);element.pause();};
 },[reduce,src]);
 function toggle(){const element=video.current;if(!element)return;if(element.paused){manualPause.current=false;void element.play().catch(()=>{});}else{manualPause.current=true;element.pause();}}
 return <div className={styles.videoFrame} data-card-no-navigation="" data-skeleton-part="block">
  <video ref={video} className={styles.video} src={src} poster={poster} width={width} height={height} muted={muted} loop playsInline preload="none" draggable={false}
   data-lightbox-index={lightboxIndex} tabIndex={0} role="button" aria-label={lightboxIndex!==undefined?label:label+' · '+t(playing?'pauseVideo':'playVideo')} aria-pressed={lightboxIndex===undefined?playing:undefined}
   onClick={lightboxIndex===undefined?toggle:()=>video.current?.pause()} onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();if(lightboxIndex!==undefined)event.currentTarget.click();else toggle();}}}
   onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onLoadedData={detectAudio} onTimeUpdate={detectAudio} onVolumeChange={event=>setMuted(event.currentTarget.muted)}/>
  {audio&&<Button className={styles.soundButton} variant="plain" size="icon-sm" aria-label={t(muted?'unmuteVideo':'muteVideo')} aria-pressed={!muted} onClick={()=>{const element=video.current;if(element){element.muted=!element.muted;setMuted(element.muted);}}}>{muted?<VolumeX aria-hidden="true"/>:<Volume2 aria-hidden="true"/>}</Button>}
 </div>;
}
