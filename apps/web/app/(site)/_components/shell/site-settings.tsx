"use client";
import {useLocale,useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {isSiteLocale,localeCookie} from "@/i18n/locale";

import {useEffect,useId,useState,useTransition,type RefObject} from "react";
import {Monitor,Moon,Sun,Languages,Type,Accessibility,Palette,Check} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {ToggleGroup,ToggleGroupItem} from "@sohoin/ui/toggle-group";
import {useThemePreference} from "@sohoin/ui/theme-provider";
import {parsePrimaryColor} from "@sohoin/ui/theme-preference";
import {Switch} from "@sohoin/ui/switch";
import {Select,SelectContent,SelectGroup,SelectItem,SelectTrigger,SelectValue} from "@sohoin/ui/select";
import styles from "./site-settings.module.css";


export function SiteSettings({active,languageMenu,onLanguageOpenChange}:{active:boolean;languageMenu:RefObject<HTMLDivElement|null>;onLanguageOpenChange:(open:boolean)=>void}){
 const t=useTranslations("Web");
 const locale=useLocale(),router=useRouter();
 const [changingLanguage,startLanguageTransition]=useTransition();
 const changeLanguage=(value:string)=>{
  if(!isSiteLocale(value)||value===locale||changingLanguage)return;
  document.cookie=`${localeCookie}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;
  startLanguageTransition(()=>router.refresh());
 };
 const modes=[{value:"system",label:t("system"),icon:Monitor},{value:"light",label:t("light"),icon:Sun},{value:"dark",label:t("dark"),icon:Moon}] as const;
 const colors=[{value:"black",label:t("colorBlack")},{value:"blue",label:t("colorBlue")},{value:"cyan",label:t("colorCyan")},{value:"green",label:t("colorGreen")},{value:"orange",label:t("colorOrange")},{value:"red",label:t("colorRed")}] as const;
 const [languageOpen,setLanguageOpen]=useState(false);
 const changeLanguageOpen=(value:boolean)=>{setLanguageOpen(value);onLanguageOpenChange(value);};
 useEffect(()=>{if(!active)setLanguageOpen(false);},[active]);
 const languageId=useId(),colorId=useId(),sizeId=useId(),motionId=useId();
 const {preference,setPreference,readingSize,setReadingSize,primary,setPrimary,reduceMotion,setReduceMotion,systemReduce}=useThemePreference();
 return <div className={styles.panel}>
   <div className={styles.language}>
    <label id={languageId} htmlFor={`${languageId}-select`} className={styles.languageLabel}><Languages aria-hidden="true"/>{t("language")}</label>
    <Select value={locale} onValueChange={changeLanguage} disabled={changingLanguage} open={languageOpen} onOpenChange={changeLanguageOpen}>
     <SelectTrigger id={`${languageId}-select`} aria-labelledby={languageId} aria-busy={changingLanguage}><SelectValue>{locale==="en"?"English":"简体中文"}</SelectValue></SelectTrigger>
     <SelectContent ref={languageMenu} align="end" onCloseAutoFocus={event=>{if(!active)event.preventDefault();}}>
      <SelectGroup>
       <SelectItem value="zh-CN" lang="zh-CN">简体中文</SelectItem>
       <SelectItem value="en" lang="en">English</SelectItem>
      </SelectGroup>
     </SelectContent>
    </Select>
   </div>
   <ToggleGroup type="single" value={preference} onValueChange={value=>{if(value==="system"||value==="light"||value==="dark")setPreference(value);}} aria-label={t("displayMode")} className={styles.modes}>
    {modes.map(({value,label,icon:Icon})=><ToggleGroupItem key={value} value={value} asChild>
     <Button variant="ghost" className={styles.mode}><Icon aria-hidden="true"/><span>{label}</span></Button>
    </ToggleGroupItem>)}
   </ToggleGroup>
   <fieldset className={styles.section}>
    <legend id={sizeId} className={styles.label}><Type aria-hidden="true"/>{t("fontSize")}<span className={styles.hint}>{t("bodyText")}</span></legend>
    <ToggleGroup type="single" value={readingSize} onValueChange={value=>{if(value==="standard"||value==="large"||value==="largest")setReadingSize(value);}} aria-labelledby={sizeId} className={styles.sizes}>
     {([{value:"standard",label:t("standard")},{value:"large",label:t("large")},{value:"largest",label:t("largest")}] as const).map(({value,label})=><ToggleGroupItem key={value} value={value} asChild><Button variant="ghost" className={styles.size}>{label}</Button></ToggleGroupItem>)}
    </ToggleGroup>
   </fieldset>
   <div className={styles.motion}>
    <label htmlFor={motionId} className={styles.motionLabel}><span className={styles.motionName}><Accessibility aria-hidden="true"/>{t("reduceMotion")}</span><span>{systemReduce?t("systemMotion"):t("lessAnimation")}</span></label>
    <Switch id={motionId} checked={reduceMotion||systemReduce} onCheckedChange={setReduceMotion} disabled={systemReduce}/>
   </div>
   <div className={styles.colorSection}>
    <div id={colorId} className={styles.label}><Palette aria-hidden="true"/>{t("primaryColor")}<span className={styles.hint}>{t("primaryColorHint")}</span></div>
    <ToggleGroup type="single" value={primary} onValueChange={value=>{if(value)setPrimary(parsePrimaryColor(value));}} aria-labelledby={colorId} className={styles.colors}>
     {colors.map(({value,label})=><ToggleGroupItem key={value} value={value} asChild>
      <Button variant="plain" className={styles.color} data-site-primary={value} aria-label={label}>
       <span className={styles.swatch} aria-hidden="true"><Check className={styles.check} strokeWidth={3}/></span>
      </Button>
     </ToggleGroupItem>)}
    </ToggleGroup>
   </div>
 </div>;
}
