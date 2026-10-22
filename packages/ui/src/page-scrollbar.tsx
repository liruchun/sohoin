"use client";
import {useTranslations} from "next-intl";


import {useLayoutEffect,useRef} from "react";
import styles from "./page-scrollbar.module.css";

/** Overlay control for the document scroller; never creates a nested viewport. */
export function PageScrollbar({controls,label}:{controls:string;label?:string}){
 const t=useTranslations("UI");
 const trackRef=useRef<HTMLDivElement>(null),thumbRef=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const track=trackRef.current,thumb=thumbRef.current;
  const root=document.documentElement,scroller=document.scrollingElement;
  if(!track||!thumb||!scroller||typeof ResizeObserver==="undefined")return;
  const forcedColors=matchMedia("(forced-colors: active)");
  let frame=0,maximum=0,travel=0,thumbHeight=0;
  let drag:{id:number;offset:number}|null=null;
  const stopDrag=()=>{
   const id=drag?.id;drag=null;delete track.dataset.dragging;
   if(id!==undefined&&track.hasPointerCapture(id))track.releasePointerCapture(id);
  };
  const measure=()=>{
   frame=0;
   const locked=document.body.hasAttribute("data-scroll-locked");
   const height=root.clientHeight,content=scroller.scrollHeight;
   maximum=Math.max(0,content-height);
   const visible=!forcedColors.matches&&!locked&&maximum>1;
   track.hidden=!visible;
   if(!visible){stopDrag();return;}
   const trackHeight=track.clientHeight;
   const minimum=2*parseFloat(getComputedStyle(root).fontSize);
   thumbHeight=Math.min(trackHeight,Math.max(minimum,trackHeight*height/content));
   travel=Math.max(0,trackHeight-thumbHeight);
   const top=Math.min(maximum,Math.max(0,scroller.scrollTop));
   thumb.style.height=`${thumbHeight}px`;
   thumb.style.transform=`translateY(${maximum?top/maximum*travel:0}px)`;
   thumb.setAttribute("aria-valuemax",String(Math.round(maximum)));
   thumb.setAttribute("aria-valuenow",String(Math.round(top)));
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const syncMode=()=>{
   if(forcedColors.matches)delete root.dataset.pageScrollbar;
   else root.dataset.pageScrollbar="overlay";
   schedule();
  };
  const scrollTo=(top:number)=>{
   scroller.scrollTop=Math.min(maximum,Math.max(0,top));
   schedule();
  };
  const move=(event:PointerEvent)=>{
   if(!drag||event.pointerId!==drag.id)return;
   if(document.body.hasAttribute("data-scroll-locked")){stopDrag();return;}
   const top=event.clientY-track.getBoundingClientRect().top-drag.offset;
   scrollTo(travel?top/travel*maximum:0);
  };
  const down=(event:PointerEvent)=>{
   if(event.button!==0||!event.isPrimary||document.body.hasAttribute("data-scroll-locked"))return;
   if(frame){cancelAnimationFrame(frame);frame=0;}
   measure();
   if(track.hidden)return;
   event.preventDefault();
   thumb.focus({preventScroll:true});
   const onThumb=event.target instanceof Node&&thumb.contains(event.target);
   drag={id:event.pointerId,offset:onThumb?event.clientY-thumb.getBoundingClientRect().top:thumbHeight/2};
   track.dataset.dragging="true";
   track.setPointerCapture(event.pointerId);
   move(event);
  };
  const up=(event:PointerEvent)=>{if(drag?.id===event.pointerId)stopDrag();};
  const keydown=(event:KeyboardEvent)=>{
   if(document.body.hasAttribute("data-scroll-locked"))return;
   const line=3*parseFloat(getComputedStyle(root).fontSize);
   const page=root.clientHeight*.9,current=scroller.scrollTop;
   const destinations:Record<string,number>={ArrowUp:current-line,ArrowDown:current+line,PageUp:current-page,PageDown:current+page,Home:0,End:maximum};
   if(!(event.key in destinations))return;
   event.preventDefault();scrollTo(destinations[event.key]);
  };
  const observer=new ResizeObserver(schedule);
  observer.observe(root);observer.observe(document.body);
  // Radix retains ownership of modal scroll locking, including nested modals.
  const lockObserver=new MutationObserver(schedule);
  lockObserver.observe(document.body,{attributes:true,attributeFilter:["data-scroll-locked"]});
  window.addEventListener("scroll",schedule,{passive:true});
  window.addEventListener("resize",schedule,{passive:true});
  forcedColors.addEventListener("change",syncMode);
  track.addEventListener("pointerdown",down);
  track.addEventListener("pointermove",move);
  track.addEventListener("pointerup",up);
  track.addEventListener("pointercancel",up);
  track.addEventListener("lostpointercapture",stopDrag);
  thumb.addEventListener("keydown",keydown);
  syncMode();
  return ()=>{
   stopDrag();cancelAnimationFrame(frame);observer.disconnect();lockObserver.disconnect();
   window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);
   forcedColors.removeEventListener("change",syncMode);
   track.removeEventListener("pointerdown",down);track.removeEventListener("pointermove",move);
   track.removeEventListener("pointerup",up);track.removeEventListener("pointercancel",up);
   track.removeEventListener("lostpointercapture",stopDrag);thumb.removeEventListener("keydown",keydown);
   delete root.dataset.pageScrollbar;
  };
 },[]);
 return <div ref={trackRef} className={styles.track} hidden>
  <div ref={thumbRef} className={styles.thumb} role="scrollbar" tabIndex={0}
   aria-label={label??t("pageScrollbar")} aria-controls={controls} aria-orientation="vertical"
   aria-valuemin={0} aria-valuemax={0} aria-valuenow={0}/>
 </div>;
}
