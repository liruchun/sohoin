"use client";

import {Fragment,use,useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {useTranslations} from "next-intl";
import {SkeletonBoundary,SkeletonContent} from "@sohoin/ui/skeleton-reveal";
import {SiteSkeleton} from "../../_components/feedback/site-skeleton";
import {feedPublicationEvent,type FeedPublication as PublicationAttempt} from "./feed-publication-event";

type Row={id:string;node:ReactNode};
type Batch={id:string;token:object;promise:Promise<ReactNode>;resolve:(node:ReactNode)=>void;publicId?:string;source?:Row[]};

/** Server-rendered cards remain the source of truth, including current filters. */
export function FeedPublication({rows,empty}:{rows:Row[];empty:ReactNode}){
 const t=useTranslations("Web");
 const anchor=useRef<HTMLDivElement>(null),currentRows=useRef(rows);
 const [batches,setBatches]=useState<Batch[]>([]);
 useLayoutEffect(()=>{currentRows.current=rows;},[rows]);
 useLayoutEffect(()=>{
  let mounted=true;
  const pending=new Set<Batch>();
  const begin=(event:Event)=>{
   const element=anchor.current;
   // Intercepted details and Next's retained Activity trees are not visible lists.
   if(!element||element.closest('[data-covered="true"]')||!element.getClientRects().length)return;
   const {id,result}=(event as CustomEvent<PublicationAttempt>).detail;
   let resolve!:(node:ReactNode)=>void;
   const promise=new Promise<ReactNode>(done=>{resolve=done;});
   const batch:Batch={id,token:{},promise,resolve:node=>{pending.delete(batch);resolve(node);}};
   pending.add(batch);
   setBatches(previous=>[batch,...previous]);
   void result.then(publicId=>{
    if(!mounted)return;
    if(!publicId){batch.resolve(null);setBatches(previous=>previous.filter(item=>item.id!==id));return;}
    // Capture the pre-refresh response, so an unrelated earlier refresh cannot
    // be mistaken for the response that includes this newly published post.
    const source=currentRows.current;
    setBatches(previous=>previous.map(item=>item.id===id?{...item,publicId,source}:item));
   });
  };
  window.addEventListener(feedPublicationEvent,begin);
  return ()=>{mounted=false;window.removeEventListener(feedPublicationEvent,begin);for(const batch of pending)batch.resolve(null);};
 },[]);
 useLayoutEffect(()=>{
  const excluded=new Set<string>();
  for(const batch of batches){
   if(!batch.publicId||batch.source===rows)continue;
   const row=rows.find(item=>item.id===batch.publicId);
   batch.resolve(row?.node??null);
   if(!row)excluded.add(batch.id);
  }
  if(excluded.size)setBatches(previous=>previous.filter(batch=>!excluded.has(batch.id)));
 },[rows,batches]);
 const pendingIds=new Set(batches.map(batch=>batch.publicId));
 return <div ref={anchor} aria-busy={batches.length>0||undefined}>
  {batches.map(batch=><SkeletonBoundary key={batch.id}>
   <SkeletonContent suspend preserveAll fallback={<SiteSkeleton listOnly rows={1}/>} revealToken={batch.token} label={t("loadingPosts")} onRevealComplete={()=>setBatches(previous=>previous.filter(item=>item.id!==batch.id))}>
    <PublishedCard promise={batch.promise}/>
   </SkeletonContent>
  </SkeletonBoundary>)}
  {rows.length?rows.filter(row=>!pendingIds.has(row.id)).map(row=><Fragment key={row.id}>{row.node}</Fragment>):batches.length?null:empty}
 </div>;
}

function PublishedCard({promise}:{promise:Promise<ReactNode>}){return use(promise);}
