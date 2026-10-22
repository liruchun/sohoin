"use client";
import {useTranslations} from "next-intl";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {Check,Hash,Plus} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {useToast} from "@sohoin/ui/toast";
import type {CommunityHeaderTopic} from "./community-header-context";
import styles from "./community-menu.module.css";

/** Client-rendered header identity; the page keeps the single server-rendered H1. */
export function CommunityHeaderMenu({topic}:{topic:CommunityHeaderTopic}){
 const t=useTranslations("Web"),{notify}=useToast();
 const [joined,setJoined]=useState(topic.joined);
 const [pending,setPending]=useState(false);
 const slugRef=useRef(topic.slug);
 useEffect(()=>{slugRef.current=topic.slug;setJoined(topic.joined);},[topic.slug,topic.joined]);
 async function toggle(){
  if(pending)return;
  const slug=topic.slug,next=!joined;
  setPending(true);
  try{
   const response=await fetch(`/api/site/community/${encodeURIComponent(slug)}/membership`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({joined:next})});
   const data=await response.json().catch(()=>null);
   if(slugRef.current!==slug)return;
   if(!response.ok){notify({variant:"error",message:data?.error?.message??t("actionFailed")});return;}
   setJoined(Boolean(data?.joined));
  }catch{if(slugRef.current===slug)notify({variant:"error",message:t("networkFailed")});}
  finally{setPending(false);}
 }
 const join=!topic.authenticated
  ?<Button asChild variant="default" size="sm" className={styles.join}><Link href="/admin/login">{t("join")}</Link></Button>
  :<Button type="button" variant={joined?"outline":"default"} size="sm" className={styles.join} disabled={pending} aria-pressed={joined} title={joined?t("leaveCommunity"):undefined} onClick={toggle}>
   {pending?t("saving"):joined?<><Check aria-hidden="true"/>{t("joined")}</>:<><Plus aria-hidden="true"/>{t("join")}</>}
  </Button>;
 return <div className={styles.menu}>
  <span className={styles.icon} aria-hidden="true">{topic.iconUrl?<img className={styles.iconImage} src={topic.iconUrl} alt="" width={36} height={36} decoding="async"/>:<Hash/>}</span>
  <div className={styles.identity}>
   <p className={styles.title}>{topic.name}</p>
   <p className={styles.description}>{topic.description||t("communityTopicDescription",{name:topic.name})}</p>
  </div>
  {join}
 </div>;
}
