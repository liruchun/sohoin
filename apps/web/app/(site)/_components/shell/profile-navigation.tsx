"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {useTranslations} from "next-intl";
import {Button} from "@sohoin/ui/button";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {DetailBack} from "../content/detail-panel";
import buttonStyles from "../content/detail-panel.module.css";
import {ReadingLink,useReadingReturn} from "../feedback/reading-navigation";
import {useSiteMedals} from "./site-medals";
import styles from "./profile-navigation.module.css";
import {useProfileHeader} from "./profile-header-context";
import {ProfileFollowButton} from "./profile-follow-button";

export function ProfileNavigation(){
 const t=useTranslations("Web"),pathname=usePathname(),back=useReadingReturn();
 const account=useSiteMedals()?.collection?.user;
 const profile=useProfileHeader();
 const memberPath=pathname.replace(/\/edit\/?$/,"").replace(/\/$/,"");
 const editing=/\/edit\/?$/.test(pathname);
 const name=profile&&memberPath===`/members/${profile.publicId}`?profile.name:"";
 const own=memberPath===`/members/${account?.publicId}`;
 const [canGoBack,setCanGoBack]=useState(false);
 useEffect(()=>{
  // Browser-owned history only; no separate navigation stack.
  const navigation=(window as Window&{navigation?:{canGoBack:boolean}}).navigation;
  setCanGoBack(navigation?.canGoBack??window.history.length>1);
 },[pathname]);
 return <div className={styles.bar} data-has-back={canGoBack||undefined} data-own={own||undefined} data-skeleton-chrome="" data-magnetic-area="">
  {canGoBack&&<div className={styles.back}>
   <DetailBack onClick={back} label={t("back")}/>
  </div>}
  <span className={styles.title} title={name}>{name}</span>
  <div className={styles.action}>
  {!editing&&(own?<Button variant="plain" className={buttonStyles.back} asChild>
   <ReadingLink href={memberPath+"/edit"}><MagneticSurface className={buttonStyles.backSurface}>{t("editProfile")}</MagneticSurface></ReadingLink>
  </Button>:<ProfileFollowButton key={`${memberPath}:${account?.publicId??"guest"}`} publicId={memberPath.split("/").pop()??""} authenticated={!!account}/>)}
  </div>
 </div>;
}
