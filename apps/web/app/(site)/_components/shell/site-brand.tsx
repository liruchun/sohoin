"use client";
import {useTranslations} from "next-intl";

import styles from "./site-brand.module.css";
import {cn} from "@sohoin/ui/utils";
import {ReadingLink as Link} from "../feedback/page-transition";
import {useEffect,useRef,useState} from "react";
import type {PublicSiteSettings} from "@sohoin/extension-api/settings";

export function SiteBrand({brand,logo,className}:{brand:string;logo:PublicSiteSettings["logo"];className?:string}){
 const t=useTranslations("Web");
 const anchor=useRef<HTMLAnchorElement>(null);
 const [dark,setDark]=useState(false),[failedLogo,setFailedLogo]=useState<string|null>(null);
 const logoSrc=dark?(logo.dark??logo.normal):logo.normal;
 const hasLogo=Boolean(logoSrc&&failedLogo!==logoSrc);
 useEffect(()=>{
  if(!logo.normal&&!logo.dark)return;
  const site=anchor.current?.closest(".public-site");
  const roots=[document.documentElement,document.body,...(site?[site]:[])];
  const sync=()=>setDark(roots.some(root=>root.getAttribute("data-theme")==="dark"||root.classList.contains("dark")));
  sync();
  const observer=new MutationObserver(sync);
  roots.forEach(root=>observer.observe(root,{attributes:true,attributeFilter:["data-theme","class"]}));
  return()=>observer.disconnect();
 },[logo.dark,logo.normal]);
 return <Link data-skeleton-chrome-item="" ref={anchor} href="/" aria-label={t("homeLabel",{brand})} className={cn(styles.brand,className)}>
  {hasLogo&&<img className={cn("site-brand-logo",styles.logo)} data-scheme={dark?"dark":"light"} src={logoSrc!} width="128" height="40" alt="" onError={()=>setFailedLogo(logoSrc)}/>}
  {!hasLogo&&<span className={styles.name}>{brand}</span>}
  {!hasLogo&&<span className={styles.dot} aria-hidden="true"/>}
 </Link>;
}
