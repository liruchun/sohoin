"use client";

import {useEffect,useRef,useState,type ComponentProps,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {LightboxControls} from './lightbox-controls';
import {installLightboxControlsExit} from './lightbox-controls-motion';
import {syncLightboxMediaShape} from './lightbox-media-shape';
import {lightboxVisibleBounds} from './lightbox-visible-bounds';
import {useTranslations} from 'next-intl';
import type PhotoSwipe from 'photoswipe';
import type {PhotoSwipeFiltersMap} from 'photoswipe';
import 'photoswipe/style.css';
import {prefersReducedMotion} from './theme-preference';
import styles from './image-lightbox.module.css';

export type LightboxImage={src:string;alt:string;width:number;height:number;kind?:string;poster?:string};

/** Keep real server-rendered links; PhotoSwipe owns the viewer and its gestures. */
export function ImageLightbox({images,children,onClick,...props}:ComponentProps<'div'>&{images:readonly LightboxImage[]}){
 const t=useTranslations('UI');
 const [active,setActive]=useState<PhotoSwipe|null>(null);
 const viewer=useRef<PhotoSwipe|null>(null),loading=useRef(false),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;loading.current=false;viewer.current?.destroy();viewer.current=null;},[]);
 async function open(event:MouseEvent<HTMLDivElement>){
  onClick?.(event);
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target instanceof Element?event.target.closest<HTMLElement>('[data-lightbox-index]'):null;
  if(!link||!event.currentTarget.contains(link))return;
  const index=Number(link.dataset.lightboxIndex);
  if(!Number.isInteger(index)||!images[index])return;
  event.preventDefault();
  if(loading.current||viewer.current)return;
  loading.current=true;
  const token=++generation.current,root=event.currentTarget;
  const dataSource=images.map((image,i)=>{
   const element=root.querySelector<HTMLElement>(`[data-lightbox-index="${i}"]`);
   const thumbnail=element?.querySelector("img");
   return {...image,resumeAt:element instanceof HTMLVideoElement?element.currentTime:0,type:image.kind==='video'?'video':'image',element:element??undefined,thumbCropped:true,msrc:thumbnail?.currentSrc||thumbnail?.src||image.poster};
  });
  try{
   const {default:PhotoSwipe}=await import('photoswipe');
   if(token!==generation.current||!link.isConnected)return;
   const reduced=prefersReducedMotion(),theme=getComputedStyle(root);
   const rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
   const duration=(property:string,fallback:number)=>parseFloat(theme.getPropertyValue(property))||fallback;
   const playVideo=async(video:HTMLVideoElement):Promise<void>=>{
    const active=()=>!instance.isDestroying&&instance.element?.dataset.controlsState!=='exiting'&&video.isSameNode(instance.currSlide?.content.element??null);
    if(!active()||video.readyState===0)return;
    try{await video.play();}catch(error){
     if(!active()||!(error instanceof DOMException)||error.name!=='NotAllowedError')return;
     video.muted=true;
     try{await video.play();}catch{/* Keep the play control available. */}
    }
    if(!active())video.pause();
   };
   const mediaClick=(_point:unknown,event:PointerEvent)=>{
    if(event.target instanceof HTMLVideoElement){
     if(event.target.paused)void playVideo(event.target);else event.target.pause();
    }else instance.close();
   };
   const instance:PhotoSwipe=new PhotoSwipe({
    dataSource,index,arrowPrev:false,arrowNext:false,zoom:false,close:false,
    imageClickAction:mediaClick,bgClickAction:'close',tapAction:mediaClick,doubleTapAction:false,
    secondaryZoomLevel:'fit',maxZoomLevel:'fit',pinchToClose:false,mainClass:`site-portal ${styles.viewer}`,loop:false,
    showHideAnimationType:reduced?'none':'zoom',
    easing:theme.getPropertyValue('--site-ease-feedback').trim()||'ease-out',
    showAnimationDuration:reduced?0:Math.round(duration('--site-motion-menu',180)*5/6),
    hideAnimationDuration:reduced?0:Math.round(duration('--site-motion-menu',180)*5/6),
    zoomAnimationDuration:reduced?0:duration('--site-motion-menu',180),
    bgOpacity:1,
    paddingFn:(viewport,item)=>{
     const horizontal=Math.max(rem,(viewport.x-72*rem)/2);
     const vertical=Math.max(4*rem,viewport.y*.1,(viewport.y-48*rem)/2);
     return {left:horizontal,right:horizontal,top:vertical,bottom:Math.max(vertical,(item.type==='video'?10:7)*rem)};
    },preload:[1,1],trapFocus:true,returnFocus:false,
    closeTitle:t('closeImage'),zoomTitle:t('zoomImage'),
    arrowPrevTitle:t('previousImage'),arrowNextTitle:t('nextImage'),errorMsg:t('imageFailed'),
   });
   // Measure before PhotoSwipe mounts; CSS hides the native scrollbar only
   // while its viewer exists, including the entire closing animation.
   const documentRoot=document.documentElement;
   instance.on('beforeOpen',()=>documentRoot.style.setProperty('--lightbox-scrollbar-width',`${Math.max(0,window.innerWidth-documentRoot.clientWidth)}px`));
   instance.on('destroy',()=>documentRoot.style.removeProperty('--lightbox-scrollbar-width'));
   installLightboxControlsExit(instance);
   let sourcePlaceholder:HTMLElement|null=null;
   const restoreSource=()=>{
    sourcePlaceholder?.classList.remove(styles.sourcePlaceholder);
    sourcePlaceholder=null;
   };
   const maskSource=()=>{
    restoreSource();
    const source=dataSource[instance.currIndex]?.element;
    if(source instanceof HTMLVideoElement)return;
    sourcePlaceholder=source??null;
    sourcePlaceholder?.classList.add(styles.sourcePlaceholder);
   };
   instance.on('openingAnimationStart',maskSource);
   instance.on('openingAnimationEnd',restoreSource);
   instance.on('closingAnimationEnd',restoreSource);
   instance.on('destroy',restoreSource);
   syncLightboxMediaShape(instance,rem*.75);
   instance.addFilter('isContentZoomable',()=>false);
   const playCurrent=()=>{const video=instance.currSlide?.content.element;if(video instanceof HTMLVideoElement)void playVideo(video);};
   instance.on('change',()=>queueMicrotask(playCurrent));
   instance.on('contentActivate',()=>queueMicrotask(playCurrent));
   instance.on('contentLoad',event=>{
    const {content}=event;
    if(content.data.type!=='video')return;
    event.preventDefault();
    const video=document.createElement('video');
    video.className=`pswp__img ${styles.video}`;
    video.src=content.data.src??'';
    video.poster=content.data.poster??'';
    video.controls=false;video.playsInline=true;video.preload='metadata';video.volume=.5;
    video.tabIndex=0;video.setAttribute('role','button');
    video.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();if(video.paused)void playVideo(video);else video.pause();}});
    video.setAttribute('aria-label',content.data.alt??'');
    // PhotoSwipe 5.4.4 supports custom content, but types element as img | div.
    (content as {element:HTMLElement|undefined}).element=video;
    video.addEventListener('loadedmetadata',()=>{
     const resumeAt=Number(content.data.resumeAt)||0;
     if(resumeAt>0)video.currentTime=Number.isFinite(video.duration)?Math.min(resumeAt,Math.max(0,video.duration-.01)):resumeAt;
     if(instance.currSlide?.content===content)void playVideo(video);
    },{once:true});
    video.addEventListener('timeupdate',()=>{content.data.resumeAt=video.currentTime;});
    video.addEventListener('error',()=>content.onError(),{once:true});
   });
   instance.on('contentDeactivate',({content})=>{if(content.element instanceof HTMLVideoElement)content.element.pause();});
   instance.on('contentRemove',({content})=>{if(content.element instanceof HTMLVideoElement)content.element.pause();});
   instance.on('contentDestroy',({content})=>{
    if(content.element instanceof HTMLVideoElement){content.element.pause();content.element.removeAttribute('src');content.element.load();}
   });
   // Preserve the original object-fit scale, but crop to what the card actually
   // shows, including overflow hidden in the carousel's ancestors.
   // In 5.4.4 getThumbBounds/opener handle undefined to disable thumbnail zoom,
   // but the filter declaration omits undefined from its return type.
   instance.addFilter('thumbBounds',((bounds,data)=>{
    const thumbnail=data.element?.querySelector('img');
    if(!bounds?.innerRect||!thumbnail)return bounds;
    const visible=lightboxVisibleBounds(thumbnail);
    if(!visible.width||!visible.height)return undefined;
    const y=data.element?.dataset.longImage==='true'?thumbnail.getBoundingClientRect().top:bounds.y;
    return {...bounds,y,innerRect:{w:visible.width,h:visible.height,x:bounds.x-visible.left,y:y-visible.top}};
   }) as PhotoSwipeFiltersMap['thumbBounds']);
   instance.on('close',()=>{
    instance.element?.setAttribute('data-closing','true');
    instance.element?.querySelectorAll('video').forEach(video=>video.pause());
    const source=dataSource[instance.currIndex]?.element;
    const thumbnail=source?.querySelector('img')??source;
    if(thumbnail?.isConnected){
     // Reveal transformed carousel slides before PhotoSwipe measures the landing
     // bounds. Both movements finish under the still-opaque lightbox backdrop.
     thumbnail.dispatchEvent(new Event('lightbox:reveal-thumbnail',{bubbles:true}));
     thumbnail.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});
    }
    // Hide only the source's paint, preserving dimensions for return bounds.
    maskSource();
    instance.options.showHideAnimationType=prefersReducedMotion()?'none':thumbnail?.isConnected?'zoom':'fade';
   });
   viewer.current=instance;
   instance.on('afterInit',()=>{setActive(instance);queueMicrotask(playCurrent);root.querySelectorAll('video').forEach(video=>video.pause());instance.element?.setAttribute('aria-label',t('imagePreview'));instance.element?.setAttribute('aria-modal','true');});
   instance.on('destroy',()=>{
    if(viewer.current===instance)viewer.current=null;
    if(token===generation.current)setActive(null);
    const target=dataSource[instance.currIndex]?.element??link;
    if(token===generation.current&&target.isConnected)target.focus({preventScroll:true});
   });
   instance.init();
  }catch{
   viewer.current?.destroy();viewer.current=null;
   // Preserve the original image link if the optional viewer chunk cannot load.
   if(token===generation.current&&link.isConnected)window.location.assign(images[index].src);
  }finally{if(token===generation.current)loading.current=false;}
 }
 return <div {...props} onClick={event=>void open(event)}>{children}{active?.element&&createPortal(<LightboxControls instance={active} images={images}/>,active.element)}</div>;
}
