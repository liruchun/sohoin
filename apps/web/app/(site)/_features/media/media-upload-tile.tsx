"use client";

import {useLayoutEffect,useRef,useState,type MouseEventHandler} from 'react';
import {useTranslations} from 'next-intl';
import {Check,Video,X} from 'lucide-react';
import {Button} from '@sohoin/ui/button';
import {useReducedMotionPreference} from '@sohoin/ui/theme-provider';
import type {PendingUpload} from './media-library';
import styles from './media-picker.module.css';

export function MediaUploadTile({upload,selected,onSelect,onRemove}:{upload:PendingUpload;selected:boolean;onSelect:MouseEventHandler<HTMLButtonElement>;onRemove:()=>void}){
 const t=useTranslations('MediaPicker'),reduceMotion=useReducedMotionPreference();
 const bar=useRef<HTMLSpanElement>(null),[settled,setSettled]=useState(false),[coverReady,setCoverReady]=useState(false);
 useLayoutEffect(()=>{
  const element=bar.current;if(!element)return;
  const from=getComputedStyle(element).transform;
  const target=`scaleX(${upload.progress/100})`;
  element.style.transform=target;
  if(reduceMotion){setSettled(!!upload.result);return;}
  // Retarget from the visible progress, including very fast completed requests.
  const duration=parseFloat(getComputedStyle(element).getPropertyValue('--site-motion-reveal'))||280;
  const animation=element.animate([{transform:from},{transform:target}],{duration,easing:'linear'});
  animation.onfinish=()=>{if(upload.result)setSettled(true);};
  return ()=>{element.style.transform=getComputedStyle(element).transform;animation.cancel();};
 },[upload.progress,upload.result,reduceMotion]);
 const complete=!!upload.result&&settled;
 const label=complete?t('uploadComplete'):upload.status==='failed'?t('uploadFailed'):upload.status==='queued'?t('uploadQueued'):upload.status==='processing'?t('processing'):t('uploadProgress',{percent:upload.progress});
 return <div className={styles.uploadTile} data-complete={complete||undefined}>
  <button type="button" className={styles.tile} disabled={!upload.result} aria-pressed={selected} onClick={onSelect}>
   <span className={styles.thumbnail}>
    {upload.preview?<img src={upload.preview} alt=""/>:<span className={styles.videoPlaceholder}><Video aria-hidden="true"/></span>}
    {upload.result&&<img className={styles.serverImage} data-ready={coverReady||undefined} src={upload.result.url+'?variant=thumbnail'} alt="" onLoad={()=>setCoverReady(true)}/>}
    <span className={styles.uploadStatus} role="status">{complete&&<Check aria-hidden="true"/>}{label}</span>
    <span className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.progress} aria-label={t('uploadProgressLabel',{name:upload.file.name})}><span ref={bar} className={styles.progressFill}/></span>
    {upload.file.type.startsWith('video/')&&<span className={styles.videoBadge} role="img" aria-label={t('videoLabel')} title={t('videoLabel')}><Video aria-hidden="true"/></span>}
    <span className={styles.check}>{selected&&<Check aria-hidden="true"/>}</span>
   </span>
   <span className={styles.filename}>{upload.result?.file.name??upload.file.name}</span>
   <span className={styles.info}>{((upload.result?.file.size??upload.file.size)/1024/1024).toFixed(2)} MB{upload.result?.durationMs!=null&&` · ${Math.floor(upload.result.durationMs/60000)}:${String(Math.floor(upload.result.durationMs/1000)%60).padStart(2,'0')}`}</span>
  </button>
  {upload.status==='failed'&&<Button className={styles.removeUpload} variant="outline" size="icon-sm" onClick={onRemove} aria-label={t('removeUpload')}><X aria-hidden="true"/></Button>}
 </div>;
}
