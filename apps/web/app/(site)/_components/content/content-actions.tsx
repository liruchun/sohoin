"use client";
import {rememberMentionMember} from "./recent-mention-members";
import {useTranslations} from "next-intl";


import {useReducedMotionPreference} from "@sohoin/ui/theme-provider";
import {ReadingLink as Link} from "../feedback/page-transition";
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type PointerEvent,type MouseEvent} from "react";
import {Button} from "@sohoin/ui/button";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {cn} from "@sohoin/ui/utils";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";
import {AnimatedNumber} from "@sohoin/ui/animated-number";
import {AnimatePresence,motion} from "motion/react";
import {Popover,PopoverContent,PopoverTrigger} from "@sohoin/ui/popover";
import {ContentActionIcon,type ContentActionIconName} from "./content-action-icon";
import styles from "./content-actions.module.css";
import type {SiteInteraction} from "@sohoin/extension-api/interactions";
import {useDiscussionComposer,type DiscussionTarget} from "./discussion-composer-context";
import {discussionCountEvent,type DiscussionCounts} from "../../_features/content/discussion-publication-event";

export type ReactionOption={code:string;label:string;emoji:string;enabled?:boolean};
type ReactionCount=ReactionOption&{count:number};
type ActionError="networkFailed"|"signInRequired"|"tooManyRequests"|"notAllowed"|"actionFailed";
const MotionButton=motion.create(Button);

export function ContentActions({publicId,href,comments,reactions,options,interaction,commentToken,discussion}:{publicId:string;href:string;comments?:number;reactions:ReactionCount[];options:ReactionOption[];interaction?:SiteInteraction;commentToken?:string;discussion?:DiscussionTarget}){
 const t=useTranslations("Web");
 const [commentCount,setCommentCount]=useState({source:comments,value:comments});
 if(commentCount.source!==comments)setCommentCount({source:comments,value:comments});
 useEffect(()=>{
  const update=(event:Event)=>{
   const count=(event as CustomEvent<DiscussionCounts>).detail.find(item=>item.publicId===(discussion?.publicId??publicId));
   if(count)setCommentCount({source:comments,value:count.count});
  };
  window.addEventListener(discussionCountEvent,update);
  return ()=>window.removeEventListener(discussionCountEvent,update);
 },[publicId,discussion?.publicId,comments]);
 const showDiscussion=useDiscussionComposer();
 const {notify,dismiss}=useToast();
 const limitToastId=`reaction-limit:${publicId}:${commentToken??"post"}`;
 const [open,setOpen]=useState(false);
 const [hoveredIcon,setHoveredIcon]=useState<ContentActionIconName|null>(null);
 const [pointerEntry,setPointerEntry]=useState(false);
 const [source,setSource]=useState(interaction);
 const [snapshot,setSnapshot]=useState(interaction);
 const [optimistic,setOptimistic]=useState<SiteInteraction|null>(null);
 const current=optimistic??snapshot;
 const [pending,setPending]=useState(false);
 const [error,setError]=useState<ActionError|null>(null);
 const [needsLogin,setNeedsLogin]=useState(false);
 const writing=useRef(false);
 // A fresh server payload is authoritative; local success stays until then.
 if(source!==interaction){setSource(interaction);setSnapshot(interaction);}
 const hoverEntry=useRef(false);
 const hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function cancelHover(){
  if(hoverTimer.current!==null){clearTimeout(hoverTimer.current);hoverTimer.current=null;}
 }
 useEffect(()=>()=>{if(hoverTimer.current!==null)clearTimeout(hoverTimer.current);},[]);
 function changeOpen(value:boolean){cancelHover();setOpen(value);}
 const trigger=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLDivElement>(null);
 const labels=new Map([...reactions,...options].map(option=>[option.code,option]));
 const displayed:ReactionCount[]=current?current.reactions.flatMap(reaction=>{const label=labels.get(reaction.code);return label?[{code:reaction.code,label:label.label,emoji:label.emoji,count:reaction.count}]:[];}):[...reactions];
 const order=new Map(options.map((option,index)=>[option.code,index]));
 displayed.sort((a,b)=>(order.get(a.code)??options.length)-(order.get(b.code)??options.length));
 const likes=(current?.reactions??reactions).find(reaction=>reaction.code==="like")?.count??0;
 const selected=current?.myReactions??[];
 const hasSelectedReaction=selected.some(code=>code!=="like");
 const bookmarked=current?.bookmarked??false;
 const visibleOptions=options.filter(option=>option.enabled!==false).slice(0,12);
 const columns=Math.max(1,Math.ceil(visibleOptions.length/2));
 function startIcon(name:ContentActionIconName,event:PointerEvent<HTMLElement>){
  if(event.pointerType==="mouse"&&window.matchMedia("(hover: hover) and (pointer: fine)").matches)setHoveredIcon(name);
 }
 function enter(event:PointerEvent<HTMLButtonElement>){
  cancelHover();
  if(open||event.pointerType!=="mouse"||!window.matchMedia("(hover: hover) and (pointer: fine)").matches)return;
  hoverTimer.current=setTimeout(()=>{
   hoverTimer.current=null;hoverEntry.current=true;setPointerEntry(true);setOpen(true);
  },200);
 }
 function leave(event:PointerEvent<HTMLElement>){
  cancelHover();
  if(!hoverEntry.current||event.pointerType!=="mouse")return;
  const target=event.relatedTarget;
  if(target instanceof Node&&(trigger.current?.contains(target)||panel.current?.contains(target)))return;
  hoverTimer.current=setTimeout(()=>{
   hoverTimer.current=null;
   // Keyboard interaction cancels hover ownership; mouse-selected options may close.
   if(!hoverEntry.current)return;
   setOpen(false);
  },300);
 }
 function press(){cancelHover();hoverEntry.current=false;setPointerEntry(false);}
 function openFromClick(event:MouseEvent<HTMLButtonElement>){
  // Radix composes this handler before its toggle; keep this trigger open-only.
  event.preventDefault();
  const mouse=event.detail>0&&window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  hoverEntry.current=mouse;setPointerEntry(mouse);changeOpen(true);
 }
 async function save(action:"reaction"|"bookmark",value:{code:string;active:boolean}|{active:boolean}){
  if(writing.current)return;
  writing.current=true;setPending(true);setError(null);setNeedsLogin(false);
  // Keep the tentative view separate so failure reveals the latest confirmed
  // snapshot, including any server props received while this request is pending.
  const previous:SiteInteraction=snapshot??{publicId,myReactions:[],bookmarked:false,reactions:reactions.map(({code,count})=>({code,count}))};
  if(action==="reaction"&&"code" in value){
   const {code,active}=value,wasSelected=previous.myReactions.includes(code);
   const count=Math.max(0,(previous.reactions.find(item=>item.code===code)?.count??0)+(Number(active)-Number(wasSelected)));
   setOptimistic({...previous,myReactions:active?[...previous.myReactions.filter(item=>item!==code),code]:previous.myReactions.filter(item=>item!==code),reactions:[...previous.reactions.filter(item=>item.code!==code),...(count>0?[{code,count}]:[])]});
  }else if(action==="bookmark")setOptimistic({...previous,bookmarked:value.active});
  try{
   const response=await fetch(`/api/site/interactions/${publicId}/${commentToken?"comments/":""}${action}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(commentToken?{commentToken,value}:value),cache:"no-store"});
   if(!response.ok){
    if(response.status===401){setSnapshot(previous=>previous?{...previous,myReactions:[],bookmarked:false}:undefined);setNeedsLogin(true);}
    setError(response.status===401?"signInRequired":response.status===429?"tooManyRequests":response.status===403?"notAllowed":"actionFailed");
    return;
   }
   const result=await response.json();
   setSnapshot(result as SiteInteraction);
   if(value.active)rememberMentionMember(discussion?.author.publicId);
  }catch(cause){setError(cause instanceof TypeError?"networkFailed":"actionFailed");}
  finally{setOptimistic(null);writing.current=false;setPending(false);}
 }
 function react(code:string){
  if(writing.current)return;
  const active=!selected.includes(code);
  if(active&&selected.length>=5){notify({id:limitToastId,variant:"warning",message:t("reactionLimit")});return;}
  dismiss(limitToastId);
  void save("reaction",{code,active});
 }
 return <footer className={styles.root} data-kind={commentToken?"comment":"post"} aria-label={commentToken?t("discussionActions"):t("postActions")} data-skeleton-part="actions">
  <div className={styles.reactions} data-open={open} data-selected={hasSelectedReaction} data-skeleton-align-start="">
   <Popover open={open} onOpenChange={changeOpen} modal={false}>
    <PopoverTrigger asChild>
     <Button ref={trigger} data-skeleton-shape="" data-skeleton-action="reaction" variant="plain" size="icon-sm" className={cn(styles.action,styles.reactionTrigger)} aria-label={hasSelectedReaction?t("changeReaction"):t("chooseReaction")} onPointerEnter={event=>{startIcon("smile",event);enter(event);}} onPointerLeave={event=>{setHoveredIcon(null);leave(event);}} onPointerDown={press} onKeyDown={press} onClick={openFromClick}>
      <MagneticSurface radius={80} areaSelector="article" className={styles.reactionSurface}><ContentActionIcon name="smile" active={hoveredIcon==="smile"||(open&&pointerEntry)}/></MagneticSurface>
     </Button>
    </PopoverTrigger>
    <PopoverContent ref={panel} side="top" align="start" sideOffset={0} className={styles.popover} aria-label={t("chooseReaction")} data-pointer-entry={pointerEntry} onPointerEnter={cancelHover} onPointerLeave={leave} onKeyDown={press}
     onOpenAutoFocus={event=>{if(hoverEntry.current)event.preventDefault();}}
     onCloseAutoFocus={event=>{if(hoverEntry.current)event.preventDefault();}}>
     <div className={styles.bubble}>
      <div className={styles.choices} style={{gridTemplateColumns:`repeat(${columns}, auto)`}}>
       {visibleOptions.map((option,index)=><Button key={option.code} variant="plain" size="icon-sm" className={styles.choice} style={{"--emoji-enter-delay":`${index%columns*30}ms`,"--emoji-exit-delay":`${(columns-1-index%columns)*15}ms`} as CSSProperties} aria-disabled={pending} aria-pressed={selected.includes(option.code)} aria-label={option.label} title={option.label} onClick={()=>react(option.code)}><span className={styles.emoji} aria-hidden="true">{option.emoji}</span></Button>)}
      </div>
     </div>
    </PopoverContent>
   </Popover>
   <ReactionSummary reactions={displayed.filter(reaction=>reaction.code!=="like"&&reaction.count>0)} options={options} selected={selected} pending={pending} onSelect={react}/>
  </div>
  <div className={styles.tools}>
   <Button asChild data-skeleton-shape="" data-skeleton-action="comment" variant="plain" size="icon-sm" className={styles.action} onPointerEnter={event=>startIcon(commentToken?"reply":"comment",event)} onPointerLeave={()=>setHoveredIcon(null)} onFocus={()=>setHoveredIcon(commentToken?"reply":"comment")} onBlur={()=>setHoveredIcon(null)}><Link href={href} transitionTypes={["detail-forward"]} onClick={event=>{if(discussion&&showDiscussion&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();showDiscussion(discussion,event.currentTarget);}}} aria-label={commentToken?t("reply"):discussion?t("joinDiscussion"):t("viewPostComments",{count:commentCount.value??0})} title={commentToken?t("reply"):t("discussion")}><ContentActionIcon name={commentToken?"reply":"discussion"} active={hoveredIcon===(commentToken?"reply":"comment")}/>{!commentToken&&<span className={styles.actionLabel}>{t("discussion")}</span>}{commentCount.value!==undefined&&(!commentToken||commentCount.value>0)&&<AnimatedNumber value={commentCount.value} hideZero/>}</Link></Button>
   <Button data-skeleton-shape="" data-skeleton-action="like" variant="plain" size="icon-sm" className={styles.action} disabled={!options.some(option=>option.code==="like"&&option.enabled!==false)&&!selected.includes("like")} aria-disabled={pending||(!options.some(option=>option.code==="like"&&option.enabled!==false)&&!selected.includes("like"))} aria-pressed={selected.includes("like")} aria-label={t("likeCount",{action:selected.includes("like")?t("unlike"):t("like"),count:likes})} title={selected.includes("like")?t("unlike"):t("like")} onClick={()=>react("like")} onPointerEnter={event=>startIcon("heart",event)} onPointerLeave={()=>setHoveredIcon(null)}><ContentActionIcon name="heart" active={hoveredIcon==="heart"}/><span className={styles.actionLabel}>{t("likes")}</span><AnimatedNumber value={likes} hideZero/></Button>
   <Button data-skeleton-shape="" data-skeleton-action="bookmark" variant="plain" size="icon-sm" className={styles.action} aria-disabled={pending} aria-pressed={bookmarked} aria-label={bookmarked?t("unbookmark"):t("bookmark")} title={bookmarked?t("unbookmark"):t("bookmark")} onClick={()=>{void save("bookmark",{active:!bookmarked});}} onPointerEnter={event=>startIcon("bookmark",event)} onPointerLeave={()=>setHoveredIcon(null)}><ContentActionIcon name="bookmark" active={hoveredIcon==="bookmark"}/></Button>
  </div>
  {error&&<Alert statusLabel={t(needsLogin?"warning":"error")} className={styles.feedback} variant={needsLogin?"warning":"error"}>{t(error)}{needsLogin&&<> · <Link href="/admin/login">{t("login")}</Link></>}</Alert>}
 </footer>;
}

/** Measure existing buttons, including visually hidden overflow; no duplicate measurement tree. */
function ReactionSummary({reactions,options,selected,pending,onSelect}:{reactions:ReactionCount[];options:ReactionOption[];selected:string[];pending:boolean;onSelect:(code:string)=>void}){
 const t=useTranslations("Web");
 const reduce=useReducedMotionPreference();
 const container=useRef<HTMLDivElement>(null);
 const more=useRef<HTMLButtonElement>(null);
 const [visible,setVisible]=useState(0);
 const [expanded,setExpanded]=useState(false);
 const signature=reactions.map(({code,count})=>`${code}:${count}`).join("|");
 useLayoutEffect(()=>{
  const element=container.current,overflow=more.current;
  if(!element||!overflow)return;
  const currentCodes=new Set(signature.split("|").map(value=>value.split(":")[0]));
  const buttons=Array.from(element.querySelectorAll<HTMLButtonElement>("[data-reaction-count]")).filter(button=>currentCodes.has(button.dataset.reactionCount!));
  function measure(){
   // A covered feed has no layout boxes. Zero widths are not a new fit:
   // keep its last visible state instead of expanding every retained row.
   if(element!.closest("[inert]"))return;
   const available=element!.clientWidth;
   if(available<=0)return;
   const gap=parseFloat(getComputedStyle(element!).columnGap)||0;
   // Bubble scale / layout projection must not change the overflow calculation.
   const widths=buttons.map(button=>button.offsetWidth);
   const total=widths.reduce((sum,width)=>sum+width,0)+gap*Math.max(0,widths.length-1);
   if(total<=available&&!expanded){setVisible(widths.length);return;}
   let used=overflow!.offsetWidth,fit=0;
   for(const width of widths){if(used+gap+width>available)break;used+=gap+width;fit++;}
   setVisible(fit);
  }
  // The observer supplies an initial notification after layout; measuring here
  // as well synchronously re-renders all reaction rows during hydration.
  const observer=new ResizeObserver(measure);
  observer.observe(element);observer.observe(overflow);
  buttons.forEach(button=>observer.observe(button));
  return ()=>observer.disconnect();
 },[signature,expanded]);
 const hidden=Math.max(0,reactions.length-visible);
 function countButton(reaction:ReactionCount,index:number,inPanel=false){
  const collapsed=!inPanel&&index>=visible;
  const unavailable=!options.some(option=>option.code===reaction.code&&option.enabled!==false)&&!selected.includes(reaction.code);
  return <MotionButton key={reaction.code} variant="plain" size="sm" className={styles.count}
   layout={reduce||inPanel||collapsed?false:"position"}
   // Overflow measurement is layout setup, not a reaction change. Animating it
   // projects hidden absolute boxes into the row and pollutes skeleton bounds.
   layoutDependency={signature}
   initial={reduce||inPanel?false:{opacity:0,scale:.75}}
   animate={{opacity:unavailable ? .5 : 1,scale:1}}
   exit={{opacity:0,scale:reduce?1:.75,pointerEvents:"none",transition:{duration:reduce?0:.16,ease:[0,0,.2,1]}}}
   transition={{
    opacity:{duration:reduce?0:.16,ease:[0,0,.2,1]},
    scale:{type:"spring",duration:reduce?0:.34,bounce:.22},
    layout:{type:"spring",duration:reduce?0:.34,bounce:.12},
   }}
   data-skeleton-shape={!inPanel&&!collapsed?"":undefined}
   data-reaction-count={inPanel?undefined:reaction.code} data-overflow={collapsed||undefined} inert={collapsed}
   aria-hidden={collapsed||undefined} tabIndex={collapsed?-1:undefined}
   disabled={unavailable} aria-disabled={pending||unavailable}
   aria-pressed={selected.includes(reaction.code)} aria-label={`${reaction.label} ${reaction.count}`} onClick={()=>onSelect(reaction.code)}>
   <span className={styles.emoji} aria-hidden="true">{reaction.emoji}</span><AnimatedNumber value={reaction.count}/>
  </MotionButton>;
 }
 return <div ref={container} className={styles.summary}>
  <AnimatePresence initial={false} mode="popLayout">{reactions.map((reaction,index)=>countButton(reaction,index))}</AnimatePresence>
  {/* Empty counts need no overflow trigger or Popover lifecycle. Keep an open
      panel mounted if its last reaction disappears, and keep exit items above. */}
  {(reactions.length>0||expanded)&&<Popover open={expanded} onOpenChange={setExpanded}>
   <PopoverTrigger asChild>
    <Button ref={more} data-skeleton-shape={hidden>0||expanded?"":undefined} variant="plain" size="sm" className={`${styles.count} ${styles.more}`}
     style={{minWidth:`calc(${String(reactions.length).length+1}ch + 1rem + .125rem)`}}
     data-overflow={hidden===0&&!expanded||undefined} inert={hidden===0&&!expanded}
     aria-hidden={hidden===0&&!expanded||undefined} tabIndex={hidden===0&&!expanded?-1:undefined}
     aria-label={hidden?t("hiddenReactions",{count:hidden}):t("viewAllReactions")}>
     {hidden?`+${hidden}`:"…"}
    </Button>
   </PopoverTrigger>
   <PopoverContent side="top" align="start" className={styles.popover} aria-label={t("allReactions")}>
    <div className={`${styles.bubble} ${styles.overflowChoices}`}>{reactions.map((reaction,index)=>countButton(reaction,index,true))}</div>
   </PopoverContent>
  </Popover>}
 </div>;
}
