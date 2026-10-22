"use client";

import {createContext,use,useContext,useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {useTranslations} from "next-intl";
import {Button} from "@sohoin/ui/button";
import {SkeletonBoundary,SkeletonContent} from "@sohoin/ui/skeleton-reveal";
import {DiscussionSkeleton} from "./discussion-skeleton";
import {loadPublishedComment} from "./discussion-publication-action";
import {discussionPublicationEvent,discussionCountEvent,type DiscussionPublicationAttempt} from "./discussion-publication-event";
import styles from "./discussion.module.css";

type Entry={key:string;publicId?:string;promise:Promise<ReactNode>;token:object;error?:boolean};
const PublishedIds=createContext<ReadonlySet<string>>(new Set());
export function usePublishedCommentIds(){return useContext(PublishedIds);}

/** An isolated insertion slot: existing server cards and pagination stay mounted. */
export function DiscussionPublication({targetIds,existingIds,children,nested=false,branch=false}:{targetIds:string[];existingIds:string[];children:ReactNode;nested?:boolean;branch?:boolean}){
 const t=useTranslations("Web"),root=useRef<HTMLDivElement>(null);
 const [entries,setEntries]=useState<Entry[]>([]);
 const targets=useRef(targetIds);
 const alive=useRef(false);
 useLayoutEffect(()=>{targets.current=[...targetIds,...(branch?entries.flatMap(entry=>entry.publicId?[entry.publicId]:[]):[])];},[targetIds,entries,branch]);
 function read(key:string,publicId:string){
  return loadPublishedComment(publicId,targetIds[0],nested).then(result=>{
   if(alive.current)window.dispatchEvent(new CustomEvent(discussionCountEvent,{detail:result.counts}));
   return result.node;
  },()=>{
   if(alive.current)setEntries(previous=>previous.map(entry=>entry.key===key?{...entry,error:true}:entry));
   return null;
  });
 }
 useLayoutEffect(()=>{
  alive.current=true;
  const begin=(event:Event)=>{
   const attempt=(event as CustomEvent<DiscussionPublicationAttempt>).detail;
   const element=root.current;
   if(attempt.handled||!targets.current.includes(attempt.targetId)||!element||element.closest('[data-covered="true"]')||!element.getClientRects().length)return;
   attempt.handled=true;
   const key=crypto.randomUUID();
   const promise=attempt.result.then(publicId=>{
    if(!alive.current)return null;
    if(!publicId){setEntries(previous=>previous.filter(entry=>entry.key!==key));return null;}
    setEntries(previous=>previous.map(entry=>entry.key===key?{...entry,publicId}:entry));
    return read(key,publicId);
   });
   setEntries(previous=>[{key,promise,token:{}},...previous]);
  };
  window.addEventListener(discussionPublicationEvent,begin);
  return ()=>{alive.current=false;window.removeEventListener(discussionPublicationEvent,begin);};
 },[]);
 // A later server refresh owns any IDs it now supplies; never show them twice.
 useLayoutEffect(()=>{
  setEntries(previous=>previous.some(entry=>entry.publicId&&existingIds.includes(entry.publicId))?previous.filter(entry=>!entry.publicId||!existingIds.includes(entry.publicId)):previous);
 },[existingIds]);
 const visible=entries.filter(entry=>!entry.publicId||!existingIds.includes(entry.publicId));
 const published=new Set(visible.flatMap(entry=>entry.publicId?[entry.publicId]:[]));
 return <PublishedIds.Provider value={published}><div ref={root}>
  {visible.map(entry=>entry.error?<p key={entry.key} role="status">{t("discussionTryAgain")} <Button variant="link" onClick={()=>{
   if(!entry.publicId)return;
   const promise=read(entry.key,entry.publicId);
   setEntries(previous=>previous.map(item=>item.key===entry.key?{...item,error:false,promise,token:{}}:item));
  }}>{t("retry")}</Button></p>:<SkeletonBoundary key={entry.key}>
   <SkeletonContent suspend preserveAll fallback={<DiscussionSkeleton rows={1}/>} revealToken={entry.token} label={t("loadingDiscussion")}>
    <ol className={nested?styles.replies:styles.threads}><li className={nested?undefined:styles.thread}><PublishedComment promise={entry.promise}/></li></ol>
   </SkeletonContent>
  </SkeletonBoundary>)}
  {children}
 </div></PublishedIds.Provider>;
}

function PublishedComment({promise}:{promise:Promise<ReactNode>}){return use(promise);}
