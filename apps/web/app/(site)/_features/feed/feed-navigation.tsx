"use client";

import {useId,useState} from "react";
import {useTranslations} from "next-intl";
import {Menu,Hash,UsersRound} from "lucide-react";
import {ReadingLink as Link,useReadingPush} from "../../_components/feedback/page-transition";
import {RadioGroup,RadioGroupItem} from "@sohoin/ui/radio-group";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {IconButton} from "@sohoin/ui/icon-button";
import {DropdownMenu,DropdownMenuTrigger} from "@sohoin/ui/dropdown-menu";
import {DropdownMenuContent,DropdownMenuItem} from "@sohoin/ui/dropdown-menu-content";
import {PostComposer} from "../../_components/content/post-composer";
import {communityHref} from "../community/community-route";
import type {SiteView} from "@sohoin/core/server";
import iconStyles from "./feed.module.css";
import styles from "./feed-navigation.module.css";

export type FeedCategory={name:string;slug:string};
export function FeedNavigation({view,categories}:{view:SiteView;categories:FeedCategory[]}){
 const t=useTranslations("Web"),id=useId(),push=useReadingPush();
 const [menuOpen,setMenuOpen]=useState(false);
 return <nav className={styles.navigation} aria-label={t("feedCategories")} data-skeleton-chrome-group="" data-magnetic-area="">
  <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
   <DropdownMenuTrigger asChild><IconButton animation="menu" active={menuOpen} className={styles.menuTrigger} aria-label={t("communityCategories")} data-skeleton-chrome-item=""><MagneticSurface className={styles.menuSurface} maxOffset={5}><Menu size={18} aria-hidden="true"/></MagneticSurface></IconButton></DropdownMenuTrigger>
   <DropdownMenuContent align="start" sideOffset={8} className={styles.categoryMenu} aria-label={t("communityCategories")}>
    <DropdownMenuItem asChild><Link href={communityHref()}>{t("allTopics")}</Link></DropdownMenuItem>
    {categories.map(category=><DropdownMenuItem key={category.slug} asChild><Link href={communityHref({slug:category.slug})}><Hash size={16} aria-hidden="true"/><span>{category.name}</span></Link></DropdownMenuItem>)}
   </DropdownMenuContent>
  </DropdownMenu>
  <RadioGroup value={view} orientation="horizontal" onValueChange={value=>{if(value==="latest"||value==="featured")push(value==="featured"?"/featured":"/",{scroll:false,feedTab:true});}} className={styles.group} aria-label={t("feedCategories")} data-skeleton-chrome-item="">
   {([{value:"latest",label:t("recommended")},{value:"featured",label:t("featured")},{value:"circle",label:t("myCircle")}] as const).map(option=><label key={option.value} className={styles.choice} data-feed-choice="" htmlFor={`${id}-${option.value}`} data-disabled={option.value==="circle"}>
    <RadioGroupItem className={styles.radio} id={`${id}-${option.value}`} value={option.value} disabled={option.value==="circle"} aria-current={view===option.value?"page":undefined}/>
    {option.value==="latest"?<svg className={iconStyles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
     <circle cx="12" cy="12" r="10"/>
     <line className={iconStyles.clockHand} x1="12" x2="12" y1="12" y2="6"/>
     <line className={iconStyles.minuteHand} x1="12" x2="16" y1="12" y2="12"/>
    </svg>:option.value==="featured"?<svg className={iconStyles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
     <path className={iconStyles.sparkle} d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
     <g className={iconStyles.stars}><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></g>
    </svg>:<UsersRound className={iconStyles.icon} aria-hidden="true"/>}
    <span>{option.label}</span>
   </label>)}
  </RadioGroup>
  <noscript className={styles.noScript}><div className={styles.fallback}><Link href="/">{t("recommended")}</Link><Link href="/featured">{t("featured")}</Link></div></noscript>
  <PostComposer className={styles.publish} surfaceClassName={styles.publishSurface}/>
 </nav>;
}
