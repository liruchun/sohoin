"use client";

import {useEffect} from "react";
import {prefersReducedMotion} from "@sohoin/ui/theme-preference";

type Traversal=Event&{
 navigationType:string;canIntercept:boolean;hashChange:boolean;hasUAVisualTransition?:boolean;
 destination:{url:string;sameDocument:boolean;index:number};signal:AbortSignal;
 intercept(options:{handler:()=>Promise<void>;focusReset:"manual"}):void;
 scroll():void;
};
type Session={commit:()=>void;cancel:()=>void};
let session:Session|null=null;
export function commitHistoryMotion(){session?.commit();}

/** Coordinate one same-document traversal, not history entries or scroll data.
 * Next receives the original popstate state after the old pixels are captured.
 * Navigation.scroll restores the browser's own persisted position. */
export function HistoryMotion(){
 useEffect(()=>{
  const navigation=(window as Window&{navigation?:EventTarget&{currentEntry?:{index:number}|null}}).navigation;
  if(!navigation||!document.startViewTransition)return;
  let replaying=false;
  let held:PopStateEvent|null=null;
  let captureReady=false;
  const replay=()=>{
   if(!held||!captureReady)return;
   const event=held;held=null;
   replaying=true;
   try{window.dispatchEvent(new PopStateEvent("popstate",{state:event.state}));}
   finally{replaying=false;}
  };
  const pop=(event:PopStateEvent)=>{
   if(replaying||!session)return;
   event.stopImmediatePropagation();held=event;replay();
  };
  const navigate=(raw:Event)=>{
   const event=raw as Traversal;
   // Next synchronizes the current entry with replaceState after committing.
   // That bookkeeping must not cancel the traversal's in-flight snapshots.
   if(event.navigationType!=="traverse")return;
   const returning=event.destination.index>=0&&event.destination.index<(navigation.currentEntry?.index??-1);
   session?.cancel();
   const destination=new URL(event.destination.url);
   if(!event.canIntercept||!event.destination.sameDocument||event.hashChange||event.hasUAVisualTransition||prefersReducedMotion())return;
   if(destination.pathname===location.pathname&&destination.search===location.search)return;
   const old=document.querySelector<HTMLElement>("[data-page-motion]");
   if(!old)return;
   const restores:Array<()=>void>=[];
   const mark=(element:HTMLElement,name:string,className="page-switch")=>{
    const properties=["view-transition-name","view-transition-class"];
    const values=properties.map(property=>element.style.getPropertyValue(property));
    element.style.setProperty(properties[0],name);
    element.style.setProperty(properties[1],className);
    restores.push(()=>{
     if(element.style.getPropertyValue(properties[0])!==name)return;
     properties.forEach((property,index)=>values[index]?element.style.setProperty(property,values[index]):element.style.removeProperty(property));
    });
   };
   let releaseCapture=()=>{},releaseNavigation=()=>{};
   const committed=new Promise<void>(resolve=>{releaseNavigation=resolve;});
   let transition:ViewTransition|undefined,timer:ReturnType<typeof setTimeout>|undefined;
   let routeCommitted=false;
   let settle:ReturnType<typeof setTimeout>|undefined;
   const finish=()=>{clearTimeout(timer);clearTimeout(settle);releaseCapture();releaseNavigation();};
   const current:Session={
    commit:()=>{
     if(!captureReady)return;
     routeCommitted=true;
     clearTimeout(settle);
     settle=setTimeout(()=>{
      if(session!==current)return;
      const next=document.querySelector<HTMLElement>("[data-page-motion]");
      if(next)mark(next,"history-page-new");
      try{event.scroll();}catch{/* Aborted traversal keeps native recovery. */}
      finish();
     },0);
    },
    cancel:()=>{
     transition?.skipTransition();captureReady=true;
     if(event.signal.aborted)held=null;else replay();
     finish();
     restores.reverse().forEach(restore=>restore());
     if(session===current)session=null;
    },
   };
   const abort=()=>{
    // Next's insertion effect synchronizes history before layout effects report
    // the route commit. Decide after that commit, not inside replaceState.
    queueMicrotask(()=>{
     if(session!==current)return;
     if(routeCommitted&&location.pathname===destination.pathname&&location.search===destination.search)return;
     current.cancel();
    });
   };
   try{
    event.intercept({handler:()=>committed,focusReset:"manual"});
    session=current;held=null;captureReady=false;
    mark(old,"history-page-old");
    transition=document.startViewTransition({types:returning?["page-switch","page-back"]:["page-switch"],update:()=>new Promise<void>(resolve=>{
     releaseCapture=resolve;
     if(session!==current){resolve();return;}
     captureReady=true;replay();
    })});
    timer=setTimeout(current.cancel,1500);
    event.signal.addEventListener("abort",abort,{once:true});
    void transition.ready.catch(()=>{});
    void transition.finished.then(()=>{
     finish();restores.reverse().forEach(restore=>restore());
     event.signal.removeEventListener("abort",abort);
     if(session===current)session=null;
    });
   }catch{current.cancel();}
  };
  navigation.addEventListener("navigate",navigate);
  window.addEventListener("popstate",pop,true);
  return ()=>{session?.cancel();navigation.removeEventListener("navigate",navigate);window.removeEventListener("popstate",pop,true);};
 },[]);
 return null;
}
