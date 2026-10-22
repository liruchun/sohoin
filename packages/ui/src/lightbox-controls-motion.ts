import type PhotoSwipe from 'photoswipe';
import {prefersReducedMotion} from './theme-preference';

/** Animate only the lightbox controls, leaving PhotoSwipe's media motion intact. */
export async function animateLightboxControls(instance:PhotoSwipe,closing=false){
 const root=instance.element,slide=instance.currSlide;
 if(!root||!slide||(!closing&&root.dataset.controlsState==='exiting'))return;
 const state=closing?'exiting':'entering';
 root.dataset.controlsState=state;
 const elements=Array.from(root.querySelectorAll<HTMLElement>('[data-lightbox-control]'));
 const theme=getComputedStyle(root);
 const duration=prefersReducedMotion()?0:parseFloat(theme.getPropertyValue('--site-motion-menu'))||180;
 const easing=theme.getPropertyValue('--site-ease-feedback').trim()||'ease-out';
 const animations=elements.map(element=>{
  const style=getComputedStyle(element),rect=element.getBoundingClientRect();
  const current={transform:style.transform,opacity:style.opacity};
  element.getAnimations().forEach(animation=>animation.cancel());
  const side=element.dataset.side;
  let hidden:string,shown:string;
  if(side){
   const edge=side==='previous'?slide.pan.x+rect.width/2:slide.pan.x+slide.width*slide.zoomLevels.initial-rect.width/2;
   const offset=edge-(rect.left+rect.width/2);
   hidden=`translate(calc(-50% + ${offset}px),-50%) scale(.9)`;
   shown='translate(-50%,-50%) scale(1)';
  }else{
   hidden='translate(-50%,.75rem) scale(.95)';
   shown='translate(-50%,0) scale(1)';
  }
  const opacity=element.getAttribute('aria-disabled')==='true' ? .3 : 1;
  return element.animate(closing?[current,{transform:hidden,opacity:0}]:[{transform:hidden,opacity:0},{transform:shown,opacity}],{
   duration,easing,fill:'both',delay:duration?((closing?!!side:!side)?40:0):0,
  });
 });
 await Promise.allSettled(animations.map(animation=>animation.finished));
 if(root.dataset.controlsState!==state)return;
 root.dataset.controlsState=closing?'hidden':'ready';
 animations.forEach(animation=>animation.cancel());
}

/** Route every close entry (Escape, backdrop, gestures, button) through one exit. */
export function installLightboxControlsExit(instance:PhotoSwipe){
 const close=instance.close.bind(instance);
 let exiting=false,destroyed=false;
 instance.close=()=>{
  if(destroyed||instance.isDestroying)return;
  // PhotoSwipe.destroy() sets this option before calling close. Never delay teardown.
  if(instance.options.showHideAnimationType==='none'||prefersReducedMotion()){close();return;}
  if(exiting||!instance.opener.isOpen)return;
  exiting=true;
  instance.element?.querySelectorAll('video').forEach(video=>video.pause());
  void animateLightboxControls(instance,true).finally(()=>{if(!destroyed)close();});
 };
 instance.on('destroy',()=>{
  destroyed=true;
  instance.element?.querySelectorAll<HTMLElement>('[data-lightbox-control]').forEach(element=>element.getAnimations().forEach(animation=>animation.cancel()));
 });
}
