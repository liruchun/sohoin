"use client";
import {useTranslations} from "next-intl";


import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type CSSProperties} from "react";
import {Toast as Primitive} from "radix-ui";
import {Check,X} from "lucide-react";
import {FeedbackIcon,FeedbackLabel,type FeedbackVariant} from "./feedback";
import styles from "./toast.module.css";

type ToastInput={message:string;anchor?:HTMLElement|null;variant?:FeedbackVariant;id?:string;action?:{label:string;href:string;onClick?:never}|{label:string;onClick:()=>void;href?:never}};
type ToastEntry=ToastInput&{variant:FeedbackVariant;id:string;sequence:number;open:boolean};
type ToastApi={notify:(input:ToastInput)=>void;dismiss:(id?:string)=>void};
const ToastContext=createContext<ToastApi|null>(null);

export function ToastProvider({children}:{children:ReactNode}){
 const t=useTranslations("UI");
 const [entry,setEntry]=useState<ToastEntry|null>(null);
 const sequence=useRef(0);
 const [position,setPosition]=useState<CSSProperties>();
 useLayoutEffect(()=>{
  const anchor=entry?.anchor;
  if(!anchor||!entry?.open){if(!anchor)setPosition(undefined);return;}
  const measure=()=>{
   if(!anchor.isConnected){setPosition(undefined);return;}
   const rect=anchor.getBoundingClientRect();
   const rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
   setPosition({left:rect.left+rect.width/2,maxWidth:Math.max(0,Math.min(24*rem,rect.width-2*rem))});
  };
  measure();
  const observer=new ResizeObserver(measure);observer.observe(anchor);
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return ()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[entry?.anchor,entry?.open]);
 const notify=useCallback((input:ToastInput)=>{
  const variant=input.variant??"info",id=input.id??`${variant}:${input.message}`,next=++sequence.current;
  setEntry(current=>current?.open&&current.id===id&&current.message===input.message&&current.variant===variant&&current.anchor===input.anchor?current:{...input,id,variant,sequence:next,open:true});
 },[]);
 const dismiss=useCallback((id?:string)=>setEntry(current=>current&&(!id||current.id===id)?{...current,open:false}:current),[]);
 const api=useMemo(()=>({notify,dismiss}),[notify,dismiss]);
 return <ToastContext.Provider value={api}><Primitive.Provider label={t("notice")} duration={3000} swipeDirection="right">
  {children}
  {entry&&<Primitive.Root key={entry.sequence} open={entry.open} onOpenChange={open=>setEntry(current=>current?.sequence===entry.sequence?{...current,open}:current)} duration={entry.variant==="loading"?Infinity:undefined} type="background" data-variant={entry.variant} className={styles.root}>
   {entry.variant==="success"?<Check size="1rem" aria-hidden="true"/>:<FeedbackIcon variant={entry.variant}/>}
   <Primitive.Description className={styles.message}><FeedbackLabel variant={entry.variant} label={t(({default:"notice",info:"notice",success:"success",warning:"warning",error:"error",loading:"processing"} as const)[entry.variant])}/>{entry.message}</Primitive.Description>
   {entry.action&&(entry.action.onClick||entry.action.href&&/^\/(?!\/)/.test(entry.action.href))&&<Primitive.Action asChild altText={entry.action.label}>{entry.action.onClick?<button type="button" onClick={entry.action.onClick} className={styles.action}>{entry.action.label}</button>:<a href={entry.action.href} className={styles.action}>{entry.action.label}</a>}</Primitive.Action>}
   <Primitive.Close className={styles.close} aria-label={t("closeNotice")}><X aria-hidden="true"/></Primitive.Close>
  </Primitive.Root>}
  <div className={styles.host} style={position}><Primitive.Viewport className={styles.viewport} label={t("notificationShortcut")}/></div>
 </Primitive.Provider></ToastContext.Provider>;
}
export function useToast(){const api=useContext(ToastContext);if(!api)throw new Error("useToast must be used within ToastProvider");return api;}
