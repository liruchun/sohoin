"use client";
import {useTranslations} from "next-intl";

// shadcn/ui Carousel (MIT), adapted to the shared Button and local theme.
import {prefersReducedMotion} from "./theme-preference";
import {useReducedMotionPreference} from "./theme-provider";
import {createContext,useCallback,useContext,useEffect,useState,type ComponentProps,type KeyboardEvent} from "react";
import useEmblaCarousel,{type UseEmblaCarouselType} from "embla-carousel-react";
import {ChevronLeft,ChevronRight} from "lucide-react";
import {Button} from "./button";
import {MagneticSurface} from "./magnetic-surface";
import {cn} from "./utils";
import styles from "./carousel.module.css";

type CarouselApi=NonNullable<UseEmblaCarouselType[1]>;
type CarouselOptions=Parameters<typeof useEmblaCarousel>[0];
type CarouselState={carouselRef:UseEmblaCarouselType[0];api:CarouselApi|undefined;canScrollPrev:boolean;canScrollNext:boolean;selected:number;count:number;scrollPrev:()=>void;scrollNext:()=>void};
const CarouselContext=createContext<CarouselState|null>(null);
function useCarousel(){const value=useContext(CarouselContext);if(!value)throw new Error("Carousel components must be inside Carousel");return value;}

function Carousel({opts,setApi,className,children,onKeyDown,adaptive=false,...props}:ComponentProps<"div">&{opts?:CarouselOptions;setApi?:(api:CarouselApi)=>void;adaptive?:boolean}){
 const t=useTranslations("UI");
 const reduced=useReducedMotionPreference();
 const watchDrag=useCallback<Exclude<NonNullable<CarouselOptions>["watchDrag"],boolean|undefined>>((value,event)=>{
  if(!value.canScrollPrev()&&!value.canScrollNext())return false;
  return typeof opts?.watchDrag==="function"?opts.watchDrag(value,event):opts?.watchDrag!==false;
 },[opts?.watchDrag]);
 const [carouselRef,api]=useEmblaCarousel({align:"start",loop:false,...opts,...(reduced?{duration:0}:{}),watchDrag:adaptive?watchDrag:opts?.watchDrag??true,breakpoints:{"(prefers-reduced-motion: reduce)":{duration:0},...opts?.breakpoints}});
 const [position,setPosition]=useState({canScrollPrev:false,canScrollNext:false,selected:0,count:0});
 const scrollable=position.canScrollPrev||position.canScrollNext;
 const update=useCallback((value:CarouselApi)=>setPosition({canScrollPrev:value.canScrollPrev(),canScrollNext:value.canScrollNext(),selected:value.selectedScrollSnap(),count:value.scrollSnapList().length}),[]);
 const scrollPrev=useCallback(()=>api?.scrollPrev(prefersReducedMotion()),[api]);
 const scrollNext=useCallback(()=>api?.scrollNext(prefersReducedMotion()),[api]);
 useEffect(()=>{
  if(!api)return;update(api);setApi?.(api);api.on("select",update).on("reInit",update);
  return ()=>{api.off("select",update).off("reInit",update);};
 },[api,update,setApi]);
 // Embla 8 listens for document mouseup, but a release outside the window
 // can be lost. End through its normal DOM mouseup path before another move.
 useEffect(()=>{
  if(!api)return;
  const root=api.rootNode(),doc=root.ownerDocument,win=doc.defaultView;
  let mouse=false,dragging=false,x=0,y=0;
  const mouseDown=(event:MouseEvent)=>{mouse=event.button===0;x=event.clientX;y=event.clientY;};
  const touchStart=()=>{mouse=false;};
  const begin=()=>{dragging=mouse;};
  const end=()=>{dragging=false;};
  const release=()=>{
   if(!dragging)return;
   dragging=false;
   root.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,buttons:0,clientX:x,clientY:y}));
  };
  const move=(event:MouseEvent)=>{
   if(!dragging)return;
   if((event.buttons&1)===0){release();return;}
   x=event.clientX;y=event.clientY;

  };
  const visibility=()=>{if(doc.hidden)release();};
  root.addEventListener('mousedown',mouseDown,true);
  root.addEventListener('touchstart',touchStart,{capture:true,passive:true});
  doc.addEventListener('mousemove',move,true);
  doc.addEventListener('visibilitychange',visibility);
  win?.addEventListener('blur',release);
  api.on('pointerDown',begin).on('pointerUp',end).on('reInit',end);
  return ()=>{
   root.removeEventListener('mousedown',mouseDown,true);root.removeEventListener('touchstart',touchStart,true);
   doc.removeEventListener('mousemove',move,true);doc.removeEventListener('visibilitychange',visibility);win?.removeEventListener('blur',release);
   api.off('pointerDown',begin).off('pointerUp',end).off('reInit',end);
  };
 },[api]);
 function handleKeyDown(event:KeyboardEvent<HTMLDivElement>){
  if(event.target instanceof Element&&event.target.closest('video,audio,input,textarea,select,[contenteditable=true]'))return;
  onKeyDown?.(event);if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||(adaptive&&!scrollable))return;
  if(event.key==="ArrowLeft"){event.preventDefault();scrollPrev();}
  else if(event.key==="ArrowRight"){event.preventDefault();scrollNext();}
 }
 return <CarouselContext.Provider value={{carouselRef,api,...position,scrollPrev,scrollNext}}>
  <div role="region" aria-roledescription={adaptive&&!scrollable?undefined:t("carousel")} tabIndex={adaptive&&!scrollable?undefined:0} className={cn(styles.root,className)} data-carousel-ready={api?"true":undefined} data-carousel-static={adaptive&&!scrollable||undefined} onKeyDown={handleKeyDown} {...props}>{children}</div>
 </CarouselContext.Provider>;
}

function CarouselContent({className,viewportClassName,...props}:ComponentProps<"div">&{viewportClassName?:string}){
 const {carouselRef}=useCarousel();
 return <div ref={carouselRef} className={cn(styles.viewport,viewportClassName)}><div className={cn("flex",className)} {...props}/></div>;
}
function CarouselItem({className,...props}:ComponentProps<"div">){
 const t=useTranslations("UI");return <div role="group" aria-roledescription={t("slide")} className={cn("min-w-0 shrink-0 grow-0 basis-full",className)} {...props}/>;}
function CarouselPrevious({className,onClick,children,magnetic=false,magneticAreaSelector,...props}:ComponentProps<typeof Button>&{magnetic?:boolean;magneticAreaSelector?:string}){
 const t=useTranslations("UI");
 const {canScrollPrev,scrollPrev}=useCarousel();
 const content=children??<ChevronLeft size="1.25rem" strokeWidth={1.75} aria-hidden="true"/>;
 return <Button variant="outline" size="icon" className={cn(styles.control,className)} data-magnetic={magnetic||undefined} aria-label={t("previousImage")} disabled={!canScrollPrev} {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)scrollPrev();}}>{magnetic?<MagneticSurface areaSelector={magneticAreaSelector} disabled={!canScrollPrev||props.disabled} className={styles.magneticSurface}>{content}</MagneticSurface>:content}</Button>;
}
function CarouselNext({className,onClick,children,magnetic=false,magneticAreaSelector,...props}:ComponentProps<typeof Button>&{magnetic?:boolean;magneticAreaSelector?:string}){
 const t=useTranslations("UI");
 const {canScrollNext,scrollNext}=useCarousel();
 const content=children??<ChevronRight size="1.25rem" strokeWidth={1.75} aria-hidden="true"/>;
 return <Button variant="outline" size="icon" className={cn(styles.control,className)} data-magnetic={magnetic||undefined} aria-label={t("nextImage")} disabled={!canScrollNext} {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)scrollNext();}}>{magnetic?<MagneticSurface areaSelector={magneticAreaSelector} disabled={!canScrollNext||props.disabled} className={styles.magneticSurface}>{content}</MagneticSurface>:content}</Button>;
}
function CarouselStatus({total,grouped=false,className}:{total:number;grouped?:boolean;className?:string}){
 const t=useTranslations("UI");
 const {selected,count,api}=useCarousel();
 return <span className={cn(styles.status,className)} aria-live="polite" aria-atomic="true">{api&&count>0&&grouped?t("imageGroup",{number:selected+1,groups:count,count:total}):api&&count===total?`${selected+1} / ${total}`:t("imageTotal",{count:total})}</span>;
}

export {Carousel,CarouselContent,CarouselItem,CarouselPrevious,CarouselNext,CarouselStatus,type CarouselApi,type CarouselOptions};
