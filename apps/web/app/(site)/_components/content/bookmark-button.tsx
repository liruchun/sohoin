"use client";
import {useRef,useState} from "react";
import {useTranslations} from "next-intl";
import {ContentActionIcon} from "./content-action-icon";
import {Button} from "@sohoin/ui/button";
import styles from "./content-actions.module.css";
import {useToast} from "@sohoin/ui/toast";
import type {SiteInteraction} from "@sohoin/extension-api/interactions";

export type BookmarkTarget={publicId:string;commentToken?:string;interaction?:SiteInteraction};

/** Bookmark state remains independent from reaction responses. */
export function BookmarkButton({target,onBookmarked}:{target:BookmarkTarget;onBookmarked?:()=>void}){
 const t=useTranslations("Web"),{notify}=useToast(),writing=useRef(false);
 const [source,setSource]=useState(target?.interaction),[saved,setSaved]=useState(target?.interaction?.bookmarked??false);
 const [optimistic,setOptimistic]=useState<boolean|null>(null);
 if(source!==target?.interaction){setSource(target?.interaction);setSaved(target?.interaction?.bookmarked??false);}
 const active=optimistic??saved;
 const [hovered,setHovered]=useState(false);
 async function toggle(){
  if(!target||writing.current)return;
  writing.current=true;setOptimistic(!active);
  try{
   const value={active:!active};
   const response=await fetch(`/api/site/interactions/${target.publicId}/${target.commentToken?"comments/":""}bookmark`,{
    method:"PUT",headers:{"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify(target.commentToken?{commentToken:target.commentToken,value}:value),
   });
   if(!response.ok){
    if(response.status===401)setSaved(false);
    notify({variant:response.status===401?"warning":"error",...(response.status===401?{action:{label:t("login"),href:"/admin/login"}}:{}),message:t(response.status===401?"signInRequired":response.status===429?"tooManyRequests":response.status===403?"notAllowed":"actionFailed")});
    return;
   }
   const result:SiteInteraction=await response.json();setSaved(result.bookmarked);if(result.bookmarked)onBookmarked?.();
  }catch{notify({variant:"error",message:t("networkFailed")});}
  finally{writing.current=false;setOptimistic(null);}
 }
 return <Button variant="plain" size="icon-sm" className={styles.action} data-skeleton-shape="" data-skeleton-action="bookmark" onPointerEnter={event=>{if(event.pointerType==="mouse")setHovered(true);}} onPointerLeave={()=>setHovered(false)} onFocus={()=>setHovered(true)} onBlur={()=>setHovered(false)} aria-disabled={optimistic!==null} aria-pressed={active} aria-label={t(active?"unbookmark":"bookmark")} title={t(active?"unbookmark":"bookmark")} onClick={()=>{void toggle();}}>
  <ContentActionIcon name="bookmark" active={hovered}/>
 </Button>;
}
