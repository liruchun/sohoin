"use client";
import {useTranslations} from "next-intl";

import {useRef} from "react";
import {MotionConfig} from "motion/react";
import {prefersReducedMotion} from "@sohoin/ui/theme-preference";
import {Button} from "@sohoin/ui/button";
import {cn} from "@sohoin/ui/utils";
import {UsersIcon} from "./icons/users";
import {WrenchIcon} from "./icons/wrench";
import {BoxesIcon} from "./icons/boxes";
import {LayersIcon} from "./icons/layers";
import {BookTextIcon} from "./icons/book-text";
import styles from "./site-tabs.module.css";


function Tab({label,icon:Icon,selected}:{label:string;icon:typeof UsersIcon;selected:boolean}){
 const icon=useRef<{startAnimation:()=>void;stopAnimation:()=>void}>(null);
 return <Button variant="plain" data-skeleton-chrome-item="" aria-label={label} aria-current={selected?"page":undefined}
  className={cn(styles.tab,selected?styles.selected:styles.inactive)}
  onPointerEnter={event=>{if(event.pointerType==="mouse"&&!prefersReducedMotion()&&matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches)icon.current?.startAnimation();}}
  onPointerLeave={()=>icon.current?.stopAnimation()}>
  <Icon ref={icon} className={styles.icon} size={22} aria-hidden="true"/><span className={styles.label}>{label}</span>
 </Button>;
}
export function SiteTabs(){
 const t=useTranslations("Web");
 const tabs=[{label:t("community"),icon:UsersIcon},{label:t("tools"),icon:WrenchIcon},{label:t("guides"),icon:LayersIcon},{label:t("gear"),icon:BoxesIcon},{label:t("knowledge"),icon:BookTextIcon}];
 return <MotionConfig reducedMotion="user"><nav aria-label={t("communityNavigation")} className={styles.tabs}>
  {tabs.map(({label,icon})=><Tab key={label} label={label} icon={icon} selected={label===t("community")}/>)}
 </nav></MotionConfig>;
}
