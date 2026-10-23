"use client";

import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import type PhotoSwipe from 'photoswipe';
import {useTranslations} from 'next-intl';
import {ChevronLeft,ChevronRight,Video,X} from 'lucide-react';
import {Button} from './button';
import {animateLightboxControls} from './lightbox-controls-motion';
import {LightboxVideoControls} from './lightbox-video-controls';
import {MagneticSurface} from './magnetic-surface';
import {prefersReducedMotion} from './theme-preference';
import type {LightboxImage} from './image-lightbox';
import styles from './image-lightbox.module.css';
import carouselStyles from './carousel.module.css';
import {cn} from './utils';

export function LightboxControls({instance,images}:{instance:PhotoSwipe;images:readonly LightboxImage[]}){
 const t=useTranslations('UI'),strip=useRef<HTMLDivElement>(null);
 const [locked,setLocked]=useState<{side:'previous'|'next';left:number;top:number}|null>(null);
 const entered=useRef(false);
 const [current,setCurrent]=useState(instance.currIndex);
 const [geometry,setGeometry]=useState<{width:number;top:number;bottom:number}|null>(null);
 useLayoutEffect(()=>{
  if(!geometry||entered.current)return;
  entered.current=true;
  void animateLightboxControls(instance);
 },[geometry,instance]);
 useEffect(()=>{
  const release=()=>setLocked(null);
  window.addEventListener('blur',release);
  return ()=>window.removeEventListener('blur',release);
 },[]);
 function hold(event:PointerEvent<HTMLButtonElement>,side:'previous'|'next'){
  if(event.pointerType!=='mouse')return;
  const rect=event.currentTarget.getBoundingClientRect();
  setLocked({side,left:rect.left+rect.width/2,top:rect.top+rect.height/2});
 }
 useEffect(()=>{
  const update=()=>{
   setCurrent(instance.currIndex);
   const slide=instance.currSlide;
   if(slide&&instance.opener.isOpen)setGeometry({width:slide.width*slide.zoomLevels.initial,top:slide.pan.y+slide.height*slide.currZoomLevel/2,bottom:slide.pan.y+slide.height*slide.currZoomLevel});
  };
  update();
  instance.on('change',update);instance.on('resize',update);instance.on('openingAnimationEnd',update);
  return ()=>{instance.off('change',update);instance.off('resize',update);instance.off('openingAnimationEnd',update);};
 },[instance]);
 useEffect(()=>{strip.current?.children[current]?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});},[current]);
 const video=instance.currSlide?.content.element;
 return <>
  <Button variant="outline" size="icon" data-magnetic="true" className={cn(carouselStyles.control,styles.closeButton)} aria-label={t('closeImage')} onClick={()=>instance.close()}>
   <MagneticSurface radius={240} maxOffset={18} strength={.65} areaSelector=".pswp" className={carouselStyles.magneticSurface}><X size="1.25rem" strokeWidth={1.75} aria-hidden="true"/></MagneticSurface>
  </Button>
  {geometry&&images.length>1&&<div className={styles.navigation} style={{'--media-width':`${geometry.width}px`,'--media-top':`${geometry.top}px`} as CSSProperties}>
   {(['previous','next'] as const).map(side=>{
    const previous=side==='previous',disabled=previous?current===0:current===images.length-1;
    const fixed=locked?.side===side?locked:null;
    const Icon=previous?ChevronLeft:ChevronRight;
    return <Button key={side} variant="outline" size="icon" data-magnetic="true" data-lightbox-control="arrow" data-side={side} data-position-locked={fixed?'true':undefined}
     style={fixed?{left:fixed.left,top:fixed.top}:undefined}
     className={cn(carouselStyles.control,styles.arrow)} aria-disabled={disabled}
     onPointerEnter={event=>hold(event,side)} onPointerLeave={()=>setLocked(null)} onPointerCancel={()=>setLocked(null)}
     aria-label={t(previous?'previousImage':'nextImage')} onClick={()=>{if(!disabled)instance.mainScroll.moveIndexBy(previous?-1:1,!prefersReducedMotion());}}>
     <MagneticSurface radius={240} maxOffset={18} strength={.65} areaSelector=".pswp" className={carouselStyles.magneticSurface}><Icon size="1.25rem" strokeWidth={1.75} aria-hidden="true"/></MagneticSurface>
    </Button>;
   })}
  </div>}

  {geometry&&video instanceof HTMLVideoElement&&<LightboxVideoControls key={current} instance={instance} video={video} top={geometry.bottom} width={geometry.width}/>}
  {geometry&&images.length>1&&<div data-lightbox-control="thumbnails" ref={strip} className={styles.thumbnails} role="group" aria-label={t('imagePreview')}>
   {images.map((media,index)=>{
    const source=instance.getItemData(index).msrc||media.poster||(media.kind!=='video'?media.src:undefined);
    return <button key={`${index}:${media.src}`} type="button" className={styles.thumbnail} aria-label={`${index+1} / ${images.length}${media.alt?` · ${media.alt}`:''}`} aria-current={current===index?'true':undefined} onClick={()=>instance.goTo(index)}>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     {source&&<img src={source} alt="" draggable={false}/>}
     {media.kind==='video'&&<Video className={styles.videoMark} aria-hidden="true"/>}
    </button>;
   })}
  </div>}
 </>;
}
