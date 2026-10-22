"use client";

import {useRef,useState} from "react";
import {useTranslations} from "next-intl";
import {Camera,QrCode} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {AuthorAvatar} from "../../_components/content/author-avatar";
import {useMediaLibrary,type LocalMedia} from "./media-library";
import {MediaPickerDialog} from "./media-picker-dialog";
import {AvatarCropDialog} from "./avatar-crop-dialog";
import styles from "./media-picker.module.css";

export function ImagePicker({file,onChange,avatar,name,onBusyChange}:{file:LocalMedia|null;onChange:(file:LocalMedia|null)=>void;avatar?:string|null;name?:string;onBusyChange?:(busy:boolean)=>void}){
 const t=useTranslations("MediaPicker"),library=useMediaLibrary(),preview=file?.url;
 const trigger=useRef<HTMLButtonElement>(null),nextDialog=useRef(false);
 const [open,setOpen]=useState(false),[crop,setCrop]=useState<LocalMedia|null>(null),[busy,setBusy]=useState(false);
 const isAvatar=name!==undefined;
 function select(item:LocalMedia){if(isAvatar){nextDialog.current=true;setCrop(item);}else onChange(item);}
 function restore(){if(nextDialog.current){nextDialog.current=false;return;}trigger.current?.focus();}
 return <div className={styles.imagePicker}>
  {isAvatar?<AuthorAvatar src={preview??avatar??null} name={name}/>:<div className={styles.qr}>{preview?
   // eslint-disable-next-line @next/next/no-img-element
   <img src={preview} alt={t("qrPreview")} width={192} height={192}/>:<QrCode size="3rem" aria-hidden="true"/>}</div>}
  <div className={styles.imageActions}>
   <Button ref={trigger} data-skeleton-part="block" variant="outline" disabled={busy} onClick={()=>setOpen(true)}>{isAvatar?<Camera size="1rem" aria-hidden="true"/>:<QrCode size="1rem" aria-hidden="true"/>}{t(busy?"processing":isAvatar?"changeAvatar":"chooseQr")}</Button>
   <p className={styles.hint} data-skeleton-part="body">{t("imageHint")}</p>
  </div>
  {open&&<MediaPickerDialog open={open} onOpenChange={setOpen} onSelect={select} onBusyChange={next=>{setBusy(next);onBusyChange?.(next);}} onCloseFocus={restore}/>}
  {crop&&<AvatarCropDialog key={crop.id} item={crop} name={name??""} onCancel={()=>{nextDialog.current=false;setCrop(null);}} onConfirm={async result=>{onChange(await library.add(result));nextDialog.current=false;setCrop(null);}} onCloseFocus={()=>trigger.current?.focus()}/>}
 </div>;
}
