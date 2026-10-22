"use client";
import {useState,type ReactNode} from "react";
import type {WornBadge} from "@sohoin/extension-api/badges";
import {useSiteMedals} from "../shell/site-medals";
import {MedalIcon} from "./medal-icon";
import styles from "./author-avatar.module.css";

export function AuthorAvatar({src,name,publicId,wornBadge=null,fallback}:{src:string|null;name:string;publicId?:string;wornBadge?:WornBadge|null;fallback?:ReactNode}){
 const [failed,setFailed]=useState<string|null>(null);
 const medals=useSiteMedals();
 const badge=publicId&&medals?.collection?.user.publicId===publicId?medals.collection.worn:wornBadge;
 return <span className={styles.avatar} aria-hidden="true" data-skeleton-part="block">
  <span className={styles.motion}>
  <span className={styles.frame}>
  {src&&failed!==src?
   // eslint-disable-next-line @next/next/no-img-element
   <img src={src} alt="" width={40} height={40} decoding="async" onError={()=>setFailed(src)}/>:
   <span className={styles.fallback}>{fallback??(Array.from(name.trim())[0]||"?")}</span>}
  </span>
  {badge&&<span className={styles.medal}><MedalIcon badge={badge}/></span>}
  </span>
 </span>;
}
