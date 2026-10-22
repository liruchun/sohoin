"use client";

import {useCallback,useEffect,useId,useRef,useState,type CSSProperties} from "react";
import {useTranslations} from "next-intl";
import {Check,Plus,Search,Video,X} from "lucide-react";
import {cn} from "@sohoin/ui/utils";
import {Button} from "@sohoin/ui/button";
import {Dialog} from "@sohoin/ui/dialog";
import {DialogContent,DialogTitle,DialogClose} from "@sohoin/ui/dialog-content";
import {InputGroup,InputGroupAddon,InputGroupInput} from "@sohoin/ui/input-group";
import {ToggleGroup,ToggleGroupItem} from "@sohoin/ui/toggle-group";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {ScrollArea} from "@sohoin/ui/scroll-area";
import {useReducedMotionPreference} from "@sohoin/ui/theme-provider";
import {MediaUploadButton} from "./media-upload-button";
import {MediaUploadTile} from "./media-upload-tile";
import {useToast} from "@sohoin/ui/toast";
import {videoAccept} from "@sohoin/extension-api/video";
import {imageAccept,useMediaLibrary,type LocalMedia} from "./media-library";
import styles from "./media-picker.module.css";

export function MediaPickerDialog({open,onOpenChange,onSelect,onCloseFocus,multiple,onBusyChange,dialogStyle}:{open:boolean;onOpenChange:(open:boolean)=>void;onSelect:(item:LocalMedia)=>void;onCloseFocus:()=>void;onBusyChange?:(busy:boolean)=>void;dialogStyle?:CSSProperties;multiple?:{initialSelected?:LocalMedia[];limit:number;onSelect:(items:LocalMedia[])=>void}}){
 const t=useTranslations("MediaPicker"),ui=useTranslations("UI"),library=useMediaLibrary(),input=useRef<HTMLInputElement>(null);
 const [query,setQuery]=useState(""),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const {notify}=useToast();
 useEffect(()=>{if(error){notify({variant:'error',anchor:panel.current,message:error});setError('');}},[error,notify]);
 useEffect(()=>{if(library.error)notify({variant:'error',anchor:panel.current,message:t('loadError'),action:{label:t('retry'),onClick:()=>void library.reload()}});},[library.error,library.reload,notify,t]);
 const panel=useRef<HTMLDivElement>(null),drag=useRef<{pointer:number;y:number;height:number}|null>(null);
 const [height,setHeight]=useState<number|null>(null),[bounds,setBounds]=useState({min:0,max:0,initial:0});
 const readBounds=useCallback(()=>{
  const element=panel.current;if(!element)return null;
  const rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
  const viewport=window.visualViewport?.height??window.innerHeight;
  const max=Math.max(0,Math.min(viewport*.9,viewport-element.offsetTop-rem));
  const computed=getComputedStyle(element);
  const composerHeight=parseFloat(computed.getPropertyValue('--composer-height'));
  const content=element.querySelector<HTMLElement>('[data-media-content]');
  const scroller=element.querySelector<HTMLElement>('[data-slot=scroll-area]');
  const contentStyle=content?getComputedStyle(content):null;
  const padding=contentStyle?parseFloat(contentStyle.paddingTop)+parseFloat(contentStyle.paddingBottom):rem;
  const width=content?content.clientWidth-parseFloat(contentStyle!.paddingLeft)-parseFloat(contentStyle!.paddingRight):element.clientWidth-2.5*rem;
  const gap=.75*rem,columns=Math.max(1,Math.min(4,Math.floor((width+gap)/(6.25*rem+gap))));
  const tileWidth=(width-gap*(columns-1))/columns;
  const chrome=Array.from(element.children).reduce((total,child)=>total+(child===scroller?0:(child as HTMLElement).offsetHeight),0);
  const twoRows=chrome+padding+2*(tileWidth*.75+3*rem)+gap;
  const min=Math.min(max,Number.isFinite(composerHeight)?Math.min(composerHeight,twoRows):twoRows);
  return {min,max,initial:element.offsetHeight};
 },[]);
 const measure=useCallback(()=>{const next=readBounds();if(!next||next.max<=0)return;setBounds(next);setHeight(current=>Math.max(next.min,Math.min(current??next.initial,next.max)));},[readBounds]);
 const attachPanel=useCallback((element:HTMLDivElement|null)=>{panel.current=element;if(element)measure();},[measure]);
 useEffect(()=>{window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);return ()=>{window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};},[measure]);
 function resize(value:number){const current=readBounds();if(!current||current.max<=0)return;setBounds(current);setHeight(Math.min(current.max,Math.max(current.min,value)));}
 const [searchOpen,setSearchOpen]=useState(false),searchInput=useRef<HTMLInputElement>(null),searchButton=useRef<HTMLButtonElement>(null),searchId=useId();
 useEffect(()=>{if(searchOpen)searchInput.current?.focus({preventScroll:true});},[searchOpen]);
 function closeSearch(){setSearchOpen(false);setQuery('');searchButton.current?.focus({preventScroll:true});}
 const lock=useRef(false),isVideo=library.kind==="video";
 const scroll=useRef<HTMLDivElement>(null),reduceMotion=useReducedMotionPreference();
 const [selectedMany,setSelectedMany]=useState<string[]>(()=>Array.from(new Set(multiple?.initialSelected?.map(item=>item.id)??[])).slice(0,Math.min(multiple?.limit??1,9)));
 const allItems=Array.from(new Map([...(multiple?.initialSelected??[]),...library.items].map(item=>[item.id,item])).values());
 const selectedItems=selectedMany.flatMap(id=>{const item=allItems.find(item=>item.id===id);return item?[item]:[];});
 const selectionAnchor=useRef<string|null>(null);
 const selectionLimit=Math.min(multiple?.limit??1,9);
 function select(id:string,shift=false){
  if(!multiple){setSelected(id);return;}
  const order=Array.from(new Set([...visibleUploads.flatMap(upload=>upload.result?[upload.result.id]:[]),...items.map(item=>item.id)]));
  const start=selectionAnchor.current?order.indexOf(selectionAnchor.current):-1,end=order.indexOf(id);
  if(shift&&start>=0&&end>=0){
   const range=order.slice(Math.min(start,end),Math.max(start,end)+1);
   setSelectedMany(current=>[...current,...range.filter(value=>!current.includes(value))].slice(0,selectionLimit));
  }else{
   selectionAnchor.current=id;
   setSelectedMany(current=>current.includes(id)?current.filter(value=>value!==id):current.length<selectionLimit?[...current,id]:current);
  }
 }

 const completedIds=new Set(library.uploads.flatMap(upload=>upload.result?[upload.result.id]:[]));
 const matches=(file:{name:string;type:string})=>(library.kind!=='all'||library.filter==='all'||file.type.startsWith(library.filter+'/'))&&file.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
 const visibleUploads=library.uploads.filter(upload=>matches(upload.file));
 const items=allItems.filter(item=>library.pageIds.includes(item.id)&&!completedIds.has(item.id)&&matches(item.file));
 const selection=library.items.find(item=>item.id===selected);
 const hasItems=library.pageIds.length>0||library.uploads.length>0;
 async function addFiles(files:File[]){
  if(lock.current||!files.length)return;lock.current=true;setBusy(true);onBusyChange?.(true);setError("");setQuery('');if(library.kind==='all')library.setFilter('all');
  scroll.current?.querySelector('[data-slot=scroll-area-viewport]')?.scrollTo({top:0,behavior:reduceMotion?"instant":"smooth"});
  try{await library.addMany(files.slice(0,multiple?selectionLimit:isVideo?1:10),item=>{if(multiple)setSelectedMany(current=>current.includes(item.id)||current.length>=selectionLimit?current:[...current,item.id]);else setSelected(item.id);});if(files.length>(multiple?selectionLimit:isVideo?1:10))setError(t(multiple?"selectionLimit":isVideo?"videoBatchLimit":"batchLimit",{count:multiple?selectionLimit:10}));}
  catch(error){setError(error instanceof Error&&!["libraryFull","imageError","videoError","uploadFailed"].includes(error.message)?error.message:t(error instanceof Error&&error.message==="libraryFull"?"libraryFull":error instanceof Error&&error.message==='uploadFailed'?'uploadFailed':error instanceof Error&&error.message==='videoError'?"videoError":"imageError"));}
  finally{lock.current=false;setBusy(false);onBusyChange?.(false);}
 }
 return <Dialog open={open} onOpenChange={next=>{if(!next&&busy)return;onOpenChange(next);}}>
  <DialogContent ref={attachPanel} showCloseButton={false} className={cn(styles.library,styles.aligned)} style={{...dialogStyle,...(height!==null?{height}: {})}} data-aligned={!!dialogStyle||undefined} aria-describedby={undefined} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void addFiles(Array.from(event.dataTransfer.files));}} onCloseAutoFocus={event=>{event.preventDefault();onCloseFocus();}}>
   <div className={styles.header} data-magnetic-area="">
    <DialogTitle className={styles.title}>{t(isVideo?"videoLibrary":"library")}</DialogTitle>
    <DialogClose asChild><Button className={styles.close} variant="plain" size="icon-sm" disabled={busy} aria-label={ui('close')}><MagneticSurface className={styles.closeSurface} maxOffset={5} disabled={busy}><X aria-hidden="true"/></MagneticSurface></Button></DialogClose>
   </div>
   <div className={styles.tools}>
    {library.kind==='all'&&<ToggleGroup type="single" value={library.filter} onValueChange={value=>{if(value==='all'||value==='image'||value==='video'){library.setFilter(value);scroll.current?.querySelector('[data-slot=scroll-area-viewport]')?.scrollTo({top:0});}}} className={styles.filters} aria-label={t('mediaType')}>
     <ToggleGroupItem value="all">{t('allMedia')}</ToggleGroupItem><ToggleGroupItem value="image">{t('images')}</ToggleGroupItem><ToggleGroupItem value="video">{t('videos')}</ToggleGroupItem>
    </ToggleGroup>}
    <div className={styles.searchSlot} data-open={searchOpen||undefined}>
     <Button ref={searchButton} className={styles.searchTrigger} variant="ghost" size="icon-sm" aria-label={t('search')} aria-expanded={searchOpen} aria-controls={searchId} tabIndex={searchOpen?-1:0} onClick={()=>setSearchOpen(true)}><Search aria-hidden="true"/></Button>
     <InputGroup id={searchId} className={styles.search} inert={!searchOpen} aria-hidden={!searchOpen}>
      <InputGroupInput ref={searchInput} aria-label={t('search')} placeholder={t('search')} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch();}}}/>
      <InputGroupAddon align="inline-end"><Button variant="ghost" size="icon-sm" onClick={closeSearch} aria-label={t('closeSearch')}><X aria-hidden="true"/></Button></InputGroupAddon>
     </InputGroup>
    </div>
    <MediaUploadButton className={styles.uploadButton} variant="outline" size="sm" disabled={busy} onClick={()=>input.current?.click()}>{t(busy?"processing":"upload")}</MediaUploadButton>
   </div>
   <input ref={input} hidden type="file" accept={library.kind==='all'?imageAccept+','+videoAccept:isVideo?videoAccept:imageAccept} multiple={!isVideo||!!multiple} onChange={event=>{void addFiles(Array.from(event.target.files??[]));event.target.value="";}}/>
   <ScrollArea ref={scroll} className={styles.scroller} viewportClassName={styles.viewport} type="hover" scrollHideDelay={150}>
   <div className={styles.scrollContent} data-media-content="">
   {library.loading&&!hasItems&&<p role="status">{t("loading")}</p>}
   {!hasItems&&!library.loading&&!library.error&&<MediaUploadButton variant="outline" className={styles.drop} disabled={busy} onClick={()=>input.current?.click()}><span>{t(busy?"processing":library.kind==='all'?"dropMedia":isVideo?"dropVideo":"drop")}</span></MediaUploadButton>}
   {items.length||visibleUploads.length?<div className={styles.grid}>
    {visibleUploads.map(upload=><MediaUploadTile key={upload.id} upload={upload} selected={!!upload.result&&(multiple?selectedMany.includes(upload.result.id):selected===upload.result.id)} onSelect={event=>{if(upload.result)select(upload.result.id,event.shiftKey);}} onRemove={()=>library.dismissUpload(upload.id)}/>)}
    {items.map(item=><button type="button" key={item.id} className={styles.tile} aria-pressed={multiple?selectedMany.includes(item.id):selected===item.id} onClick={event=>select(item.id,event.shiftKey)}>
     <span className={styles.thumbnail}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url+'?variant=thumbnail'} alt="" width={item.width} height={item.height} loading="lazy"/>
      {item.file.type.startsWith('video/')&&<span className={styles.videoBadge} role="img" aria-label={t('videoLabel')} title={t('videoLabel')}><Video aria-hidden="true"/></span>}
      <span className={styles.check}>{(multiple?selectedMany.includes(item.id):selected===item.id)&&<Check size="1rem" aria-hidden="true"/>}</span>
     </span><span className={styles.filename}>{item.file.name}</span><span className={styles.info}>{item.file.type.split("/")[1].toUpperCase()} · {(item.file.size/1024/1024).toFixed(2)} MB{item.file.type.startsWith('video/')&&item.durationMs!=null&&` · ${Math.floor(item.durationMs/60000)}:${String(Math.floor(item.durationMs/1000)%60).padStart(2,"0")}`}</span>
    </button>)}
   </div>:hasItems&&<p className={styles.empty}>{t("noResults")}</p>}
   {library.hasMore&&<div className={styles.loadMore} data-magnetic-area=""><Button variant="plain" className={styles.loadMoreButton} disabled={library.loading} onClick={()=>void library.loadMore()}><MagneticSurface className={styles.loadMoreSurface} maxOffset={5} disabled={library.loading}><Plus data-icon="inline-start" aria-hidden="true"/>{t('loadMore')}</MagneticSurface></Button></div>}
   </div>
   </ScrollArea>
   <div className={styles.footer}>
    <span>{t("selected",{count:multiple?selectedItems.length:selection?1:0})}{multiple&&` / ${selectionLimit}`}</span>
    <Button variant="outline" disabled={busy} onClick={()=>onOpenChange(false)}>{t("cancel")}</Button>
    <Button
     disabled={(multiple?selectedItems.length===0:!selection)||busy}
     onClick={()=>{
      if(multiple){
       multiple.onSelect(selectedItems);
       onOpenChange(false);
      }else if(selection){
       onSelect(selection);
       onOpenChange(false);
      }
     }}
    >{t(library.kind==='all'?"useMedia":isVideo?"useVideo":"useImage")}</Button>
   </div>
   <div className={styles.resize} role="separator" tabIndex={0} aria-label={t('resizeLibrary')} aria-orientation="horizontal" aria-valuemin={Math.round(bounds.min)} aria-valuemax={Math.round(bounds.max)} aria-valuenow={Math.round(height??bounds.initial)}
    onPointerDown={event=>{if(event.button!==0)return;measure();event.preventDefault();event.currentTarget.focus({preventScroll:true});drag.current={pointer:event.pointerId,y:event.clientY,height:panel.current?.getBoundingClientRect().height??bounds.initial};event.currentTarget.setPointerCapture(event.pointerId);}}
    onPointerMove={event=>{const start=drag.current;if(start?.pointer===event.pointerId)resize(start.height+event.clientY-start.y);}}
    onPointerUp={event=>{if(drag.current?.pointer===event.pointerId){drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}}
    onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
    onKeyDown={event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const step=parseFloat(getComputedStyle(document.documentElement).fontSize)*(event.shiftKey?4:1);const current=readBounds();if(!current)return;resize(event.key==='Home'?current.min:event.key==='End'?current.max:(panel.current?.getBoundingClientRect().height??bounds.initial)+(event.key==='ArrowDown'?step:-step));}}><span/></div>
  </DialogContent>
 </Dialog>;
}
