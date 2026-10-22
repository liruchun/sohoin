"use client";
import {useTranslations} from "next-intl";
import {use,useEffect,useRef,useState,type ReactNode} from "react";
import {CirclePlus} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {SkeletonBoundary,SkeletonContent} from "@sohoin/ui/skeleton-reveal";
import {DiscussionSkeleton} from "./discussion-skeleton";
import {afterPaint,collapseLoadRow} from "./discussion-load";
import styles from "./discussion.module.css";
import {DiscussionPublication} from "./discussion-publication";

type ThreadItem={id:string;node:ReactNode};
type ThreadPage={items:ThreadItem[];next:string|null};
type BatchResult={page:ThreadPage}|{error:true};
type Batch={id:string;token:object;promise:Promise<BatchResult>;page?:ThreadPage;done?:boolean};

export function DiscussionThreads({children,loadMore,initialNext,initialHref,listId,publicationTarget,existingIds}:{children:ReactNode;loadMore:(cursor:string|null)=>Promise<ThreadPage>;initialNext:string|null;initialHref?:string;listId:string;publicationTarget:string;existingIds:string[]}){
 const t=useTranslations("Web");
 const lock=useRef(false),sequence=useRef(0),pages=useRef(new Map<string,ThreadPage>()),row=useRef<HTMLDivElement>(null);
 const [batches,setBatches]=useState<Batch[]>([]),[next,setNext]=useState(initialNext);
 const [error,setError]=useState(false),[loaded,setLoaded]=useState(0),[loading,setLoading]=useState(false);
 // A response without a next cursor withdraws the "more" row; keep it mounted
 // until its height has shrunk so the revealed comments do not jump upward.
 const [closing,setClosing]=useState(false);
 const hasMore=Boolean(next);
 function load(){
  if(lock.current||!next)return;
  lock.current=true;setError(false);setLoading(true);
  const id=String(sequence.current++),token={};
  // Let the placeholder commit and paint before the request starts; a fast
  // response must not replace the placeholder before it is visible.
  const request=new Promise<ThreadPage>((resolve,reject)=>{
   afterPaint(()=>{try{loadMore(next).then(resolve,reject);}catch(error){reject(error);}});
  });
  const promise:Promise<BatchResult>=request.then(
   (page):BatchResult=>{
    pages.current.set(id,page);
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
 return <DiscussionPublication targetIds={[publicationTarget]} existingIds={existingIds}>
  <div id={listId} aria-busy={loading||undefined}>
   <ol className={styles.threads}>
    {children}
    {settled.flatMap(batch=>batch.page?.items.map(item=><li key={item.id} className={styles.thread}>{item.node}</li>)??[])}
   </ol>
   {pending.map(batch=><SkeletonBoundary key={batch.id}>
    <SkeletonContent as="div" className={styles.batch} suspend preserveAll fallback={<DiscussionSkeleton rows={1}/>} revealToken={batch.token} label={t("loadingDiscussion")} onRevealComplete={()=>settle(batch.id)}>
     <DiscussionBatch promise={batch.promise}/>
    </SkeletonContent>
   </SkeletonBoundary>)}
  </div>
  {(hasMore||closing)&&<div ref={row} className={styles.loadMoreRow} data-magnetic-area="" data-skeleton-item="" data-loading={loading||undefined} data-closing={closing||undefined}>
   <Button variant="plain" className={styles.loadMore} aria-controls={listId} aria-disabled={loading||closing} onClick={load}>
    <MagneticSurface className={styles.loadMoreSurface} disabled={loading||closing} data-skeleton-part="block">
     <CirclePlus size=".875rem" aria-hidden="true"/><span>{error?t("loadFailedRetry"):t("moreDiscussion")}</span>
    </MagneticSurface>
   </Button>
  </div>}
  {initialNext&&initialHref&&<noscript><div className={styles.loadMoreRow}><a className={styles.loadMore} href={initialHref}><span className={styles.loadMoreSurface}>{t("moreDiscussion")}</span></a></div></noscript>}
  <span className={styles.replyStatus} role="status">{error?t("discussionTryAgain"):loaded?t("expandedDiscussion",{count:loaded}):""}</span>
 </DiscussionPublication>;
}

function DiscussionBatch({promise}:{promise:Promise<BatchResult>}){
 const result=use(promise);
 if("error" in result)return null;
 return <ol className={styles.threads}>{result.page.items.map(item=><li key={item.id} className={styles.thread}>{item.node}</li>)}</ol>;
}
