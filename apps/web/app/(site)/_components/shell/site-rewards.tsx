"use client";

import {useEffect,useState} from "react";
import {useTranslations} from "next-intl";
import {Check} from "lucide-react";
import Link from "next/link";
import {cn} from "@sohoin/ui/utils";
import {useSiteMedals} from "./site-medals";
import {AuthorAvatar} from "../content/author-avatar";
import {MedalIcon} from "../content/medal-icon";
import {Button} from "@sohoin/ui/button";
import {ToggleGroup,ToggleGroupItem} from "@sohoin/ui/toggle-group";
import {SeedIcon} from "./icons/seed";
import styles from "./site-rewards.module.css";

// Fixed, bounded fixtures for the requested preview; no account data or writes.
const seedRecords=[
 {id:1,day:"21",label:"checkIn",amount:10},
 {id:2,day:"20",label:"redeem",amount:-12},
 {id:3,day:"20",label:"checkIn",amount:10},
 {id:4,day:"19",label:"checkIn",amount:10},
 {id:5,day:"18",label:"share",amount:10},
 {id:6,day:"18",label:"welcome",amount:100},
] as const;

export function SeedPanel(){
 const t=useTranslations("Rewards");
 const [filter,setFilter]=useState("all");
 const records=seedRecords.filter(record=>filter==="all"||(filter==="earned"?record.amount>0:record.amount<0));
 return <div className={styles.content}>
  <section className={styles.streak} aria-label={t("calendar")}>
   <div className={styles.summary}><p className={styles.number}>3<span>{t("streakDays")}</span></p><span className={styles.seedIcon}><SeedIcon size={32} strokeWidth={1.5}/></span></div>
   <h3>{t("keepGrowing")}</h3><p className={styles.description}>{t("streakDescription")}</p>
   <div className={styles.month}><h4>{t("month")}</h4><span><Check size={14} aria-hidden="true"/>{t("checkedIn")}</span></div>
   <div className={styles.weekdays} aria-hidden="true">{["mon","tue","wed","thu","fri","sat","sun"].map(day=><span key={day}>{t(day)}</span>)}</div>
   <ol className={styles.calendar} aria-label={t("month")}>
    {Array.from({length:31},(_,index)=>{
     const day=index+1,checked=day>=19&&day<=21;
     return <li key={day} style={day===1?{gridColumnStart:4}:undefined} data-checked={checked} data-current={day===21} aria-label={t(checked?"dayChecked":"dayUnchecked",{day})}>
      <span>{day}</span>{checked&&<Check size={12} aria-hidden="true"/>}
     </li>;
    })}
   </ol>
  </section>
  <div className={styles.balance}><span>{t("balance")}</span><strong><SeedIcon size={18} aria-hidden="true"/>{seedRecords.reduce((sum,record)=>sum+record.amount,0)}</strong></div>
  <section className={styles.records}>
   <h3>{t("records")}</h3>
   <ToggleGroup type="single" value={filter} onValueChange={value=>{if(value)setFilter(value);}} aria-label={t("recordFilter")} className={styles.filters}>
    {["all","earned","spent"].map(value=><ToggleGroupItem key={value} value={value} asChild><Button variant="ghost" size="sm">{t(value)}</Button></ToggleGroupItem>)}
   </ToggleGroup>
   <ul className={styles.ledger}>{records.map(record=><li key={record.id}><div><p>{t(record.label)}</p><time dateTime={`2026-10-${record.day}`}>2026.10.{record.day}</time></div><span className={styles.amount}>{record.amount>0?"+":""}{record.amount}</span></li>)}</ul>
  </section>
 </div>;
}

export function MedalPanel({active=true}:{active?:boolean}){
 const t=useTranslations("Rewards"),state=useSiteMedals();
 const collection=state?.collection;
 const check=state?.check,userId=collection?.user.publicId;
 useEffect(()=>{if(active&&userId)void check?.();},[active,userId,check]);
 if(!state||!collection)return <div className={styles.content}><p className={styles.empty}>{t("loginToWear")}</p><Button variant="outline" size="sm" asChild><Link href="/admin/login">{t("signIn")}</Link></Button></div>;
 const {worn,user,total,earned}=collection;
 return <div className={styles.content} aria-busy={state.pending}>
  <div className={styles.wearPreview}>
   <AuthorAvatar src={user.avatar} name={user.name} publicId={user.publicId} wornBadge={worn}/>
   <div><p className={styles.previewLabel}>{t("currentMedal")}</p><p className={styles.previewName}>{worn?.name??t("noMedalWorn")}</p></div>
   {worn&&!collection.items.some(item=>item.key===worn.key)&&<Button variant="plain" size="sm" disabled={state.pending} onClick={()=>void state.wear(null)}>{t("removeMedal")}</Button>}
  </div>
  <div className={styles.medalSummary}>
   <p>{t.rich("earnedCount",{count:earned,total,countValue:chunks=><strong>{chunks}</strong>})}</p>
   <progress className={styles.medalProgress} value={earned} max={total||1} aria-label={t("collectionProgress")}/>
  </div>
  {([true,false] as const).map(isEarned=>{
   const items=collection.items.filter(medal=>Boolean(medal.awardedAt)===isEarned);
   if(!items.length)return null;
   return <section key={String(isEarned)} className={styles.medalGroup} aria-label={t(isEarned?"earnedMedals":"lockedMedals")}>
    <h3 className={styles.medalGroupTitle}>{t(isEarned?"earnedMedals":"lockedMedals")}</h3>
    <ul className={styles.medals}>{items.map(medal=>{
     const selected=worn?.key===medal.key,date=medal.awardedAt?new Date(medal.awardedAt):null;
     const details=<><span className={styles.medalIcon}><span className={styles.medalArtwork}><MedalIcon badge={medal}/></span>{isEarned&&<Check className={styles.earnedCheck} aria-hidden="true"/>}</span>
      <span className={styles.medalDetails}><span className={styles.medalName}>{medal.name}{selected&&<span className={styles.wearing}>{t("wearing")}</span>}</span><span className={styles.medalDescription}>{medal.description}</span>{date&&<time className={styles.medalStatus} dateTime={medal.awardedAt!}>{t("earnedOn",{month:date.getUTCMonth()+1,day:date.getUTCDate()})}</time>}</span></>;
     return <li key={medal.key} data-earned={isEarned} data-worn={selected}>
      {isEarned?<Button variant="plain" className={cn(styles.medalChoice,styles.selectable)} aria-pressed={selected} aria-label={t(selected?"wearingNamed":"wearNamed",{name:medal.name})} disabled={state.pending} onClick={()=>{if(!selected)void state.wear(medal);}}>{details}</Button>:<div className={styles.medalChoice}>{details}</div>}
      {selected&&<Button variant="plain" size="sm" className={styles.removeMedal} disabled={state.pending} onClick={()=>void state.wear(null)}>{t("removeMedal")}</Button>}
     </li>;
    })}</ul>
   </section>;
  })}
  {total===0&&<p className={styles.empty}>{t("noMedals")}</p>}
  {collection.nextCursor&&<Button variant="outline" size="sm" className={styles.moreMedals} disabled={state.pending} onClick={()=>void state.loadMore()}>{t("moreMedals")}</Button>}
 </div>;
}
