"use client";
import {useTranslations} from "next-intl";
import {Flame,HeartHandshake} from "lucide-react";
import Link from "next/link";
import type {ReactNode} from "react";
import {communityHref,type CommunitySort} from "./community-route";
import styles from "./community.module.css";

/** Persistent sort bar: plain navigation so only the list below swaps. */
export function CommunitySortTabs({slug,sort}:{slug:string;sort:CommunitySort}){
 const t=useTranslations("Web");
 const tab=(value:CommunitySort,label:string,icon:ReactNode)=><Link key={value} scroll={false} href={communityHref({slug,sort:value})} className={styles.sortTab} aria-current={sort===value?"page":undefined}>
  {icon}<span className={styles.sortLabel}>{label}</span>
 </Link>;
 const clock=<svg className={styles.sortIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="10"/>
  <line className={styles.clockHand} x1="12" x2="12" y1="12" y2="6"/>
  <line className={styles.minuteHand} x1="12" x2="16" y1="12" y2="12"/>
 </svg>;
 return <nav className={styles.sortBar} aria-label={t("communityNavigation")}>
  {tab("latest",t("tabLatest"),clock)}
  {tab("hot",t("hot"),<Flame className={`${styles.sortIcon} ${styles.flameIcon}`} strokeWidth={1.75} aria-hidden="true"/>)}
  {tab("mine",t("myInteractions"),<HeartHandshake className={`${styles.sortIcon} ${styles.handshakeIcon}`} strokeWidth={1.75} aria-hidden="true"/>)}
 </nav>;
}
