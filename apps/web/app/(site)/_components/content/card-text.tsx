"use client";
import {useTranslations} from "next-intl";

import {ReadingLink as Link} from "../feedback/page-transition";
import {useId,useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {Button} from "@sohoin/ui/button";
import {preferenceEvent} from "@sohoin/ui/theme-preference";
import styles from "./card-text.module.css";
import {measureRows,observeTextMeasurement,scheduleTextMeasurement,type Fold} from "./card-text-measure";

export function CardText({children,href,truncated}:{children:ReactNode;href:string;truncated:boolean}){
 const t=useTranslations("Web");
 const root=useRef<HTMLDivElement>(null),preview=useRef<HTMLDivElement>(null),id=useId();
 const action=useRef<HTMLSpanElement>(null);
 const [fold,setFold]=useState<Fold|null>(null),[expanded,setExpanded]=useState(false);
 useLayoutEffect(()=>{
  const wrapper=root.current,element=preview.current,body=element?.firstElementChild;
  if(!wrapper||!element||!(body instanceof HTMLElement)||expanded)return;
  let disposed=false,timer=0,cancelMeasure=()=>{};
  const measure=()=>{
   // A retained feed covered by a detail route is inert. Preserve its previous
   // fold measurement until it is visible and has layout boxes again.
   if(disposed||wrapper.closest("[inert]"))return;
   if(element.clientWidth<=0)return;
   const css=getComputedStyle(wrapper),after=parseInt(css.getPropertyValue("--feed-fold-after"),10)||5,visible=parseInt(css.getPropertyValue("--feed-fold-visible"),10)||4;
   const next=measureRows(body,after,visible,action.current?.getBoundingClientRect().width??parseFloat(css.fontSize)*4,truncated);
   return ()=>{if(!disposed)setFold(old=>old?.overflowing===next.overflowing&&old?.height===next.height&&old?.end===next.end&&old?.lineTop===next.lineTop?old:next);};
  };
  const requestMeasure=()=>{cancelMeasure();cancelMeasure=scheduleTextMeasurement(measure);};
  const schedule=()=>{clearTimeout(timer);timer=window.setTimeout(requestMeasure,120);};
  // Settle the fold and its action before paint (and route snapshot capture).
  // The CSS fallback uses the same visible row count; measureRows additionally
  // preserves paragraph gaps and leaves short text unfolded.
  measure()?.();
  // Keep subsequent width/font measurements batched. Folding itself does not
  // request another measurement because the observer only tracks width.
  const observed=typeof ResizeObserver!=="undefined";
  const stopObserving=observed?observeTextMeasurement(element,measure):()=>{};
  if(!observed)window.addEventListener("resize",schedule,{passive:true});
  document.fonts?.addEventListener("loadingdone",schedule);
  window.addEventListener(preferenceEvent,schedule);
  return ()=>{disposed=true;clearTimeout(timer);cancelMeasure();stopObserving();window.removeEventListener("resize",schedule);document.fonts?.removeEventListener("loadingdone",schedule);window.removeEventListener(preferenceEvent,schedule);};
 },[expanded,children,truncated,t]);
 const canExpand=!truncated&&fold?.overflowing;
 const folded=!expanded&&(fold===null||fold.overflowing||truncated);
 return <div ref={root} className={styles.root} data-measured={fold!==null} data-expanded={expanded}>
  <div ref={preview} id={id} className={styles.preview} data-skeleton-part="body" style={expanded||fold?.height==null?undefined:{maxHeight:fold.height,clipPath:fold.end===undefined?undefined:`polygon(0 0,100% 0,100% ${fold.lineTop}px,${fold.end}px ${fold.lineTop}px,${fold.end}px 100%,0 100%)`}} onClick={event=>{
   const selection=window.getSelection();
   if(selection&&!selection.isCollapsed&&selection.containsNode(event.currentTarget,true))event.preventDefault();
  }}>{children}</div>
  {folded&&<span ref={action} className={styles.inlineAction} style={fold?.end===undefined?undefined:{left:fold.end,right:"auto"}}><span aria-hidden="true">…</span>
   {canExpand?<Button variant="link" className={styles.expand} aria-expanded={false} aria-controls={id} onClick={()=>setExpanded(true)}>{t("expand")}</Button>:
    <Link href={href} transitionTypes={["detail-forward"]} className={styles.readMore}>{t("expand")}</Link>}
  </span>}
  {expanded&&<Button variant="link" className={styles.collapse} aria-expanded={true} aria-controls={id} onClick={()=>setExpanded(false)}>{t("collapse")}</Button>}
 </div>;
}
