"use client";
import {rememberMentionMember} from "./recent-mention-members";
import {useTranslations} from "next-intl";


import {useCallback,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type MouseEvent,type ReactNode} from "react";
import {useRouter} from 'next/navigation';
import {ArrowRight,ArrowUp,AtSign,GalleryVerticalEnd,Link,Quote,X} from "lucide-react";
import {Tooltip,TooltipProvider} from '@sohoin/ui/tooltip';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectGroup,SelectItem} from '@sohoin/ui/select';
import {useToast} from '@sohoin/ui/toast';
import {attachmentPayload,restoreAttachments,type ComposerAttachment} from './composer-attachments';
import type {LinkCard} from '@sohoin/extension-api/link-preview';
import {ComposerMedia} from './composer-media';
import {useDetailData} from '../../_features/content/detail-data';
import type {LocalMedia} from '../../_features/media/media-library';
import {Button} from "@sohoin/ui/button";
import {ScrollArea} from "@sohoin/ui/scroll-area";
import {Dialog,DialogTrigger} from "@sohoin/ui/dialog";
import {DialogClose,DialogContent,DialogTitle} from "@sohoin/ui/dialog-content";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {MentionTextarea,type MentionEditorHandle} from "./mention-textarea";
import styles from "./post-composer.module.css";
import {AuthorAvatar} from "./author-avatar";
import {ReadingLink} from "../feedback/page-transition";
import type {DiscussionTarget} from "./discussion-composer-context";
import {DiscussionPreview,type ReplyTarget} from "./discussion-preview";
import {beginFeedPublication} from "../../_features/feed/feed-publication-event";
import {beginDiscussionPublication} from "../../_features/content/discussion-publication-event";



/** One composer for new posts and contextual replies; server checks all permissions. */
export type EditablePublication={body:string;version:number;category?:string;media?:LocalMedia[];links?:(LinkCard&{coverUrl?:string})[]};
export function PostComposer({className,surfaceClassName,discussion,anchor,controlledOpen,onOpenChange,editing}:{className?:string;surfaceClassName?:string;discussion?:DiscussionTarget;anchor?:HTMLElement;controlledOpen?:boolean;onOpenChange?:(open:boolean)=>void;editing?:{publicId:string;type:'post'|'comment';value:EditablePublication;onSaved:()=>void}}){
 const t=useTranslations("Web");
 const p=useTranslations('Publishing'),router=useRouter(),{notify}=useToast();
 const {invalidate}=useDetailData();
 const [categories,setCategories]=useState<{slug:string;name:string}[]>([]),[category,setCategory]=useState(editing?.value.category??'');
 const [media,setMedia]=useState<ComposerAttachment[]>(()=>restoreAttachments(editing?.value.media,editing?.value.links)),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[login,setLogin]=useState(false),[attempt,setAttempt]=useState(0),[discard,setDiscard]=useState(false);
 const writing=useRef(false),submission=useRef<{payload:string;id:string}|null>(null);
 const navigation=useRef<string|null>(null);
 const [localOpen,setOpen]=useState(false),[text,setText]=useState(editing?.value.body??'');
 const isReply=!!discussion||editing?.type==='comment';
 const dirty=editing?text!==editing.value.body||category!==(editing.value.category??'')||JSON.stringify(attachmentPayload(media))!==JSON.stringify(attachmentPayload(restoreAttachments(editing.value.media,editing.value.links))):!!text.trim()||media.length>0;
 const open=controlledOpen??localOpen;
 const [replyTo,setReplyTo]=useState<ReplyTarget|null>(null);
 const [height,setHeight]=useState(0);
 const [contentHeight,setContentHeight]=useState(0);
 const [bounds,setBounds]=useState({left:0,width:0,min:0,max:0});
 const trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLTextAreaElement>(null);
 const mentionEditor=useRef<MentionEditorHandle>(null);
 const panelRef=useRef<HTMLDivElement>(null);
 const drag=useRef<{pointer:number;y:number;height:number}|null>(null);

 const commitOpen=useCallback((next:boolean)=>{
  const panel=panelRef.current;
  // Reverse from the displayed position, including an unfinished entrance/exit.
  // Radix still owns mounting, dismissal and focus restoration.
  if(panel)panel.style.setProperty("--composer-from",getComputedStyle(panel).transform);
  setOpen(next);
  onOpenChange?.(next);
 },[onOpenChange]);
 const changeOpen=useCallback((next:boolean)=>{
  if(writing.current||uploading)return;
  if(!next&&dirty){setDiscard(true);return;}
  commitOpen(next);
 },[commitOpen,dirty,uploading]);
 function navigate(event:MouseEvent<HTMLAnchorElement>){
  if(writing.current||uploading){event.preventDefault();return;}
  if(dirty){event.preventDefault();navigation.current=event.currentTarget.getAttribute('href');setDiscard(true);return;}
  commitOpen(false);
 }
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();setReady(false);setError('');setLogin(false);
  fetch('/api/v1/account/publications',{cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json();if(controller.signal.aborted)return;
   if(!response.ok){setLogin(response.status===401);throw new Error(data.error?.message||p('failed'));}
   setCategories(data.categories);setReady(true);
  }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:p('failed'));});
  return ()=>controller.abort();
 },[open,attempt,p]);
 useEffect(()=>{
  if(!error)return;
  notify({variant:'error',anchor:panelRef.current,message:error,...(login?{action:{label:t('login'),href:'/admin/login'}}:!ready?{action:{label:t('retry'),onClick:()=>setAttempt(value=>value+1)}}:{})});
  setError('');
 },[error,login,ready,notify,t]);
 async function publish(){
  if(writing.current||uploading||!ready||!text.trim()||(!isReply&&!category))return;
  writing.current=true;setBusy(true);setError('');
  const payload=discussion?{kind:'comment',body:text.trim(),...attachmentPayload(media),target:{type:discussion.type,publicId:discussion.publicId},...(replyTo?{replyTo:replyTo.publicId}:{})}:{kind:'post',body:text.trim(),category,...attachmentPayload(media)};
  const signature=JSON.stringify(payload);
  if(submission.current?.payload!==signature)submission.current={payload:signature,id:crypto.randomUUID()};
  const completeFeed=!editing&&!discussion?beginFeedPublication():undefined;
  const commentPublication=!editing&&discussion?beginDiscussionPublication(replyTo?.publicId??discussion.publicId):undefined;
  try{
   const response=await fetch(editing?`/api/v1/account/publications/${editing.type}/${editing.publicId}`:'/api/v1/account/publications',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(editing?{version:editing.value.version,value:{body:text.trim(),...attachmentPayload(media),...(!isReply?{category}:{})}}:{...payload,requestId:submission.current.id})});
   const data=await response.json();if(!response.ok){setLogin(response.status===401);throw new Error(data.error?.message||p('failed'));}
   if(discussion){rememberMentionMember(discussion.author.publicId);rememberMentionMember(replyTo?.authorPublicId);}
   completeFeed?.(data.publicId);
   commentPublication?.complete(data.publicId);
   setText('');setMedia([]);setReplyTo(null);submission.current=null;commitOpen(false);
   notify({variant:'success',message:p(editing?'saved':discussion?'replied':'published'),...(!editing?{action:{label:p('view'),href:data.href}}:{})});
   editing?.onSaved();
   if(!commentPublication?.handled){invalidate();router.refresh();}
  }catch(error){completeFeed?.(null);commentPublication?.complete(null);setError(error instanceof Error?error.message:p('failed'));}
  finally{writing.current=false;setBusy(false);}
 }

 const fitInput=useCallback(()=>{
  const field=input.current;
  const editor=field?.closest<HTMLElement>('[data-composer-editor]');
  const panel=field?.closest<HTMLElement>("[data-slot=dialog-content]");
  if(!field||!editor||!panel)return;
  // Measure natural text height, including wrapped lines and pasted content.
  // Reset first so deleting text can shrink the field and panel again.
  const viewport=field.closest<HTMLElement>('[data-slot=scroll-area-viewport]');
  const scrollTop=viewport?.scrollTop??0;
  field.style.overflowY="hidden";
  field.style.height="0px";
  const naturalHeight=field.scrollHeight;
  field.style.height=`${naturalHeight}px`;
  if(viewport)viewport.scrollTop=scrollTop;
  const style=getComputedStyle(editor);
  const chrome=panel.clientHeight-editor.clientHeight+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
  setContentHeight(naturalHeight+chrome);
 },[]);

 useLayoutEffect(()=>{
  if(!open){drag.current=null;return;}
  // Measure the actual reading column, including intercepted detail pages.
  const column=(anchor??trigger.current)?.closest("main")??document.getElementById("site-content");
  if(!column)return;
  const measure=()=>{
   const rect=column.getBoundingClientRect();
   const rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
   const max=Math.max(0,(window.visualViewport?.height??window.innerHeight)*.9);
   const min=Math.min(18*rem,max);
   setBounds({left:rect.left,width:rect.width,min,max});
   setHeight(previous=>Math.min(max,Math.max(min,previous||(discussion?40:28)*rem)));
  };
  measure();
  const observer=new ResizeObserver(measure);observer.observe(column);
  window.addEventListener("resize",measure);
  window.visualViewport?.addEventListener("resize",measure);
  return ()=>{observer.disconnect();window.removeEventListener("resize",measure);window.visualViewport?.removeEventListener("resize",measure);};
 },[open,anchor,discussion]);

 useLayoutEffect(()=>{
  if(open)fitInput();
 },[open,text,replyTo,media.length,ready,bounds.width,bounds.max,height,fitInput]);

 const visibleHeight=Math.min(bounds.max,Math.max(height,contentHeight));
 const resize=(value:number)=>setHeight(Math.min(bounds.max,Math.max(bounds.min,value)));
 const geometry={"--composer-left":`${bounds.left}px`,"--composer-width":`${bounds.width}px`,"--composer-height":`${visibleHeight}px`} as CSSProperties;
 // The editor's leftover space belongs to the composer: clicking it should place
 // the caret, not leave focus on the document. Controls and text selections keep
 // their own behavior.
 const focusBlankArea=useCallback((event:MouseEvent<HTMLFormElement>)=>{
  const target=event.target;
  if(!(target instanceof Element)||target.closest("a,button,input,textarea,select,summary,label,video,[role='button'],[role='link'],[role='separator'],[contenteditable='true']"))return;
  if(window.getSelection()?.toString())return;
  const field=input.current;
  if(!field)return;
  const hadFocus=document.activeElement===field;
  field.focus({preventScroll:true});
  if(!hadFocus)field.setSelectionRange(field.value.length,field.value.length);
 },[]);

 const tool=(label:string,Icon:typeof AtSign)=><Tooltip key={label} label={label}><Button variant="ghost" size="icon" aria-label={label} aria-disabled="true"><Icon aria-hidden="true"/></Button></Tooltip>;
 const footer=(mediaButton:ReactNode,attachments:ReactNode=null,linkButton:ReactNode=tool(t('addLink'),Link))=><>
  {attachments}
  <div className={styles.footer}>
   <div className={styles.tools}>
    <Tooltip label={t('mentionUser')}><Button variant="ghost" size="icon" disabled={busy||uploading||!ready} aria-label={t('mentionUser')} onClick={()=>mentionEditor.current?.insert()}><AtSign aria-hidden="true"/></Button></Tooltip>
    {mediaButton}
    {linkButton}
    {tool(t('quote'),Quote)}
   </div>
   <Button type="submit" disabled={busy||uploading||!ready||!text.trim()||(!isReply&&!category)} variant="plain" className={styles.submit}><MagneticSurface className={styles.submitSurface} maxOffset={6}><ArrowUp className={styles.submitArrow} aria-hidden="true"/>{busy?p('sending'):editing?p('save'):discussion?t("reply"):t("publish")}</MagneticSurface></Button>
  </div>
 </>;
 return <TooltipProvider delayDuration={300}><Dialog open={open} onOpenChange={changeOpen}>
  {!discussion&&!editing&&<DialogTrigger asChild>
   <Button data-skeleton-chrome-item="" ref={trigger} variant="plain" size="sm" className={className}><MagneticSurface className={surfaceClassName}>{t("newPost")}</MagneticSurface></Button>
  </DialogTrigger>}
  <DialogContent ref={panelRef} className={styles.panel} style={geometry} overlayClassName={styles.overlay} showCloseButton={false} aria-describedby={undefined}
   onEscapeKeyDown={event=>{if(mentionEditor.current?.isOpen()){event.preventDefault();mentionEditor.current.close();}}}
   onCloseAutoFocus={event=>{if(anchor){event.preventDefault();if(anchor.isConnected)anchor.focus({preventScroll:true});}}}
   onOpenAutoFocus={event=>{event.preventDefault();fitInput();input.current?.focus({preventScroll:true});}}>
   {!isReply&&<DialogTitle className="sr-only">{editing?p('edit'):t("publishPost")}</DialogTitle>}
   <form className={styles.form} aria-busy={busy||uploading} onClick={focusBlankArea} onSubmit={event=>{event.preventDefault();void publish();}}>
    <div className={styles.header}>
     {isReply?<DialogTitle className={styles.discussionTitle}>{editing?p('edit'):t("joinDiscussion")}</DialogTitle>:<Select value={category} onValueChange={setCategory} disabled={!ready||busy}><SelectTrigger className={styles.category} aria-label={t('chooseCategory')}><SelectValue placeholder={t('chooseCategory')}/></SelectTrigger><SelectContent><SelectGroup>{categories.map(item=><SelectItem key={item.slug} value={item.slug}>{item.name}</SelectItem>)}</SelectGroup></SelectContent></Select>}
     <DialogClose asChild><Button variant="plain" size="icon" className={styles.close} aria-label={discussion?t("closeDiscussionForm"):t("closePostForm")}><MagneticSurface className={styles.closeSurface} maxOffset={5}><X aria-hidden="true"/></MagneticSurface></Button></DialogClose>
    </div>
    {discussion&&<div className={styles.context}><AuthorAvatar src={discussion.author.avatar} name={discussion.author.name} publicId={discussion.author.publicId} wornBadge={discussion.author.wornBadge}/><div className={styles.previewBody}><div className={styles.contextHeading}><strong>{discussion.author.name}</strong><ReadingLink href={discussion.href} onClick={navigate} className={styles.originalLink}>{t("originalPost")}<ArrowRight className={styles.linkArrow} aria-hidden="true"/></ReadingLink></div><p>{discussion.excerpt}</p></div></div>}
    {replyTo&&<div className={styles.replyTarget}>{t("replyTo",{name:replyTo.authorName})}<Button disabled={busy} variant="plain" size="icon-sm" aria-label={t("cancelReplyTarget")} onClick={()=>setReplyTo(null)}><X aria-hidden="true"/></Button></div>}
    <div className={styles.editor} data-composer-editor="">
     <ScrollArea className={styles.editorScroll} type="hover" scrollHideDelay={150}>
     <MentionTextarea ref={mentionEditor} inputRef={input} portalRef={panelRef} disabled={busy} label={discussion?t("replyContent"):t("postContent")} placeholder={discussion?t("shareThoughts"):t("whatsNew")} className={styles.input} value={text} onChange={setText}/>
     </ScrollArea>
    </div>

    {open&&ready?<ComposerMedia dialogStyle={geometry} items={media} onChange={setMedia} disabled={busy} onBusyChange={setUploading}>{footer}</ComposerMedia>:footer(tool(t('addMedia'),GalleryVerticalEnd))}
   </form>
   {discussion&&<DiscussionPreview target={discussion} onNavigate={navigate} onReply={reply=>{if(writing.current)return;setReplyTo(reply);input.current?.focus({preventScroll:true});}}/>}
   <div className={styles.resize} role="separator" tabIndex={0} aria-label={discussion?t("resizeDiscussion"):t("resizePost")} aria-orientation="horizontal"
    aria-valuemin={Math.round(bounds.min)} aria-valuemax={Math.round(bounds.max)} aria-valuenow={Math.round(visibleHeight)} aria-valuetext={t("pixels",{count:Math.round(visibleHeight)})}
    onPointerDown={event=>{
     if(event.button!==0)return;
     event.preventDefault();event.currentTarget.focus({preventScroll:true});
     drag.current={pointer:event.pointerId,y:event.clientY,height:visibleHeight};event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event=>{const start=drag.current;if(start?.pointer===event.pointerId)resize(start.height+event.clientY-start.y);}}
    onPointerUp={event=>{if(drag.current?.pointer===event.pointerId){drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId);}}}
    onPointerCancel={()=>{drag.current=null;}}
    onLostPointerCapture={()=>{drag.current=null;}}
    onKeyDown={event=>{
     if(!["ArrowUp","ArrowDown","Home","End"].includes(event.key))return;
     event.preventDefault();
     const step=parseFloat(getComputedStyle(document.documentElement).fontSize)*(event.shiftKey?4:1);
     resize(event.key==="Home"?bounds.min:event.key==="End"?bounds.max:visibleHeight+(event.key==="ArrowDown"?step:-step));
    }}><span/></div>
  </DialogContent>
 </Dialog><Dialog open={discard} onOpenChange={next=>{setDiscard(next);if(!next)navigation.current=null;}}><DialogContent className={styles.discard} style={geometry} aria-describedby={undefined}><DialogTitle>{p('discardTitle')}</DialogTitle><p>{p('discardBody')}</p><div className={styles.confirmActions}><Button variant="outline" onClick={()=>{setDiscard(false);navigation.current=null;}}>{p('keepEditing')}</Button><Button onClick={()=>{setText('');setMedia([]);setReplyTo(null);submission.current=null;setDiscard(false);commitOpen(false);const href=navigation.current;navigation.current=null;if(href&&/^\/(?!\/)/.test(href))router.push(href);}}>{p('discard')}</Button></div></DialogContent></Dialog></TooltipProvider>;
}
