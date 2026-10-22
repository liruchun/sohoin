"use client";
import {useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode,type PointerEvent,type CSSProperties} from 'react';
import {useTranslations} from 'next-intl';
import {GalleryVerticalEnd,GripVertical,Plus,X,Video,Link} from 'lucide-react';
import {Button} from '@sohoin/ui/button';
import {Carousel,CarouselContent,CarouselItem,type CarouselApi} from '@sohoin/ui/carousel';
import {Tooltip} from '@sohoin/ui/tooltip';
import {useReducedMotionPreference} from '@sohoin/ui/theme-provider';
import {MediaLibraryProvider,type LocalMedia} from '../../_features/media/media-library';
import {MediaPickerDialog} from '../../_features/media/media-picker-dialog';
import {ComposerLinkDialog} from './composer-link';
import {LinkCardContent} from './link-card';
import {isComposerLink,type ComposerAttachment,type ComposerLink} from './composer-attachments';
import linkStyles from './link-card.module.css';
import styles from './post-composer.module.css';
type Props={dialogStyle?:CSSProperties;items:ComposerAttachment[];onChange:(items:ComposerAttachment[])=>void;disabled:boolean;onBusyChange:(busy:boolean)=>void;children:(button:ReactNode,attachments:ReactNode,linkButton:ReactNode)=>ReactNode};
export function ComposerMedia(props:Props){return <MediaLibraryProvider kind="all"><MediaControls {...props}/></MediaLibraryProvider>;}
function MediaControls({items,onChange,disabled,onBusyChange,children,dialogStyle}:Props){
 const t=useTranslations('Publishing'),trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[suppressTips,setSuppressTips]=useState(false);
 const lastTrigger=useRef<HTMLButtonElement|null>(null);
 const web=useTranslations('Web'),linkText=useTranslations('LinkPreview');
 const [link,setLink]=useState<ComposerLink|null|undefined>(undefined),[linkError,setLinkError]=useState('');
 const [suppressLinkTip,setSuppressLinkTip]=useState(false);
 const linkTrigger=useRef<HTMLButtonElement>(null),linkFocus=useRef<HTMLButtonElement|null>(null);
 function editLink(item:ComposerLink|null,button:HTMLButtonElement){linkFocus.current=button;setSuppressTips(true);setSuppressLinkTip(true);setLinkError('');setLink(item);}
 function closeLink(){setSuppressTips(true);setSuppressLinkTip(true);setLink(undefined);}
 function insertLink(item:ComposerLink){
  if(items.some(existing=>isComposerLink(existing)&&existing.url===item.url&&existing.id!==link?.id)){setLinkError(linkText('duplicate'));return;}
  onChange(link?items.map(existing=>existing.id===link.id?item:existing):[...items,item]);closeLink();
 }
 function selectMedia(selected:LocalMedia[]){
  const retained=items.filter(item=>isComposerLink(item)||selected.some(value=>value.id===item.id));
  onChange([...retained,...selected.filter(item=>!items.some(value=>value.id===item.id))]);
 }
 function openLibrary(button:HTMLButtonElement){lastTrigger.current=button;setSuppressTips(true);setOpen(true);}
 const tooltipEvents={onPointerMove:()=>{if(!open&&link===undefined)setSuppressTips(false);},onBlur:()=>{if(!open&&link===undefined)setSuppressTips(false);}};
 const grid=useRef<HTMLDivElement>(null),instructions=useId();
 const reduceMotion=useReducedMotionPreference();
 const [carousel,setCarousel]=useState<CarouselApi>();
 const animations=useRef(new Map<string,Animation>()),pendingPositions=useRef<Map<string,DOMRect>|null>(null);
 const gesture=useRef<{id:string;pointer:number;x:number;y:number;offsetX:number;offsetY:number;clientX:number;clientY:number;trackLeft:number;target:string|null;active:boolean;slots:{id:string;left:number;top:number;width:number;height:number}[]}|null>(null);
 const [drag,setDrag]=useState<{id:string;target:string|null;x:number;y:number}|null>(null),[announcement,setAnnouncement]=useState('');
 useEffect(()=>{
  const cancel=()=>{gesture.current=null;pendingPositions.current=null;setDrag(null);};
  const visibility=()=>{if(document.hidden)cancel();};
  window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',visibility);
  return ()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 function rememberPositions(){
  pendingPositions.current=new Map(Array.from(grid.current?.querySelectorAll<HTMLElement>('[data-media-id]')??[]).map(element=>[element.dataset.mediaId!,element.getBoundingClientRect()]));
 }
 // Retarget from the displayed positions, including unfinished earlier movements.
 // Pointer motion itself is immediate; only surrounding tiles and drop placement animate.
 useLayoutEffect(()=>{
  const before=pendingPositions.current;pendingPositions.current=null;
  if(!before&&!reduceMotion)return;
  const style=grid.current?getComputedStyle(grid.current):null;
  const duration=Number.parseFloat(style?.getPropertyValue('--site-motion-menu')??'')||180;
  const easing=style?.getPropertyValue('--site-ease-emphasis').trim()||'ease-out';
  for(const element of grid.current?.querySelectorAll<HTMLElement>('[data-media-id]')??[]){
   const id=element.dataset.mediaId!;
   animations.current.get(id)?.cancel();animations.current.delete(id);
   const previous=before?.get(id);if(reduceMotion||!previous||id===drag?.id)continue;
   const after=element.getBoundingClientRect(),transform=getComputedStyle(element).transform;
   const matrix=new DOMMatrixReadOnly(transform==='none'?undefined:transform);
   const dx=previous.left-after.left,dy=previous.top-after.top;
   if(Math.abs(dx)<.5&&Math.abs(dy)<.5)continue;
   const animation=element.animate([
    {transform:`translate(${matrix.e+dx}px, ${matrix.f+dy}px)`},
    {transform:`translate(${matrix.e}px, ${matrix.f}px)`},
   ],{duration,easing});
   animations.current.set(id,animation);
   animation.onfinish=()=>{if(animations.current.get(id)===animation)animations.current.delete(id);};
  }
 },[items,drag?.target,drag?.id,reduceMotion]);
 useEffect(()=>{const running=animations.current;return ()=>{for(const animation of running.values())animation.cancel();running.clear();};},[]);
 const blocked=disabled||busy||link!==undefined;
 function reorder(id:string,target:string){
  const from=items.findIndex(item=>item.id===id),to=items.findIndex(item=>item.id===target);
  if(blocked||from<0||to<0||from===to)return;
  const next=[...items],item=next.splice(from,1)[0];next.splice(to,0,item);onChange(next);setAnnouncement(t('imageMoved',{position:to+1}));
 }
 function startDrag(event:PointerEvent<HTMLButtonElement>,id:string){
  if(blocked||event.button!==0||!event.isPrimary)return;
  const tile=event.currentTarget.parentElement!,visible=tile.getBoundingClientRect();
  animations.current.get(id)?.cancel();animations.current.delete(id);
  const base=tile.getBoundingClientRect(),offsetX=visible.left-base.left,offsetY=visible.top-base.top;
  const slots=Array.from(grid.current?.querySelectorAll<HTMLElement>('[data-media-id]')??[]).map(element=>{
   const rect=element.getBoundingClientRect(),transform=getComputedStyle(element).transform,matrix=new DOMMatrixReadOnly(transform==='none'?undefined:transform);
   return {id:element.dataset.mediaId!,left:rect.left-matrix.e,top:rect.top-matrix.f,width:rect.width,height:rect.height};
  });
  const active=Math.abs(offsetX)+Math.abs(offsetY)>.5;
  gesture.current={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,offsetX,offsetY,target:id,active,slots,clientX:event.clientX,clientY:event.clientY,trackLeft:grid.current!.getBoundingClientRect().left};
  if(active)setDrag({id,target:id,x:offsetX,y:offsetY});
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function moveDrag(event:PointerEvent<HTMLButtonElement>){
  const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;
  if(event.pointerType==='mouse'&&(event.buttons&1)===0){endDrag(event,false);return;}
  const x=event.clientX-current.x,y=event.clientY-current.y;
  if(!current.active&&Math.hypot(x,y)<4)return;current.active=true;
  current.clientX=event.clientX;current.clientY=event.clientY;
  updateDrag();
 }
 function updateDrag(){
  const current=gesture.current,track=grid.current;if(!current?.active||!track)return;
  // Keep stable slots, but account for Embla's track movement. The held tile
  // stays under the pointer while newly revealed slots become drop targets.
  const shift=track.getBoundingClientRect().left-current.trackLeft;
  const bounds=track.parentElement!.getBoundingClientRect();
  const localX=Math.max(bounds.left+1,Math.min(current.clientX,bounds.right-1))-shift;
  const candidates=current.slots.filter(slot=>current.clientY>=slot.top&&current.clientY<=slot.top+slot.height);
  const hit=candidates.reduce<typeof candidates[number]|undefined>((closest,slot)=>!closest||Math.abs(localX-slot.left-slot.width/2)<Math.abs(localX-closest.left-closest.width/2)?slot:closest,undefined);
  const target=hit?.id??current.target;
  if(target!==current.target)rememberPositions();
  current.target=target;
  const x=current.clientX-current.x+current.offsetX-shift,y=current.clientY-current.y+current.offsetY;
  setDrag(previous=>previous?.id===current.id&&previous.target===target&&previous.x===x&&previous.y===y?previous:{id:current.id,target,x,y});
 }
 useEffect(()=>{
  if(!carousel||!drag?.id)return;
  let frame=0,nextScroll=0,lastDirection=0;
  const edge=parseFloat(getComputedStyle(document.documentElement).fontSize)*2.5;
  const tick=(time:number)=>{
   const current=gesture.current;if(!current?.active)return;
   const bounds=carousel.rootNode().getBoundingClientRect(),zone=Math.min(edge,bounds.width/4);
   // The handle sits at the tile's right edge; allow a full tile-width lead-in on the left.
   const leftZone=Math.min(edge*3,bounds.width/2);
   const withinY=current.clientY>=bounds.top&&current.clientY<=bounds.bottom;
   const direction=!withinY?0:current.clientX<bounds.left+leftZone?-1:current.clientX>bounds.right-zone?1:0;
   if(direction!==lastDirection){nextScroll=0;lastDirection=direction;}
   if(direction&&time>=nextScroll){
    if(direction<0&&carousel.canScrollPrev())carousel.scrollPrev(reduceMotion);
    if(direction>0&&carousel.canScrollNext())carousel.scrollNext(reduceMotion);
    nextScroll=time+350;
   }
   updateDrag();
   frame=requestAnimationFrame(tick);
  };
  // A resize invalidates the captured slots; cancel instead of dropping into
  // a stale position. Normal scrolls do not reinitialize the carousel.
  const cancel=()=>{gesture.current=null;pendingPositions.current=null;setDrag(null);};
  carousel.on('reInit',cancel);
  frame=requestAnimationFrame(tick);
  return ()=>{cancelAnimationFrame(frame);carousel.off('reInit',cancel);};
 },[carousel,drag?.id,reduceMotion]);

 function endDrag(event:PointerEvent<HTMLButtonElement>,commit:boolean){
  const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;
  if(commit){current.clientX=event.clientX;current.clientY=event.clientY;updateDrag();}
  rememberPositions();gesture.current=null;setDrag(null);
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(commit&&current.active&&current.target)reorder(current.id,current.target);
 }
 function tileTransform(id:string){
  if(!drag)return undefined;
  if(drag.id===id)return {transform:`translate(${drag.x}px, ${drag.y}px)`};
  const slots=gesture.current?.slots;if(!slots)return undefined;
  const order=slots.map(slot=>slot.id),from=order.indexOf(drag.id),to=order.indexOf(drag.target??drag.id);
  if(from<0||to<0)return undefined;
  order.splice(from,1);order.splice(to,0,drag.id);
  const original=slots.find(slot=>slot.id===id),destination=slots[order.indexOf(id)];
  return original&&destination?{transform:`translate(${destination.left-original.left}px, ${destination.top-original.top}px)`}:undefined;
 }
 const attachments=items.length>0?<div className={styles.attachments}>
  <span id={instructions} className="sr-only">{t('sortImages')}</span>
  <span className="sr-only" role="status">{announcement}</span>
  <Carousel adaptive setApi={setCarousel} className={styles.attachmentCarousel} opts={{slidesToScroll:"auto",dragFree:true,watchDrag:(_api,event)=>!(event.target instanceof Element&&event.target.closest("button"))}}><CarouselContent ref={grid} className={styles.imageGrid}>{items.map((item,index)=><CarouselItem key={item.id} className={styles.imageTile} data-media-id={item.id} data-dragging={drag?.id===item.id||undefined} data-drop-target={drag?.target===item.id&&drag.id!==item.id||undefined}
   style={tileTransform(item.id)}>
   <div className={styles.mediaPreview}>
    {isComposerLink(item)?<button type="button" className={linkStyles.card} disabled={blocked} onClick={event=>editLink(item,event.currentTarget)} aria-label={linkText('edit')}><LinkCardContent url={item.url} title={item.title} image={item.coverUrl||item.image} icon={item.icon}/></button>:<>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={item.url+'?variant=thumbnail'} alt="" width={item.width} height={item.height} draggable={false}/>{item.file.type.startsWith('video/')&&<Video className={styles.videoBadge} aria-hidden="true"/>}</>}
   </div>
   <button type="button" className={styles.imageHandle} disabled={blocked} aria-label={t('imagePosition',{position:index+1})} aria-describedby={instructions}
    onPointerDown={event=>startDrag(event,item.id)} onPointerMove={moveDrag} onPointerUp={event=>endDrag(event,true)} onPointerCancel={event=>endDrag(event,false)} onLostPointerCapture={event=>endDrag(event,false)}
    onKeyDown={event=>{if(event.key==='Escape'){pendingPositions.current=null;for(const animation of animations.current.values())animation.cancel();animations.current.clear();gesture.current=null;setDrag(null);return;}if(!['ArrowLeft','ArrowRight'].includes(event.key)||gesture.current)return;event.preventDefault();for(const animation of animations.current.values())animation.cancel();animations.current.clear();const target=items[index+(event.key==='ArrowLeft'?-1:1)];if(target)reorder(item.id,target.id);}}>
    <GripVertical aria-hidden="true"/>
   </button>
   <Button className={styles.imageRemove} size="icon-sm" variant="ghost" disabled={blocked} onClick={()=>onChange(items.filter(value=>value.id!==item.id))} aria-label={isComposerLink(item)?linkText('remove'):t(item.file.type.startsWith('video/')?'removeVideo':'removeImage')}><X aria-hidden="true"/></Button>
  </CarouselItem>)}{items.length<9&&<CarouselItem className={styles.imageTile}><Tooltip disabled={open||suppressTips} label={web('addMedia')}><Button className={styles.imageAppend} variant="outline" disabled={blocked} {...tooltipEvents} onClick={event=>openLibrary(event.currentTarget)} aria-label={web('addMedia')}><Plus aria-hidden="true"/></Button></Tooltip></CarouselItem>}</CarouselContent></Carousel>
 </div>:null;
 const button=<Tooltip disabled={open||suppressTips} label={web('addMedia')}><Button ref={trigger} variant="ghost" size="icon" disabled={blocked} aria-label={web('addMedia')} {...tooltipEvents} onClick={event=>openLibrary(event.currentTarget)}><GalleryVerticalEnd aria-hidden="true"/></Button></Tooltip>;
 return <>
  {children(button,attachments,<Tooltip disabled={open||link!==undefined||suppressLinkTip} label={web('addLink')}><Button ref={linkTrigger} onPointerLeave={()=>{if(link===undefined)setSuppressLinkTip(false);}} onBlur={()=>{if(link===undefined)setSuppressLinkTip(false);}} variant="ghost" size="icon" disabled={blocked||items.length>=9} aria-label={web('addLink')} onClick={event=>editLink(null,event.currentTarget)}><Link aria-hidden="true"/></Button></Tooltip>)}
  {link!==undefined&&<ComposerLinkDialog initial={link??undefined} dialogStyle={dialogStyle} onClose={closeLink} onCloseFocus={()=>{setSuppressLinkTip(true);(linkFocus.current?.isConnected?linkFocus.current:linkTrigger.current)?.focus({preventScroll:true});}} onInsert={insertLink} error={linkError} onErrorHandled={()=>setLinkError('')} onBusyChange={onBusyChange}/>}
  {busy&&<p className={styles.mediaStatus} role="status">{t('mediaProcessing')}</p>}
  {open&&<MediaPickerDialog dialogStyle={dialogStyle} open={open} onOpenChange={setOpen} onBusyChange={next=>{setBusy(next);onBusyChange(next);}} onSelect={()=>{}} multiple={{limit:9-items.filter(isComposerLink).length,initialSelected:items.filter((item):item is LocalMedia=>!isComposerLink(item)),onSelect:selectMedia}} onCloseFocus={()=>{(lastTrigger.current??trigger.current)?.focus({preventScroll:true});}}/>}
 </>;
}
