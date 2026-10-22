"use client";

import {useEffect,useState,type ComponentProps} from 'react';
import {Carousel,type CarouselApi} from '@sohoin/ui/carousel';

export function ContentMediaCarousel(props:ComponentProps<typeof Carousel>){
 const [api,setApi]=useState<CarouselApi>();
 useEffect(()=>{
  if(!api)return;
  const viewport=api.rootNode();
  const track=api.containerNode();
  let position=track.getBoundingClientRect().left,lastMovement=-Infinity,suppressClick=false,pressed=false;
  const scroll=()=>{
   const next=track.getBoundingClientRect().left;
   // Scroll events can outlive visible movement (or come from an instant jump).
   // Only recent, real movement should turn the next click into a stop gesture.
   if(!pressed&&Math.abs(next-position)>.1)lastMovement=performance.now();
   position=next;
  };
  const settle=()=>{lastMovement=-Infinity;position=track.getBoundingClientRect().left;};
  const down=()=>{
   suppressClick=performance.now()-lastMovement<80;
   pressed=true;settle();
  };
  const up=()=>{pressed=false;settle();};
  const click=(event:MouseEvent)=>{
   const suppress=suppressClick;
   suppressClick=false;
   if(!suppress||event.detail===0||!(event.target instanceof Element)||!event.target.closest('[data-lightbox-index],[data-external-link]'))return;
   event.preventDefault();event.stopImmediatePropagation();
  };
  // Embla stops inertia on pointerDown; consume only that gesture's media click.
  api.on('scroll',scroll).on('settle',settle).on('pointerDown',down).on('pointerUp',up).on('reInit',settle);
  viewport.addEventListener('click',click,true);

  const reveal=(event:Event)=>{
   const target=event.target;
   if(!(target instanceof HTMLElement)||!viewport.contains(target))return;
   const bounds=viewport.getBoundingClientRect();
   const clipped=()=>{
    const rect=target.getBoundingClientRect();
    return Math.max(0,bounds.left-rect.left)+Math.max(0,rect.right-bounds.right);
   };
   if(clipped()<=1)return;
   // Grouped snaps do not map one-to-one to media (including videos). Use
   // public snap navigation to find the nearest snap that reveals this image.
   const current=api.selectedScrollSnap();
   const snaps=api.scrollSnapList().map((_,index)=>index).sort((a,b)=>Math.abs(a-current)-Math.abs(b-current));
   let best=current,least=clipped();
   for(const snap of snaps){
    api.scrollTo(snap,true);
    const remaining=clipped();
    if(remaining<least){best=snap;least=remaining;}
    if(remaining<=1)return;
   }
   api.scrollTo(best,true);
  };
  viewport.addEventListener('lightbox:reveal-thumbnail',reveal);
  return ()=>{
   viewport.removeEventListener('lightbox:reveal-thumbnail',reveal);viewport.removeEventListener('click',click,true);
   api.off('scroll',scroll).off('settle',settle).off('pointerDown',down).off('pointerUp',up).off('reInit',settle);
  };
 },[api]);
 return <Carousel {...props} setApi={setApi} opts={{slidesToScroll:'auto',dragFree:true,watchDrag:(_api,event)=>!(event.target instanceof Element&&event.target.closest('button,input,[role=slider]'))}}
  onVolumeChangeCapture={event=>{if(event.target instanceof HTMLVideoElement&&!event.target.muted)event.currentTarget.querySelectorAll('video').forEach(video=>{if(video!==event.target)video.muted=true;});}}/>;
}
