import {prefersReducedMotion,preferenceEvent} from "./theme-preference";
import {SKELETON,milliseconds,SKELETON_TIMING,SKELETON_OPACITY_EASING} from "./skeleton-contract";
import {prepareSkeletonLayout,readSkeletonParts,drawSkeletonShapes} from "./skeleton-layout";
import {measureSkeleton} from "./skeleton-geometry";
import {createSkeletonClock} from "./skeleton-clock";
import {runSkeletonSequence,type SkeletonGroup} from "./skeleton-sequence";

type RevealRoot=HTMLElement&{__skeletonStartedAt?:number};
/** DOM lifecycle adapter. Normal phase changes belong exclusively to the sequence. */
export function startSkeletonReveal(element:RevealRoot,serverEntry:boolean,onComplete:()=>void,persistentSplash?:HTMLElement,fallbackStartedAt?:number,wait?:{measuredStartedAt?:number}){
 const reduce=matchMedia("(prefers-reduced-motion: reduce)");
  element.dataset.revealPhase="pending";
  if(serverEntry&&persistentSplash)persistentSplash.dataset.revealPhase="pending";
  delete element.dataset.revealStop;
  const animations:Animation[]=[],geometryAnimations:Animation[]=[],entranceAnimations:Animation[]=[],chromeAnimations:Animation[]=[],cleanups:(()=>void)[]=[];
  const clock=createSkeletonClock();
  const readyAt=performance.now(),theme=getComputedStyle(element);
  const continueEntrance=(target:HTMLElement|null)=>{
   if(serverEntry||!target)return;
   const delay=`-${Math.max(0,performance.now()-(fallbackStartedAt??readyAt))}ms`;
   for(const property of ["--skeleton-entry-delay","--skeleton-breathe-delay"]){
    const previous=target.style.getPropertyValue(property);
    target.style.setProperty(property,delay);
    cleanups.push(()=>{if(previous)target.style.setProperty(property,previous);else target.style.removeProperty(property);});
   }
  };
  // The intermediate two-placeholder slot must preserve opacity too, before measurement.
  if(!element.hasAttribute("data-skeleton-persistent-initial"))continueEntrance(element.querySelector<HTMLElement>(SKELETON.initial));
  let revealStarted=false,layoutRefreshes=0,layoutDirty=false;
  const breathingLayers=new Map<HTMLElement,HTMLElement>();
  const minimum=milliseconds(theme.getPropertyValue("--site-motion-skeleton-min"),SKELETON_TIMING.minimum);
  const splashMinimum=milliseconds(theme.getPropertyValue("--site-motion-splash-min"),SKELETON_TIMING.splashMinimum);
  const splashExit=milliseconds(theme.getPropertyValue("--site-motion-splash-exit"),SKELETON_TIMING.splashExit);
  const splashGap=milliseconds(theme.getPropertyValue("--site-motion-splash-gap"),SKELETON_TIMING.splashGap);
  const skeletonEnter=milliseconds(theme.getPropertyValue("--site-motion-skeleton-enter"),SKELETON_TIMING.entrance);
  const stagger=serverEntry?
   milliseconds(theme.getPropertyValue("--site-motion-skeleton-stagger"),SKELETON_TIMING.stagger):
   milliseconds(theme.getPropertyValue("--site-motion-skeleton-spa-stagger"),SKELETON_TIMING.spaStagger);
  const splashElement=persistentSplash??element.querySelector<HTMLElement>(SKELETON.splash);
  const serverSplash=serverEntry&&!!splashElement?.firstElementChild;
  let coverAnimation:Animation|undefined;
  let stopped=false,geometryFrame=0;
  const clear=()=>{
   if(stopped)return;stopped=true;
   clock.stop();cancelAnimationFrame(geometryFrame);
   coverAnimation?.cancel();
   chromeAnimations.forEach(animation=>animation.cancel());
   animations.forEach(animation=>animation.cancel());geometryAnimations.forEach(animation=>animation.cancel());entranceAnimations.forEach(animation=>animation.cancel());cleanups.forEach(cleanup=>cleanup());element.dataset.revealPhase="ready";
   breathingLayers.clear();
   if(persistentSplash)persistentSplash.dataset.revealPhase="ready";
   element.dataset.revealStop??="cleanup";
  };
  const finish=(reason?:Event|string)=>{
   if(stopped)return;
   element.dataset.revealStop=typeof reason==="string"?reason:reason?.type??"complete";
   onComplete();
   // Content is already ready. Let decorative chrome finish without cutting
   // it short; teardown, reduced motion and hidden-page recovery still cancel.
   if(reason==="complete")void Promise.allSettled(chromeAnimations.map(animation=>animation.finished)).then(clear);
   else clear();
  };
  const play=async(group:SkeletonGroup)=>{
   if(stopped)return;
   let selected:Animation[];
   if(group==="cover"){
    if(!splashElement)return;
    coverAnimation=splashElement.animate([{opacity:1},{opacity:0}],{duration:splashExit,easing:theme.getPropertyValue("--site-ease-reveal").trim()||SKELETON_OPACITY_EASING,fill:"both"});
    selected=[coverAnimation];
   }else selected=group==="entrance"?entranceAnimations:group==="geometry"?geometryAnimations:animations;
   const epoch=document.timeline.currentTime;
   if(group==="entrance"){
    chromeAnimations.forEach(animation=>{
     // Handle cancellation immediately, even if cleanup occurs before content.
     void animation.finished.catch(()=>{});
     animation.play();if(typeof epoch==="number")animation.startTime=epoch;
    });
   }
   selected.forEach(animation=>{animation.play();if(typeof epoch==="number")animation.startTime=epoch;});
   // This barrier also covers an empty list; phase ordering remains in the sequence.
   await Promise.all(selected.map(animation=>animation.finished));
  };
  const prepare=()=>{
   if(stopped)return;
   if(prefersReducedMotion()||document.visibilityState!=="visible"){finish("unavailable");return;}
   try{
   // Resume the whole layer's entrance instead of fading a replacement from zero.
   continueEntrance(element.querySelector<HTMLElement>(SKELETON.resolved));
   // Read natural layout while the document splash / SPA placeholders are still visible.
   const {resolved,measured,restoreBatchGeometry}=prepareSkeletonLayout({element,serverEntry,serverSplash,skeletonEnter,stagger,theme,animations,geometryAnimations,entranceAnimations,chromeAnimations,cleanups,breathingLayers});
   // Geometry being ready is not a cue to instantly dismiss the entrance.
   // Only the unelapsed part of the splash budget remains; SPA has no splash budget.
   let releaseAt=serverSplash?Math.max(readyAt,(element.__skeletonStartedAt??readyAt)+splashMinimum):readyAt;
   const motion=splashElement?.querySelector<SVGElement>('[data-splash-motion="once"]');
   if(serverSplash&&motion){
    const start=element.__skeletonStartedAt??readyAt;
    const duration=milliseconds(getComputedStyle(motion).getPropertyValue("--site-motion-splash-icon"),SKELETON_TIMING.icon);
    // Let the greeting finish at full opacity; the cover exits afterwards.
    releaseAt=Math.max(releaseAt,start+duration);
    // A persistent launch already has a continuous CSS clock. Hydration must
    // never seek/rewrite it. Only legacy local covers need replacement alignment.
    if(!persistentSplash){
     const elapsed=performance.now()-start,epoch=document.timeline.currentTime;
     for(const animation of motion.getAnimations()){
      animation.effect?.updateTiming({delay:0,duration,iterations:1});
      if(typeof epoch==="number")animation.startTime=epoch-elapsed;
     }
    }
   }
   // Loading/decoding a reserved-size image is not a layout change. Likewise,
   // font load and programmatic scroll must not bypass the minimum skeleton time.
   // Changed geometry is refreshed before reveal, never used to skip its gate.
   const refreshLayout=()=>{
    const refreshed=measured.map(record=>({record,layout:measureSkeleton(record.item),parts:readSkeletonParts(record.item)}));
    layoutRefreshes++;element.dataset.revealLayoutRefreshes=String(layoutRefreshes);
    for(const {record,layout,parts} of refreshed){
     record.parts.forEach(({part})=>observer?.unobserve(part));
     record.layout=layout;record.parts=parts;
     if(serverEntry)record.parts.forEach(({part})=>observer?.observe(part));
     const layer=breathingLayers.get(record.item);if(layer)drawSkeletonShapes(layer,record.layout);
    }
    layoutDirty=false;
   };
   const checkGeometry=():void=>{
    if(stopped||geometryFrame)return;
    geometryFrame=requestAnimationFrame(()=>{
     geometryFrame=0;if(stopped)return;
     const widthChanged=measured.some(record=>Math.abs(record.item.getBoundingClientRect().width-record.layout.width)>1);
     const changed=widthChanged||(serverEntry&&measured.some(record=>{
      const origin=record.item.getBoundingClientRect();
      return record.parts.some(({part,width,height,x,y})=>{
       const box=part.getBoundingClientRect();return Math.abs(box.width-width)>1||Math.abs(box.height-height)>1||Math.abs(box.left-origin.left-x)>1||Math.abs(box.top-origin.top-y)>1;
      });
     }));
     if(!changed)return;
     // The SSR cover/paused skeleton can absorb bounded hydration layout updates
     // (text folding, carousel controls, font metrics) without skipping the stage.
     if(serverEntry&&!revealStarted&&layoutRefreshes<SKELETON.maxRefreshes){
      refreshLayout();
     }else layoutDirty=true;
    });
   };
   const observer:ResizeObserver|null=typeof ResizeObserver==="function"?new ResizeObserver(entries=>{
    // SPA deliberately animates row heights. ResizeObserver already provides
    // box sizes: those height-only notifications need no synchronous DOM reads.
    if(serverEntry||entries.some(entry=>{
     const record=measured.find(record=>record.item===entry.target);
     const box=entry.borderBoxSize[0];
     return record&&(!box||Math.abs(box.inlineSize-record.layout.width)>1);
    }))checkGeometry();
   }):null;
   measured.forEach(({item,parts})=>{observer?.observe(item,{box:"border-box"});if(serverEntry)parts.forEach(({part})=>observer?.observe(part));});cleanups.push(()=>observer?.disconnect());
   const mediaLoaded=(event:Event)=>{if(event.target instanceof Element&&resolved?.contains(event.target))checkGeometry();};
   window.addEventListener("resize",checkGeometry,{passive:true});
   document.addEventListener("visibilitychange",finish);document.fonts?.addEventListener("loadingdone",checkGeometry);resolved?.addEventListener("load",mediaLoaded,true);reduce.addEventListener("change",finish);window.addEventListener(preferenceEvent,finish);
   cleanups.push(()=>{
    window.removeEventListener("resize",checkGeometry);document.removeEventListener("visibilitychange",finish);document.fonts?.removeEventListener("loadingdone",checkGeometry);resolved?.removeEventListener("load",mediaLoaded,true);reduce.removeEventListener("change",finish);window.removeEventListener(preferenceEvent,finish);
   });
   void runSkeletonSequence({
    entry:serverEntry?"server":"spa",splash:serverSplash,releaseAt,gap:splashGap,minimum,
    now:()=>performance.now(),stopped:()=>stopped,
    begin:()=>wait?(wait.measuredStartedAt??=performance.now()):performance.now(),
    waitUntil:clock.waitUntil,paint:clock.paint,play,
    prepareReveal:()=>{
     if(!layoutDirty)return;
     measured.forEach(record=>record.restoreGeometry());
     restoreBatchGeometry();
     refreshLayout();
    },
    phase:phase=>{element.dataset.revealPhase=phase;if(persistentSplash)persistentSplash.dataset.revealPhase=phase;if(phase==="expanding"||phase==="revealing")revealStarted=true;},
    finish,
   });
   }catch{finish("error");}
  };
  // Let descendant layout effects (folding text and sizing media) commit before
  // taking the one-shot baseline. Both frames are cancelled on cleanup/replay.
  void clock.paint().then(()=>{if(!stopped)prepare();});
  return clear;
}
