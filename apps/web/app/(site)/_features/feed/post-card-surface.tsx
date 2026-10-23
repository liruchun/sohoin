"use client";
import {useTranslations} from "next-intl";


import {useRef,type ComponentProps} from "react";
import {ReadingLink,useReadingPush} from "../../_components/feedback/reading-navigation";
import styles from "./post-card.module.css";

const interactive="a,button,input,textarea,select,label,summary,img,picture,video,audio,iframe,[role='button'],[role='link'],[role='menuitem'],[role='slider'],[role='checkbox'],[role='switch'],[contenteditable]:not([contenteditable='false']),[tabindex],[data-magnetic-area],[draggable='true'],[data-card-no-navigation]";

/** Server-rendered card content stays in children; navigation uses the existing Link. */
export function PostCardSurface({href,children,...props}:Omit<ComponentProps<"article">,"onClick">&{href:string}){
 const t=useTranslations("Web");
 const entry=useRef<HTMLAnchorElement>(null);
 const push=useReadingPush();
 return <article {...props} onClick={event=>{
  const target=event.target;
  if(event.defaultPrevented||event.button!==0||!(target instanceof Element)||!event.currentTarget.contains(target))return;
  const control=target.closest(interactive);
  // Focusable page shells outside this card must not block its blank surface.
  if(control&&control!==event.currentTarget&&event.currentTarget.contains(control))return;
  const selection=window.getSelection();
  if(selection&&!selection.isCollapsed&&selection.containsNode(event.currentTarget,true))return;
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey){
   entry.current?.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,altKey:event.altKey}));
   return;
  }
  event.preventDefault();
  push(href);
 }}>
  <ReadingLink ref={entry} href={href} prefetch={false} className={styles.entry}>{t("viewDetails")}</ReadingLink>
  {children}
 </article>;
}
