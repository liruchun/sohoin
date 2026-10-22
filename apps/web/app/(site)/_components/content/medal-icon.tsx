"use client";
import {useState} from "react";
import {Award} from "lucide-react";
import type {WornBadge} from "@sohoin/extension-api/badges";
import styles from "./medal-icon.module.css";

export function MedalIcon({badge}:{badge:WornBadge}){
 const [failed,setFailed]=useState<string|null>(null);
 return badge.iconUrl&&badge.iconUrl!==failed?
  // eslint-disable-next-line @next/next/no-img-element
  <img className={styles.image} src={badge.iconUrl} alt="" width={32} height={32} decoding="async" onError={()=>setFailed(badge.iconUrl)}/>:
  <Award className={styles.fallback} strokeWidth={1.5} aria-hidden="true"/>;
}
