"use client";
import {useTranslations} from "next-intl";

import {createContext,use,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {useSearchParams} from "next/navigation";
import type {SiteContent} from "@sohoin/core/server";
import {Dialog} from "@sohoin/ui/dialog";
import {DialogContent,DialogTitle} from "@sohoin/ui/dialog-content";
import {Button} from "@sohoin/ui/button";
import {SkeletonBoundary,SkeletonContent,SkeletonFallback} from "@sohoin/ui/skeleton-reveal";
import {DetailSkeleton} from "./detail-skeleton";
import {ContentDetail,detailTitle} from "./content-detail";
import {useDetailData,rememberDetail} from "./detail-data";
import {DetailValidationContext,type DetailCheck} from "./detail-validation";
import {DetailPanel} from "../../_components/content/detail-panel";
import {SiteMain,SiteFooter} from "../../_components/shell/site-shell";
import panelStyles from "../../_components/content/detail-panel.module.css";
import motion from "../../_components/feedback/page-transition.module.css";
import {useReadingReturn} from "../../_components/feedback/page-transition";

type DetailEntry={content:SiteContent|null;check:DetailCheck;error:boolean;retry:()=>void};
const Entry=createContext<DetailEntry|null>(null);

/** The route shell must not await server params above its loading boundary. */
export function DetailRouteBoundary({type,params,children}:{type:"post"|"article"|"comment";params:Promise<{id:string}>;children:ReactNode}){
 // The retained background route can also have an [id]. Use this slot's params.
 const {id}=use(params);
 return <DetailEntryBoundary key={id} id={id} type={type}>{children}</DetailEntryBoundary>;
}

/** Persist data and wait records in the layout; the Page still owns all detail DOM. */
export function DetailEntryBoundary({id,type,initial,interaction,children}:{id:string;type:"post"|"article"|"comment";initial?:SiteContent;interaction?:SiteContent["interaction"];children:ReactNode}){
 const {registry,revision}=useDetailData();
 const [content,setContent]=useState<SiteContent|null>(()=>{
  const item=initial??(()=>{const value=registry.opened.get(type+":"+id)??registry.items.get(type+":"+id)??registry.cache.get(type+":"+id);return value?.type===type?value:null;})();
  return item&&interaction?{...item,interaction}:item;
 });
 const current=useRef(content);
 const previousRevision=useRef(revision);
 useEffect(()=>{if(previousRevision.current===revision)return;previousRevision.current=revision;current.current=null;setContent(null);},[revision]);
 useLayoutEffect(()=>{if(content&&!content.bodyTruncated)rememberDetail(registry,content);},[registry,content]);
 const [check,setCheck]=useState<DetailCheck>({}),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const validate=useCallback((value:DetailCheck)=>{
  if(value.unavailable)registry.opened.delete(type+":"+id);
  if(value.head&&current.current&&current.current.updatedAt!==value.head.updatedAt){current.current=null;setContent(null);}
  setCheck(value);
 },[registry,type,id]);
 const ready=Boolean(content&&!content.bodyTruncated);
 useEffect(()=>{
  if(check.unavailable||ready)return;
  const controller=new AbortController();setError(false);
  void (async()=>{
   try{
    const response=await fetch(`/api/site/content/${type}/${id}`,{signal:controller.signal,cache:"no-store"});
    if(response.status===404){if(!controller.signal.aborted){registry.opened.delete(type+":"+id);setCheck({unavailable:true});}return;}
    if(!response.ok)throw new Error("Unable to load content");
    const data=await response.json() as {content:SiteContent};
    if(!controller.signal.aborted){current.current=data.content;setContent(data.content);}
   }catch{if(!controller.signal.aborted)setError(true);}
  })();
  return ()=>controller.abort();
 },[id,type,ready,check.unavailable,retry,registry]);
 const retryContent=useCallback(()=>{setError(false);setRetry(value=>value+1);},[]);
 return <DetailValidationContext.Provider value={validate}>
  <Entry.Provider value={{content,check,error,retry:retryContent}}><SkeletonBoundary>{children}</SkeletonBoundary></Entry.Provider>
 </DetailValidationContext.Provider>;
}

export function DetailLayer({children}:{children:ReactNode}){
 const t=useTranslations("Web");
 const entry=useContext(Entry);if(!entry)throw new Error("Missing detail entry");
 const {content,check,error,retry}=entry;
 const {brand,reactionOptions}=useDetailData();
 const query=useSearchParams().toString(),returning=useReadingReturn();
 const ready=Boolean(content&&!content.bodyTruncated);
 const message=check.unavailable?t("unavailable"):t("fullContentFailed");
 const readyDetail=ready&&content?<>
  <ContentDetail content={content} reactionOptions={reactionOptions} interaction={content.interaction}/>
  {error&&<p role="status">{message} <Button variant="link" onClick={retry}>{t("retry")}</Button></p>}
 </>:null;
 const waiting=check.unavailable||error?<DetailPanel title={check.unavailable?t("contentUnavailable"):t("contentFailed")}>
  <p role="status">{message} {error&&<Button variant="link" onClick={retry}>{t("retry")}</Button>}</p>
 </DetailPanel>:<SkeletonFallback label={t("loadingContent")}><DetailSkeleton/></SkeletonFallback>;
 const body=<>
  <SkeletonBoundary scope="body">
   {readyDetail?<SkeletonContent fallback={<DetailSkeleton/>}>{readyDetail}</SkeletonContent>:waiting}
  </SkeletonBoundary>
  <div className={panelStyles.frame}><SkeletonBoundary scope="discussion" resetKey={query}>{children}</SkeletonBoundary></div>
 </>;
 return (
  <Dialog modal={false} open onOpenChange={value=>{if(!value)returning();}}>
   <DialogContent size="document" className={motion.surface} showCloseButton={false} aria-describedby={undefined}
    onInteractOutside={event=>event.preventDefault()}
    onOpenAutoFocus={event=>{
     const scope=event.currentTarget;
     if(!(scope instanceof HTMLElement))return;
     const target=scope.querySelector<HTMLElement>("[data-slot=dialog-title]");
     if(!target)return;
     event.preventDefault();
     // The global return control lives outside the dialog; focus its title.
     target.focus({preventScroll:true});
    }}
    onCloseAutoFocus={event=>event.preventDefault()}>
    <DialogTitle asChild><span className="sr-only" tabIndex={-1}>{content&&!check.unavailable?detailTitle(content,t("communityPost")):t("contentDetails")}</span></DialogTitle>
    <SiteMain id="detail-content">{body}</SiteMain>
    <SiteFooter brand={brand}/>
   </DialogContent>
  </Dialog>
 );
}
