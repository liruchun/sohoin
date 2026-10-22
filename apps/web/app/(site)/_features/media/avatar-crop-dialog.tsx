"use client";

import {useEffect,useRef,useState} from "react";
import {useTranslations} from "next-intl";
import {Button} from "@sohoin/ui/button";
import {Dialog} from "@sohoin/ui/dialog";
import {DialogContent,DialogDescription,DialogTitle} from "@sohoin/ui/dialog-content";
import {useToast} from "@sohoin/ui/toast";
import {AuthorAvatar} from "../../_components/content/author-avatar";
import type {LocalMedia} from "./media-library";
import styles from "./media-picker.module.css";

const clamp=(value:number)=>Math.min(1,Math.max(0,value));
export function AvatarCropDialog({item,name,onCancel,onConfirm,onCloseFocus}:{item:LocalMedia;name:string;onCancel:()=>void;onConfirm:(file:File)=>Promise<void>;onCloseFocus:()=>void}){
 const t=useTranslations("MediaPicker");
 const [zoom,setZoom]=useState(1),[x,setX]=useState(.5),[y,setY]=useState(.5),[preview,setPreview]=useState<string|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const {notify}=useToast();
 useEffect(()=>{if(error){notify({variant:'error',anchor:stage.current?.closest<HTMLElement>('[data-slot=dialog-content]'),message:t('cropError')});setError(false);}},[error,notify,t]);
 const decoded=useRef<HTMLImageElement|null>(null),stage=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;startX:number;startY:number}|null>(null),mounted=useRef(true);
 const size=Math.min(item.width,item.height)/zoom,sx=(item.width-size)*x,sy=(item.height-size)*y;
 useEffect(()=>{mounted.current=true;const image=new Image();image.src=item.url;void image.decode().then(()=>{if(mounted.current){decoded.current=image;setReady(true);}}).catch(()=>{if(mounted.current)setError(true);});return ()=>{mounted.current=false;};},[item.url]);
 useEffect(()=>{
  if(!ready||!decoded.current)return;
  const canvas=document.createElement("canvas");canvas.width=canvas.height=96;
  canvas.getContext("2d")?.drawImage(decoded.current,sx,sy,size,size,0,0,96,96);
  setPreview(canvas.toDataURL("image/png"));
 },[ready,sx,sy,size]);
 async function confirm(){
  if(!decoded.current||busy)return;setBusy(true);setError(false);
  try{
   const canvas=document.createElement("canvas");canvas.width=canvas.height=512;
   const context=canvas.getContext("2d");if(!context)throw new Error();
   context.drawImage(decoded.current,sx,sy,size,size,0,0,512,512);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error()),"image/webp",.9));
   if(mounted.current)await onConfirm(new File([blob],item.file.name.replace(/\.[^.]+$/,"")+"-avatar.webp",{type:blob.type}));
  }catch{if(mounted.current)setError(true);}finally{if(mounted.current)setBusy(false);}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onCancel();}}>
  <DialogContent onCloseAutoFocus={event=>{event.preventDefault();onCloseFocus();}}>
   <DialogTitle>{t("cropTitle")}</DialogTitle><DialogDescription>{t("cropHint")}</DialogDescription>
   <div className={styles.cropLayout}>
    <div ref={stage} className={styles.crop} tabIndex={0} role="group" aria-label={t("cropArea")}
     onKeyDown={event=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();if(event.key==="ArrowLeft")setX(value=>clamp(value-.02));if(event.key==="ArrowRight")setX(value=>clamp(value+.02));if(event.key==="ArrowUp")setY(value=>clamp(value-.02));if(event.key==="ArrowDown")setY(value=>clamp(value+.02));}}}
     onPointerDown={event=>{if(!event.isPrimary||event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,startX:x,startY:y};}}
     onPointerMove={event=>{const current=drag.current;if(!current||current.id!==event.pointerId)return;const width=event.currentTarget.getBoundingClientRect().width;if(!width)return;setX(clamp(current.startX-(event.clientX-current.x)/width*size/(item.width-size||1)));setY(clamp(current.startY-(event.clientY-current.y)/width*size/(item.height-size||1)));}}
     onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={item.url} alt="" draggable={false} style={{width:`${item.width/size*100}%`,height:`${item.height/size*100}%`,left:`${-sx/size*100}%`,top:`${-sy/size*100}%`}}/>
    </div>
    <div className={styles.preview}><span>{t("preview")}</span><AuthorAvatar src={preview} name={name}/></div>
   </div>
   <div className={styles.sliders}>
    <label className={styles.slider}><span>{t("zoom")}</span><input type="range" min={1} max={3} step={.01} value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label>
    <label className={styles.slider}><span>{t("horizontal")}</span><input type="range" min={0} max={1} step={.01} value={x} disabled={item.width===size} onChange={event=>setX(Number(event.target.value))}/></label>
    <label className={styles.slider}><span>{t("vertical")}</span><input type="range" min={0} max={1} step={.01} value={y} disabled={item.height===size} onChange={event=>setY(Number(event.target.value))}/></label>
   </div>
   <div className={styles.footer}><Button variant="outline" disabled={busy} onClick={onCancel}>{t("cancel")}</Button><Button disabled={!ready||busy} onClick={()=>void confirm()}>{t(busy?"processing":"useAvatar")}</Button></div>
  </DialogContent>
 </Dialog>;
}
