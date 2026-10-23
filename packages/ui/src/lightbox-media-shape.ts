import type PhotoSwipe from 'photoswipe';
import {lightboxVisibleBounds} from './lightbox-visible-bounds';
import styles from './image-lightbox.module.css';

/** Keep one unscaled outline, shared by the placeholder and loaded media. */
export function syncLightboxMediaShape(instance:PhotoSwipe,radius:number){
 let frame=0,animating=false,destroyed=false;
 const clippedMedia=new Set<HTMLElement>();
 const clearClipping=()=>{
  for(const element of clippedMedia)element.style.removeProperty('clip-path');
  clippedMedia.clear();
 };
 const outline=document.createElement('div');
 outline.className=styles.mediaOutline;
 outline.setAttribute('aria-hidden','true');
 const update=()=>{
  if(destroyed||!instance.element)return;
  if(!outline.parentNode)instance.element.appendChild(outline);
  const elements=instance.currSlide?.container.querySelectorAll<HTMLElement>('.pswp__img,video')??[];
  // Read first, then update paint-only clipping; no media dimensions are changed.
  const measurements=Array.from(elements,element=>{
   const rect=element.getBoundingClientRect(),visible=lightboxVisibleBounds(element);
   return {element,rect,visible,x:element.offsetWidth?rect.width/element.offsetWidth:0,y:element.offsetHeight?rect.height/element.offsetHeight:0};
  });
  for(const {element,rect,visible,x,y} of measurements){
   if(x<=0||y<=0)continue;
   element.style.setProperty('--media-radius',`${radius/x}px / ${radius/y}px`);
   // Viewport clipping belongs only to the opening/closing zoom. Persisting
   // it while slides move leaves cached offscreen images partially hidden.
   if(animating){
    element.style.clipPath=`inset(${Math.max(0,visible.top-rect.top)/y}px ${Math.max(0,rect.right-visible.right)/x}px ${Math.max(0,rect.bottom-visible.bottom)/y}px ${Math.max(0,visible.left-rect.left)/x}px round ${radius/x}px / ${radius/y}px)`;
    clippedMedia.add(element);
   }
  }
  const media=measurements.find(item=>!item.element.classList.contains('pswp__img--placeholder'))??measurements[0];
  const visible=media?.visible;
  outline.hidden=!visible?.width||!visible.height;
  if(visible){
   outline.style.left=`${visible.left}px`;outline.style.top=`${visible.top}px`;
   outline.style.width=`${visible.width}px`;outline.style.height=`${visible.height}px`;
   outline.style.borderRadius=`${radius}px`;
  }
 };
 const tick=()=>{
  frame=0;update();
  if(animating&&!destroyed)frame=requestAnimationFrame(tick);
 };
 const schedule=()=>{if(!frame&&!destroyed)frame=requestAnimationFrame(tick);};
 const start=()=>{animating=true;update();schedule();};
 const end=()=>{animating=false;clearClipping();update();schedule();};
 instance.on('openingAnimationStart',start);
 instance.on('closingAnimationStart',start);
 instance.on('openingAnimationEnd',end);
 instance.on('closingAnimationEnd',end);
 instance.on('contentResize',schedule);
 instance.on('contentAppend',schedule);
 instance.on('zoomPanUpdate',schedule);
 instance.on('resolutionChanged',schedule);
 instance.on('change',schedule);
 instance.on('moveMainScroll',schedule);
 instance.on('destroy',()=>{destroyed=true;animating=false;cancelAnimationFrame(frame);clearClipping();outline.remove();});
}
