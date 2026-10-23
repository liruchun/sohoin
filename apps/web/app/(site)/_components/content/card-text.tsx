"use client";
import {useTranslations} from "next-intl";
import {ReadingLink as Link} from "../feedback/reading-navigation";
import {useId,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {Button} from "@sohoin/ui/button";
import styles from "./card-text.module.css";

type Fold={left:number;top:number;height:number};
const graphemes=new Intl.Segmenter(undefined,{granularity:"grapheme"});

/** Read real text lines, then find a grapheme boundary that leaves room for the
 * action. The original server-rendered links and paragraphs remain intact. */
function measureFold(element:HTMLDivElement,action:HTMLSpanElement,truncated:boolean):Fold|null{
 const previous=element.style.cssText;
 element.style.display="block";
 element.style.height="auto";
 element.style.clipPath="none";
 element.style.webkitLineClamp="unset";
 try{
  const box=element.getBoundingClientRect(),style=getComputedStyle(element);
  const limit=Number(getComputedStyle(element.parentElement!).getPropertyValue("--feed-fold-visible"))||4;
  const paragraph=element.querySelector("p")??element;
  const lineHeight=parseFloat(getComputedStyle(paragraph).lineHeight)||parseFloat(style.fontSize)*1.5;
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),range=document.createRange();
  const chars:{node:Text;start:number;end:number;text:string}[]=[],centers:number[]=[];
  while(walker.nextNode()){
   const node=walker.currentNode as Text;
   range.selectNodeContents(node);
   for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;
    const center=(rect.top+rect.bottom)/2;
    if(!centers.some(value=>Math.abs(value-center)<lineHeight/2))centers.push(center);
   }
   for(const part of graphemes.segment(node.data))chars.push({node,start:part.index,end:part.index+part.segment.length,text:part.segment});
  }
  centers.sort((a,b)=>a-b);
  if(!chars.length||!centers.length||(!truncated&&centers.length<=limit))return null;
  const center=centers[Math.min(limit,centers.length)-1];
  const edge=box.right-action.getBoundingClientRect().width-2;
  const rectAt=(index:number)=>{
   const char=chars[index];range.setStart(char.node,char.start);range.setEnd(char.node,char.end);
   return range.getBoundingClientRect();
  };
  let lo=0,hi=chars.length;
  while(lo<hi){
   const mid=(lo+hi)>>>1,rect=rectAt(mid),y=(rect.top+rect.bottom)/2;
   if(y<center-lineHeight/2||(Math.abs(y-center)<lineHeight/2&&rect.right<=edge))lo=mid+1;
   else hi=mid;
  }
  // Remove punctuation/whitespace at the cut so only our ellipsis is visible.
  let end=lo-1;
  while(end>=0&&/^[\s\p{P}]+$/u.test(chars[end].text))end--;
  const last=end>=0?rectAt(end):null;
  const sameLine=last&&Math.abs((last.top+last.bottom)/2-center)<lineHeight/2;
  const left=sameLine?Math.max(0,last.right-box.left):0;
  const top=Math.max(0,center-box.top-lineHeight/2);
  return {left,top,height:top+lineHeight};
 }finally{element.style.cssText=previous;}
}

export function CardText({children,href,truncated}:{children:ReactNode;href:string;truncated:boolean}){
 const t=useTranslations("Web");
 const preview=useRef<HTMLDivElement>(null),action=useRef<HTMLSpanElement>(null),id=useId();
 const [fold,setFold]=useState<Fold|null>(null),[expanded,setExpanded]=useState(false);
 useLayoutEffect(()=>{
  const element=preview.current;
  if(!element||expanded)return;
  const measure=()=>{
   if(element.closest("[inert]")||element.clientWidth===0)return;
   if(!action.current)return;
   const next=measureFold(element,action.current,truncated);
   setFold(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
  };
  measure();
  const observer=new ResizeObserver(measure);observer.observe(element);
  if(action.current)observer.observe(action.current);
  document.fonts?.addEventListener("loadingdone",measure);
  return ()=>{observer.disconnect();document.fonts?.removeEventListener("loadingdone",measure);};
 },[children,expanded,truncated,t]);
 const folded=!expanded&&fold!==null;
 const geometry=folded?{height:fold.height,clipPath:`polygon(0 0,100% 0,100% ${fold.top}px,${fold.left}px ${fold.top}px,${fold.left}px 100%,0 100%)`} satisfies CSSProperties:undefined;
 return <div className={styles.root} data-expanded={expanded}>
  <div ref={preview} id={id} className={styles.preview} data-measured={folded||undefined} style={geometry} data-skeleton-part="body" onClick={event=>{
   const selection=window.getSelection();
   if(selection&&!selection.isCollapsed&&selection.containsNode(event.currentTarget,true))event.preventDefault();
  }}>{children}</div>
  {!expanded&&<span ref={action} className={styles.inlineAction} style={{visibility:folded?"visible":"hidden",left:fold?.left??0,top:fold?.top??0}} aria-hidden={!folded||undefined}><span className={styles.ellipsis} aria-hidden="true">…</span>
   {!truncated?<Button variant="link" className={styles.expand} aria-expanded={false} aria-controls={id} onClick={()=>setExpanded(true)}>{t("expand")}</Button>:
    <Link href={href} className={styles.readMore}>{t("expand")}</Link>}
  </span>}
  {expanded&&<Button variant="link" className={styles.collapse} aria-expanded={true} aria-controls={id} onClick={()=>setExpanded(false)}>{t("collapse")}</Button>}
 </div>;
}
