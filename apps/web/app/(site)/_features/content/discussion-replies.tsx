"use client";
import {useTranslations} from "next-intl";
import {use,useEffect,useId,useRef,useState,type ReactNode} from "react";
import {CirclePlus} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {SkeletonBoundary,SkeletonContent} from "@sohoin/ui/skeleton-reveal";
import {cn} from "@sohoin/ui/utils";
import {DiscussionSkeleton} from "./discussion-skeleton";
import {afterPaint,collapseLoadRow} from "./discussion-load";
import styles from "./discussion.module.css";
import {DiscussionPublication,usePublishedCommentIds} from "./discussion-publication";

type ReplyItem={id:string;node:ReactNode};
type ReplyPage={items:ReplyItem[];next:string|null};
type BatchResult={page:ReplyPage}|{error:true};
type Batch={id:string;token:object;promise:Promise<BatchResult>;page?:ReplyPage;done?:boolean};

export function DiscussionReplies({loadMore,initialNext,items,href,depth=1,publicationTarget}:{loadMore:(cursor:string|null)=>Promise<ReplyPage>;initialNext:string|null;items:ReplyItem[];href:string;depth?:number;publicationTarget:string}){
 const t=useTranslations("Web");
 const listId=useId(),lock=useRef(false),sequence=useRef(0),pages=useRef(new Map<string,ReplyPage>()),row=useRef<HTMLDivElement>(null);
 const [batches,setBatches]=useState<Batch[]>([]),[next,setNext]=useState(initialNext);
 const [error,setError]=useState(false),[loaded,setLoaded]=useState(0),[loading,setLoading]=useState(false);
 // A response without a next cursor withdraws the "more" row; keep it mounted
 // until its height has shrunk so the revealed replies do not jump upward.
 const [closing,setClosing]=useState(false);
 const hasMore=Boolean(next),root=depth===0;
 function load(){
  if(lock.current||!next)return;
  lock.current=true;setError(false);setLoading(true);
  const id=String(sequence.current++),token={};
  // Let the placeholder commit and paint before the request starts; a fast
  // response must not replace the placeholder before it is visible.
  const request=new Promise<ReplyPage>((resolve,reject)=>{
   afterPaint(()=>{try{loadMore(next).then(resolve,reject);}catch(error){reject(error);}});
  });
  const promise:Promise<BatchResult>=request.then(
   (page):BatchResult=>{
    pages.current.set(id,page);
    // The response decides whether a next-page control exists before reveal.
    // Keep the request lock until reveal completes, independently of the cursor.
    setNext(page.next);
    if(!page.next)setClosing(true);
    setBatches(previous=>previous.map(batch=>batch.id===id?{...batch,page}:batch));
    return {page};
   },
   ():BatchResult=>{setBatches(previous=>previous.filter(batch=>batch.id!==id));setError(true);lock.current=false;setLoading(false);return {error:true};}
  );
  setBatches(previous=>[...previous,{id,token,promise}]);
 }
 const settle=(id:string)=>{
  const page=pages.current.get(id);
  if(!page)return;
  pages.current.delete(id);
  setLoaded(count=>count+page.items.length);
  lock.current=false;setLoading(false);
  setBatches(previous=>previous.map(batch=>batch.id===id?{...batch,page:page??batch.page,done:true}:batch));
 };
 const settled=batches.filter(batch=>batch.done&&batch.page),pending=batches.filter(batch=>!batch.done);
 useEffect(()=>{
  if(!closing)return;
  const element=row.current;
  if(!element){setClosing(false);return;}
  return collapseLoadRow(element,()=>setClosing(false));
 },[closing]);
 return <DiscussionPublication branch targetIds={[publicationTarget,...items.map(item=>item.id),...settled.flatMap(batch=>batch.page?.items.map(item=>item.id)??[])]} existingIds={items.map(item=>item.id)} nested={!root}>
  <div id={listId} aria-busy={loading||undefined}>
   {(items.length>0||settled.length>0)&&<ol className={root?styles.threads:styles.replies}>
    <ReplyRows items={items} root={root}/>
    {settled.map(batch=><ReplyRows key={batch.id} items={batch.page?.items??[]} root={root}/>)}
   </ol>}
   {pending.map(batch=><SkeletonBoundary key={batch.id}>
    <SkeletonContent as="div" className={root?styles.batch:styles.replyBatch} suspend preserveAll fallback={root?<DiscussionSkeleton rows={1}/>:<ReplySkeleton/>} revealToken={batch.token} label={t("loadingDiscussion")} onRevealComplete={()=>settle(batch.id)}>
     <ReplyBatch promise={batch.promise} root={root}/>
    </SkeletonContent>
   </SkeletonBoundary>)}
  </div>
  {(hasMore||closing)&&<div ref={row} className={styles.moreRow} data-skeleton-item="" data-loading={loading||undefined} data-closing={closing||undefined}>
  <Button variant="plain" size="sm" className={cn(styles.more,root?styles.moreRoot:styles.moreBatch)} aria-controls={listId} aria-disabled={loading||closing} onClick={load}>
   <MagneticSurface className={styles.moreSurface} disabled={loading||closing} data-skeleton-part="block">
    <CirclePlus size=".875rem" aria-hidden="true"/><span>{error?t("loadFailedRetry"):t("moreReplies")}</span>
   </MagneticSurface>
  </Button></div>}
  {initialNext&&<noscript><a className={cn(styles.more,root?styles.moreRoot:styles.moreBatch)} href={href}><span className={styles.moreSurface}>{t("remainingReplies")}</span></a></noscript>}
  <span className={styles.replyStatus} role="status">{error?t("repliesFailed"):loaded?t("expandedReplies",{count:loaded}):""}</span>
 </DiscussionPublication>;
}

function ReplyBatch({promise,root}:{promise:Promise<BatchResult>;root:boolean}){
 const result=use(promise);
 if("error" in result)return null;
 return <ol className={root?styles.threads:styles.replies}><ReplyRows items={result.page.items} root={root}/></ol>;
}

function ReplyRows({items,root}:{items:ReplyItem[];root:boolean}){
 const published=usePublishedCommentIds();
 return items.filter(item=>!published.has(item.id)).map(item=><li key={item.id} className={root?styles.thread:undefined}>{item.node}</li>);
}

function ReplySkeleton(){
 return <ol className={styles.replies} aria-hidden="true">
  <li data-skeleton-item="">
   <div className={`${styles.placeholder} ${styles.card}`} data-within-discussion="">
    <span className={`${styles.avatarPlaceholder} ${styles.replySkeletonAvatar}`} data-skeleton-part="block" data-skeleton-placeholder=""/>
    <div className={styles.content}>
     <div className={styles.heading}><div className={styles.meta}>
      <span className={styles.namePlaceholder} data-skeleton-part="name" data-skeleton-placeholder=""/>
      <span className={styles.datePlaceholder} data-skeleton-part="meta" data-skeleton-placeholder=""/>
     </div><span className={styles.menuPlaceholder} data-skeleton-part="menu" data-skeleton-placeholder=""/></div>
     <span className={styles.linePlaceholder} data-skeleton-part="body" data-skeleton-placeholder=""/>
     <span className={styles.shortPlaceholder} data-skeleton-part="body" data-skeleton-placeholder=""/>
     <div className={styles.actionsPlaceholder}><span className={styles.actionPlaceholder} data-skeleton-part="action" data-skeleton-placeholder=""/></div>
    </div>
   </div>
  </li>
 </ol>;
}
