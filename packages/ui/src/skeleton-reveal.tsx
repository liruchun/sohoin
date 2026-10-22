"use client";
import {useTranslations} from "next-intl";

import {prefersReducedMotion,preferenceEvent} from "./theme-preference";
import {createContext,Suspense,useCallback,useContext,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from "react";
import {shouldAnimateSkeleton,recordSkeletonWait,milliseconds,SKELETON_TIMING,SKELETON_OPACITY_EASING} from "./skeleton-contract";
export {skeletonBoundaryKey,skeletonBoundaryEntry} from "./skeleton-contract";
import {startSkeletonReveal} from "./skeleton-runtime";
import {contentBootstrap,waitingBootstrap,launchBootstrap} from "./skeleton-bootstrap";
import styles from "./skeleton-reveal.module.css";
import "./skeleton-reveal.css";
import {cn} from "./utils";

type RevealRoot=HTMLElement&{__skeletonTimeout?:number;__skeletonStartedAt?:number};

// These fixed, trusted fragments must run only during HTML parsing, before hydration.
// Client innerHTML insertion leaves scripts inert, so SPA mounts do not mark themselves
// as document entries. Do not replace this with next/script (which runs on SPA mounts)
// or template (which is inert during document parsing as well). Never insert user data.
const documentBootstrap={__html:`<script>${contentBootstrap}</script>`};
const fallbackBootstrap={__html:`<script>${waitingBootstrap}</script>`};
const persistentBootstrap={__html:`<script>${launchBootstrap}</script>`};
function DocumentEntryBootstrap({waiting=false,launch=false}:{waiting?:boolean;launch?:boolean}){
 return <span hidden aria-hidden="true" dangerouslySetInnerHTML={launch?persistentBootstrap:waiting?fallbackBootstrap:documentBootstrap}/>;
}

type WaitState={fallbackShown:boolean;fallbackStartedAt?:number;measuredStartedAt?:number;launch:RefObject<HTMLDivElement|null>|null;scopes:Map<string,{key?:string;state:WaitState}>;revealed:WeakSet<object>};
const SkeletonWaitContext=createContext<WaitState|null>(null);

/** Track a real wait, not visits or cached page data. The host keys each destination. */
export function SkeletonBoundary({children,splash,inheritSplash=false,scope,resetKey}:{children:ReactNode;splash?:ReactNode;inheritSplash?:boolean;scope?:string;resetKey?:string}){
 const parent=useContext(SkeletonWaitContext);
 const launch=useRef<HTMLDivElement>(null);
 const local=useRef<WaitState>({fallbackShown:false,launch:splash?launch:inheritSplash?parent?.launch??null:null,scopes:new Map(),revealed:parent?.revealed??new WeakSet()});
 // Named regions retain only their wait record in the route layout, not DOM.
 // A new query replaces that region's record rather than caching every cursor.
 const wait=useMemo(()=>{
  if(!scope||!parent)return local.current;
  const existing=parent.scopes.get(scope);
  return existing&&existing.key===resetKey?existing.state:{fallbackShown:false,launch:inheritSplash?parent.launch:null,scopes:new Map(),revealed:parent.revealed} as WaitState;
 },[parent,scope,resetKey,inheritSplash]);
 useLayoutEffect(()=>{if(scope&&parent)parent.scopes.set(scope,{key:resetKey,state:wait});},[parent,scope,resetKey,wait]);
 return <SkeletonWaitContext.Provider value={wait}>
  {splash&&<div ref={launch} className={styles.persistentSplash} data-skeleton-persistent-splash="" suppressHydrationWarning>
   <DocumentEntryBootstrap launch/>{splash}
  </div>}
  {children}
 </SkeletonWaitContext.Provider>;
}

/** Document entry waits behind a splash; SPA waits behind the caller's two skeletons. */
export function SkeletonFallback({children,splash,label}:{children:ReactNode;splash?:ReactNode;label?:string}){
 const t=useTranslations("UI");
 const wait=useContext(SkeletonWaitContext);
 const localSplash=wait?.launch?undefined:splash;
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!wait)return;
  // Record the committed fallback synchronously. A frame callback can be cancelled
  // when streamed content replaces the fallback, losing a real wait.
  // Route loading -> local Suspense can replace the fallback during one wait.
  // Preserve its clock until SkeletonContent finishes (also across replacement).
  const now=performance.now();
  recordSkeletonWait(wait,now);
  const element=root.current;
  if(element&&element.dataset.revealEntry!=="server"){
   const delay=`-${Math.max(0,now-(wait.fallbackStartedAt??now))}ms`;
   element.style.setProperty("--skeleton-entry-delay",delay);
   element.style.setProperty("--skeleton-breathe-delay",delay);
  }
 },[wait]);
 return <div ref={root} className={styles.waiting} data-reveal-root="" data-has-splash={localSplash?"true":undefined} role="status" aria-live="polite" aria-label={label??t("loadingContent")} aria-busy="true" suppressHydrationWarning>
  <DocumentEntryBootstrap waiting/>
  <div className={styles.waitingSplash}>{localSplash}</div><div className={styles.waitingSkeleton} data-skeleton-placeholder="">{children}</div>
 </div>;
}

/** Real SSR layout supplies both the measured skeleton and final expansion height. */
function SkeletonCommit({ready,onCommit}:{ready:boolean;onCommit:(ready:boolean)=>void}){
 useLayoutEffect(()=>{onCommit(ready);},[ready,onCommit]);
 return null;
}

export function SkeletonContent({children,fallback,splash,as:Root="div",id,className,suspend=false,revealToken,label,preserveAll=false,onRevealComplete}:{children:ReactNode;fallback?:ReactNode;splash?:ReactNode;as?:"div"|"main";id?:string;className?:string;suspend?:boolean;revealToken?:object;label?:string;preserveAll?:boolean;onRevealComplete?:()=>void}){
 const wait=useContext(SkeletonWaitContext);
 const [resolved,setResolved]=useState(!suspend);
 const root=useRef<RevealRoot>(null),completed=useRef(false),notified=useRef(false);
 const [placeholderReady,setPlaceholderReady]=useState(!preserveAll||!suspend);
 const onRevealCompleteRef=useRef(onRevealComplete);
 onRevealCompleteRef.current=onRevealComplete;
 const notifyComplete=useCallback(()=>{
  if(notified.current)return;
  notified.current=true;
  onRevealCompleteRef.current?.();
 },[]);
 // Tokens belong to a server response, not a URL. Next's cached RSC tree retains
 // its token; a new response creates a new one. Weak references retain no data.
 const localRevealed=useRef(new WeakSet<object>()),previousToken=useRef(revealToken);
 const revealed=wait?.revealed??localRevealed.current;
 const attachRoot=useCallback((element:HTMLElement|null)=>{root.current=element;},[]);
 // Keep the entry decision through Strict Mode's setup/cleanup/setup replay.
 const waitedOnEntry=useRef<boolean|null>(null);
 const commit=useCallback((ready:boolean)=>{
  if(!ready){
   if(wait)recordSkeletonWait(wait,performance.now());
   completed.current=false;waitedOnEntry.current=null;
  }
  setResolved(ready);
 },[wait]);
 // Appended batches first open space for their placeholders. Keep this effect
 // independent of resolved: a fast response must not cancel that first stage.
 useLayoutEffect(()=>{
  const element=root.current;
  if(!element)return;
  if(!preserveAll||!suspend||element.dataset.revealEntry==="server"||prefersReducedMotion()||document.visibilityState!=="visible"||typeof element.animate!=="function"){
   setPlaceholderReady(true);return;
  }
  const theme=getComputedStyle(element),height=element.getBoundingClientRect().height;
  const oldOverflow=element.style.overflow;
  element.style.overflow="clip";
  const animation=element.animate([{height:"0px"},{height:`${height}px`}],{
   duration:milliseconds(theme.getPropertyValue("--site-motion-skeleton-expand"),SKELETON_TIMING.expand),
   easing:theme.getPropertyValue("--site-ease-reveal").trim()||SKELETON_OPACITY_EASING,fill:"both",
  });
  const reduce=matchMedia("(prefers-reduced-motion: reduce)");
  let cleared=false;
  const finish=()=>animation.finish();
  const clear=()=>{
   if(cleared)return;cleared=true;
   animation.cancel();element.style.overflow=oldOverflow;
   document.removeEventListener("visibilitychange",finish);
   reduce.removeEventListener("change",finish);window.removeEventListener(preferenceEvent,finish);
  };
  document.addEventListener("visibilitychange",finish);
  reduce.addEventListener("change",finish);window.addEventListener(preferenceEvent,finish);
  void animation.finished.then(()=>{
   if(cleared)return;
   clear();setPlaceholderReady(true);
  },()=>{});
  return clear;
 },[preserveAll,suspend]);
 useLayoutEffect(()=>{
  const element=root.current;if(!element)return;
  if(previousToken.current!==revealToken){
   previousToken.current=revealToken;completed.current=false;waitedOnEntry.current=null;notified.current=false;
  }
  if(!resolved){
   const initial=element.querySelector<HTMLElement>("[data-skeleton-initial]");
   const delay=`-${Math.max(0,performance.now()-(wait?.fallbackStartedAt??performance.now()))}ms`;
   initial?.style.setProperty("--skeleton-entry-delay",delay);
   initial?.style.setProperty("--skeleton-breathe-delay",delay);
   return;
  }
  window.clearTimeout(element.__skeletonTimeout);
  const serverEntry=element.dataset.revealEntry==="server";
  if(waitedOnEntry.current===null){
   waitedOnEntry.current=wait?.fallbackShown??false;
  }
  const fallbackShown=waitedOnEntry.current;
  const freshResponse=!!revealToken&&!revealed.has(revealToken);

  const launch=wait?.launch?.current;
  if(launch)window.clearTimeout((launch as RevealRoot).__skeletonTimeout);
  if(!shouldAnimateSkeleton({serverEntry,waited:fallbackShown||freshResponse,completed:completed.current,expired:element.dataset.revealPhase==="expired"||launch?.dataset.revealPhase==="expired",reduced:prefersReducedMotion(),visible:document.visibilityState==="visible",supported:typeof Element.prototype.animate==="function"})){
   if(!serverEntry&&!fallbackShown)element.dataset.revealStop="no-wait";
   if(wait){wait.fallbackShown=false;wait.measuredStartedAt=undefined;}
   if(launch)launch.dataset.revealPhase="ready";
   if(revealToken)revealed.add(revealToken);
   element.dataset.revealPhase="ready";completed.current=true;notifyComplete();return;
  }
  return startSkeletonReveal(element,serverEntry,()=>{
   completed.current=true;
   if(revealToken)revealed.add(revealToken);
   if(wait){wait.fallbackShown=false;wait.measuredStartedAt=undefined;}
   notifyComplete();
  },launch??undefined,wait?.fallbackStartedAt,wait??undefined);
 },[wait,resolved,revealToken,revealed,notifyComplete]);
 return <Root ref={attachRoot} id={id} className={cn(styles.content,className)} data-reveal-root="" data-skeleton-persistent-initial={suspend?"":undefined} data-skeleton-preserve-all={preserveAll?"":undefined} data-skeleton-waiting={suspend&&!resolved?"":undefined} suppressHydrationWarning>
  {!suspend&&<DocumentEntryBootstrap/>}
  <div className={styles.startupSplash} data-skeleton-splash="">{wait?.launch?null:splash}</div>
  <div className={styles.initial} data-skeleton-initial="" role={suspend&&!resolved?"status":undefined} aria-label={suspend&&!resolved?label:undefined} aria-busy={suspend&&!resolved?true:undefined}>{fallback}</div>
  <div className={styles.resolved} data-skeleton-resolved="">{suspend?placeholderReady?<Suspense fallback={<SkeletonCommit ready={false} onCommit={commit}/>}>
   {children}<SkeletonCommit ready onCommit={commit}/>
  </Suspense>:null:children}</div>
 </Root>;
}
