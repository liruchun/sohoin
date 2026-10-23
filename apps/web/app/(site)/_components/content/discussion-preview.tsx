"use client";
import {useTranslations} from "next-intl";


import {useEffect,useState,type MouseEvent} from "react";
import {ArrowRight} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {ScrollArea} from "@sohoin/ui/scroll-area";
import {SkeletonBoundary,SkeletonContent} from "@sohoin/ui/skeleton-reveal";
import {useToast} from "@sohoin/ui/toast";
import {loadDiscussionPreview} from "../../_features/content/discussion-preview-action";
import {AuthorAvatar} from "./author-avatar";
import {ReadingLink} from "../feedback/reading-navigation";
import type {DiscussionTarget} from "./discussion-composer-context";
import styles from "./post-composer.module.css";

type Preview=Awaited<ReturnType<typeof loadDiscussionPreview>>;
export type ReplyTarget={publicId:string;authorName:string;authorPublicId:string};
export function DiscussionPreview({target,onReply,onNavigate}:{target:DiscussionTarget;onReply:(reply:ReplyTarget)=>void;onNavigate:(event:MouseEvent<HTMLAnchorElement>)=>void}){
 const t=useTranslations("Web");
 const {notify}=useToast();
 const [items,setItems]=useState<Preview|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;setItems(null);setError(false);
  loadDiscussionPreview(target.publicId,target.type).then(value=>{if(active)setItems(value);},()=>{if(active)setError(true);});
  return ()=>{active=false;};
 },[target.publicId,target.type,attempt]);
 useEffect(()=>{
  if(!error)return;
  notify({variant:"error",message:t("discussionFailed"),action:{label:t("retry"),onClick:()=>setAttempt(value=>value+1)}});
  setError(false);
 },[error,notify,t]);
 const row=(item:Preview[number]["comment"],nested=false)=><div key={item.publicId} className={styles.previewRow} data-nested={nested||undefined} data-skeleton-item=""><AuthorAvatar src={item.avatar} name={item.authorName} publicId={item.authorPublicId} wornBadge={item.wornBadge}/><div className={styles.previewBody}><strong data-skeleton-part="name">{item.authorName}</strong><p data-skeleton-part="body">{item.replyToName&&<span className={styles.replyName}>{t("replyToPrefix",{name:item.replyToName})}</span>}{item.body}</p><Button variant="outline" size="sm" className={styles.replyLink} onClick={()=>onReply(item)}><MagneticSurface className={styles.replySurface} maxOffset={4}>{t("reply")}</MagneticSurface></Button></div></div>;
 if(!items?.length)return null;
 // An empty initial slot lets the shared reveal grow from zero using only the
 // received rows. Include the heading and spacing in that measured footprint.
 return <SkeletonBoundary key={attempt}><SkeletonContent revealToken={items} preserveAll className={styles.discussionReveal}><section className={styles.discussion}><ScrollArea viewportClassName={styles.discussionViewport}><div className={styles.discussionHeading}><h3>{t("existingDiscussion")}</h3><ReadingLink href={target.href} onClick={onNavigate} className={styles.discussionLink}>{t("allDiscussion")}<ArrowRight className={styles.linkArrow} aria-hidden="true"/></ReadingLink></div>{items.map(thread=><div key={thread.comment.publicId}>{row(thread.comment)}{thread.replies.map(item=>row(item,true))}</div>)}</ScrollArea></section></SkeletonContent></SkeletonBoundary>;
}
