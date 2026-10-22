"use client";
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {useTranslations} from 'next-intl';
import {publicLinkUrl,type LinkPreview} from '@sohoin/extension-api/link-preview';
import {Dialog} from '@sohoin/ui/dialog';
import {DialogClose,DialogContent,DialogTitle} from '@sohoin/ui/dialog-content';
import {MagneticSurface} from '@sohoin/ui/magnetic-surface';
import {X} from 'lucide-react';
import {InputGroup,InputGroupAddon,InputGroupInput} from '@sohoin/ui/input-group';
import {Button} from '@sohoin/ui/button';
import {useToast} from '@sohoin/ui/toast';
import {cn} from '@sohoin/ui/utils';
import {MediaLibraryProvider} from '../../_features/media/media-library';
import {MediaPickerDialog} from '../../_features/media/media-picker-dialog';
import {LinkCardContent} from './link-card';
import type {ComposerLink} from './composer-attachments';
import styles from './link-card.module.css';
import mediaStyles from '../../_features/media/media-picker.module.css';

export function ComposerLinkDialog({initial,onClose,onInsert,dialogStyle,onBusyChange,onCloseFocus,error,onErrorHandled}:{initial?:ComposerLink;onClose:()=>void;onInsert:(link:ComposerLink)=>void;dialogStyle?:CSSProperties;onBusyChange:(busy:boolean)=>void;onCloseFocus:()=>void;error:string;onErrorHandled:()=>void}){
 const t=useTranslations('LinkPreview'),ui=useTranslations('UI'),id=useId();
 const {notify,dismiss}=useToast(),panel=useRef<HTMLDivElement>(null),noticeId='link-preview:'+id;
 const [scheme,setScheme]=useState(initial?.url.startsWith('http://')?'http://':'https://');
 const [url,setUrl]=useState(initial?.url.replace(/^(?:https?:\/\/)+/i,'')??''),[title,setTitle]=useState(initial?.title??''),[image,setImage]=useState(initial?.image??''),[icon,setIcon]=useState(initial?.icon??'');
 const [cover,setCover]=useState<{id:string;url:string}|undefined>(initial?.coverMediaId?{id:initial.coverMediaId,url:initial.coverUrl??''}:undefined);
 const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[picker,setPicker]=useState(false),[attempt,setAttempt]=useState(0);
 const coverButton=useRef<HTMLButtonElement>(null),edited=useRef(false),original=useRef(true);
 const normalized=url.trim()?publicLinkUrl(scheme+url.trim()):null;
 useEffect(()=>{
  if(error){notify({id:noticeId,variant:'error',anchor:panel.current,message:error});onErrorHandled();}
 },[error,notify,noticeId,onErrorHandled]);
 useEffect(()=>()=>dismiss(noticeId),[dismiss,noticeId]);
 useEffect(()=>{
  if(!normalized||original.current&&initial?.url===normalized&&attempt===0)return;
  const controller=new AbortController();setBusy(true);
  const timer=setTimeout(()=>{
   notify({id:noticeId,variant:'loading',anchor:panel.current,message:t('loading')});
   fetch('/api/v1/account/link-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:normalized}),signal:controller.signal}).then(async response=>{
    const data=await response.json();if(!response.ok)throw new Error(data.error?.message||t('failed'));
    if(controller.signal.aborted)return;
    const result=data as LinkPreview;
    if(!edited.current)setTitle(result.title);setImage(result.image);setIcon(result.icon);
    if(result.source==='manual')notify({id:noticeId,variant:'warning',anchor:panel.current,message:t('failed')});
    else dismiss(noticeId);
   }).catch(error=>{if(!controller.signal.aborted)notify({id:noticeId,variant:'error',anchor:panel.current,message:error instanceof Error?error.message:t('failed')});})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  },500);
  return ()=>{clearTimeout(timer);controller.abort();dismiss(noticeId);};
 },[normalized,attempt,initial?.url,t,notify,dismiss,noticeId]);
 function changeUrl(value:string){
  const trimmed=value.trim(),prefix=trimmed.match(/^https?:\/\//i)?.[0];
  const nextScheme=prefix?.toLowerCase()??scheme,nextUrl=trimmed.replace(/^(?:https?:\/\/)+/i,'');
  if(nextScheme===scheme&&nextUrl===url)return;
  dismiss(noticeId);original.current=false;setScheme(nextScheme);setUrl(nextUrl);setTitle('');setImage('');setIcon('');setCover(undefined);setBusy(false);edited.current=false;
 }
 function insert(){
  if(!normalized||busy||uploading)return;
  onInsert({id:initial?.id??'link:'+crypto.randomUUID(),kind:'link',url:normalized,title:title.trim()||new URL(normalized).hostname,image,icon,...(cover?{coverMediaId:cover.id,coverUrl:cover.url}:{})});
 }
 return <Dialog open onOpenChange={next=>{if(!next&&!uploading)onClose();}}><DialogContent ref={panel} showCloseButton={false} className={cn(mediaStyles.aligned,styles.dialog)} style={{...dialogStyle,height:'auto',minHeight:dialogStyle?'var(--composer-height)':'0rem'}} data-aligned={!!dialogStyle||undefined} aria-describedby={undefined}
  onCloseAutoFocus={event=>{event.preventDefault();onCloseFocus();}}
  onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Enter'&&!picker&&event.target instanceof HTMLInputElement){event.preventDefault();event.stopPropagation();insert();}}}>
  <div className={mediaStyles.header} data-magnetic-area="">
   <DialogTitle className={mediaStyles.title}>{t(initial?'edit':'add')}</DialogTitle>
   <DialogClose asChild><Button className={mediaStyles.close} variant="plain" size="icon-sm" disabled={uploading} aria-label={ui('close')}><MagneticSurface className={mediaStyles.closeSurface} maxOffset={5} disabled={uploading}><X aria-hidden="true"/></MagneticSurface></Button></DialogClose>
  </div>
  <div className={styles.fields}>
   <label className={styles.field} htmlFor={id+'url'}>{t('url')}<InputGroup><InputGroupAddon>{scheme}</InputGroupAddon><InputGroupInput id={id+'url'} value={url} onChange={event=>changeUrl(event.target.value)} onBlur={()=>{if(url&&!normalized)notify({id:noticeId,variant:'error',anchor:panel.current,message:t('invalid')});}} type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="example.com" maxLength={2048} aria-invalid={!!url&&!normalized}/></InputGroup></label>
   <label className={styles.field} htmlFor={id+'title'}>{t('title')}<InputGroup><InputGroupInput id={id+'title'} value={title} onChange={event=>{edited.current=true;setTitle(event.target.value);}} maxLength={300}/></InputGroup></label>
   {normalized&&<div className={cn(styles.card,styles.preview)}><LinkCardContent url={normalized} title={title||new URL(normalized).hostname} image={cover?.url||image} icon={icon}/></div>}
   <div className={styles.actions}>
    <Button ref={coverButton} variant="outline" disabled={uploading} onClick={()=>setPicker(true)}>{t('cover')}</Button>
    {(cover||image)&&(
     <Button variant="ghost" disabled={uploading||busy} onClick={()=>{setCover(undefined);setImage('');}}>{t('removeCover')}</Button>
    )}
    <Button variant="ghost" disabled={!normalized||busy||uploading} onClick={()=>setAttempt(value=>value+1)}>{t('retry')}</Button>
    <Button disabled={!normalized||busy||uploading} onClick={insert}>{t('save')}</Button>
   </div>
  </div>
  {picker&&<MediaLibraryProvider kind="image"><MediaPickerDialog dialogStyle={dialogStyle} open={picker} onOpenChange={setPicker} onBusyChange={value=>{setUploading(value);onBusyChange(value);}} onSelect={item=>{setCover({id:item.id,url:item.url+'?variant=thumbnail'});setPicker(false);}} onCloseFocus={()=>coverButton.current?.focus({preventScroll:true})}/></MediaLibraryProvider>}
 </DialogContent></Dialog>;
}
