import {measureSkeleton,skeletonNodes} from "./skeleton-geometry";
import {morphSkeletonShapes} from "./skeleton-morph";
import {SKELETON,SKELETON_TIMING,SKELETON_OPACITY_EASING,rowTiming,milliseconds} from "./skeleton-contract";
import styles from "./skeleton-reveal.module.css";

export const readSkeletonParts=(item:HTMLElement)=>{
   const origin=item.getBoundingClientRect();
   return skeletonNodes(item,SKELETON.part).slice(0,SKELETON.maxParts).map(part=>{
    const box=part.getBoundingClientRect();return {part,width:box.width,height:box.height,x:box.left-origin.left,y:box.top-origin.top};
   });
  };
export const drawSkeletonShapes=(target:HTMLElement,layout:ReturnType<typeof measureSkeleton>)=>{
   const shapes=layout.shapes.map(rect=>{
    const shape=document.createElement("span");shape.className=styles.shape;
    Object.assign(shape.style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.width}px`,height:`${rect.height}px`,borderRadius:rect.radius});return shape;
   });
   target.replaceChildren(...shapes);
  };

type LayoutOptions={
 element:HTMLElement;serverEntry:boolean;serverSplash:boolean;skeletonEnter:number;stagger:number;theme:CSSStyleDeclaration;
 animations:Animation[];geometryAnimations:Animation[];entranceAnimations:Animation[];chromeAnimations:Animation[];cleanups:(()=>void)[];
 breathingLayers:Map<HTMLElement,HTMLElement>;
};
/** One bounded natural-layout snapshot; card markup only supplies semantic markers. */
export function prepareSkeletonLayout({element,serverEntry,serverSplash,skeletonEnter,stagger,theme,animations,geometryAnimations,entranceAnimations,chromeAnimations,cleanups,breathingLayers}:LayoutOptions){
   const expand=milliseconds(theme.getPropertyValue("--site-motion-skeleton-expand"),SKELETON_TIMING.expand),fade=milliseconds(theme.getPropertyValue("--site-motion-reveal"),SKELETON_TIMING.fade);
   const opacityEasing=theme.getPropertyValue("--site-ease-reveal").trim()||SKELETON_OPACITY_EASING;
   const textStagger=milliseconds(theme.getPropertyValue("--site-motion-skeleton-stagger"),SKELETON_TIMING.stagger);
   const initial=element.querySelector<HTMLElement>(SKELETON.initial),resolved=element.querySelector<HTMLElement>(SKELETON.resolved);
   // Client batches append a bounded, user-requested set; keep a skeleton row
   // for every received item instead of culling rows below the viewport.
   const preserveAll=element.hasAttribute("data-skeleton-preserve-all");
   const maxItems=preserveAll?SKELETON.maxBatchItems:SKELETON.maxItems;
   let restoreBatchGeometry=()=>{};
   if(preserveAll&&!serverEntry&&resolved){
    // Row padding, list gaps and nested replies also contribute to batch height.
    // Keep that outer footprint on the placeholder geometry until it can morph;
    // hidden, unmeasured rows must not suddenly push the following button down.
    const from=element.getBoundingClientRect().height;
    const to=resolved.getBoundingClientRect().height+element.offsetHeight-element.clientHeight;
    const oldHeight=element.style.height,oldOverflow=element.style.overflow;
    element.style.height=`${from}px`;element.style.overflow="clip";
    const count=Math.min(maxItems,skeletonNodes(resolved,SKELETON.item).length);
    const height=element.animate([{height:`${from}px`},{height:`${to}px`}],{
     duration:expand+Math.max(0,count-SKELETON.preservedRows)*stagger,easing:opacityEasing,fill:"both",
    });
    height.pause();height.currentTime=0;geometryAnimations.push(height);
    restoreBatchGeometry=()=>{height.cancel();element.style.height=oldHeight;element.style.overflow=oldOverflow;};
    cleanups.push(restoreBatchGeometry);
   }
   if(!serverEntry){
    const sourceContext=initial?skeletonNodes(initial,SKELETON.context)[0]:undefined,context=resolved?skeletonNodes(resolved,SKELETON.context)[0]:undefined;
    if(sourceContext&&context){
     const sourceBox=sourceContext.getBoundingClientRect(),box=context.getBoundingClientRect(),layout=measureSkeleton(context),sourceLayout=measureSkeleton(sourceContext),children=Array.from(context.children);
     const oldPosition=context.style.position,oldHeight=context.style.height,oldOverflow=context.style.overflow;
     context.dataset.skeletonContextAnimated="";
     context.style.position="relative";context.style.height=`${sourceBox.height}px`;context.style.overflow="hidden";
     const overlay=document.createElement("div"),breathing=document.createElement("div");overlay.className=styles.overlay;breathing.className=styles.breathing;overlay.setAttribute("aria-hidden","true");overlay.append(breathing);context.append(overlay);
     cleanups.push(()=>{overlay.remove();delete context.dataset.skeletonContextAnimated;context.style.position=oldPosition;context.style.height=oldHeight;context.style.overflow=oldOverflow;});
     const duration=expand;overlay.dataset.skeletonOverlay="";
     geometryAnimations.push(...morphSkeletonShapes(breathing,layout,sourceLayout,styles.shape,{duration,delay:0,easing:opacityEasing,offsetX:sourceBox.left-box.left,offsetY:0}));
     const height=context.animate([{height:`${sourceBox.height}px`},{height:`${box.height}px`}],{duration,easing:opacityEasing,fill:"both"});height.pause();height.currentTime=0;geometryAnimations.push(height);
     for(const [target,from,to] of [...children.map(child=>[child,0,1] as const),[overlay,1,0] as const]){
      const animation=target.animate([{opacity:from},{opacity:to}],{duration:fade,easing:opacityEasing,fill:"both"});animation.pause();animation.currentTime=0;animations.push(animation);
     }
    }
   }
   if(serverSplash&&resolved){
    const scene=element.closest("[data-skeleton-scene]");
    const chrome=Array.from(scene?.querySelectorAll<HTMLElement>("[data-skeleton-chrome]:not([data-skeleton-chrome-group])")??[]).map(target=>({target,order:0}));
    for(const group of scene?.querySelectorAll<HTMLElement>("[data-skeleton-chrome-group]")??[]){
     // DOM order follows the reading order; hidden items do not consume a slot.
     // Only the outer marked item moves, so nested content never slides twice.
     const items=Array.from(group.querySelectorAll<HTMLElement>("[data-skeleton-chrome-item]")).filter(target=>{
      if(target.closest("[data-skeleton-chrome-group]")!==group||target.parentElement?.closest("[data-skeleton-chrome-item]"))return false;
      const rect=target.getBoundingClientRect();return rect.width>0&&rect.height>0;
     });
     items.forEach((target,order)=>chrome.push({target,order}));
    }
    for(const {target,order} of [{target:resolved,order:0},...chrome]){
     // Host chrome can set its own pace while retaining the same launch clock,
     // reduced-motion handling and cleanup. SPA navigation never enters here.
     const style=getComputedStyle(target);
     const duration=milliseconds(style.getPropertyValue("--skeleton-enter-duration"),skeletonEnter);
     const delay=Math.min(1200,milliseconds(style.getPropertyValue("--skeleton-enter-stagger"),0)*order);
     const easing=style.getPropertyValue("--skeleton-enter-ease").trim()||opacityEasing;
     const animation=target.animate([{opacity:0,transform:"var(--skeleton-enter-transform, none)"},{opacity:style.opacity,transform:"none"}],{duration,delay,easing,fill:"both"});
     animation.pause();animation.currentTime=0;
     (target===resolved?entranceAnimations:chromeAnimations).push(animation);
    }
   }
   const sources=serverEntry||!initial?[]:skeletonNodes(initial,SKELETON.item).slice(0,SKELETON.preservedRows).map(item=>({rect:item.getBoundingClientRect(),layout:measureSkeleton(item)}));
   const candidates=resolved?skeletonNodes(resolved,SKELETON.item).slice(0,SKELETON.maxCandidates):[];
   const first=candidates[0]?.getBoundingClientRect();
   const compactHeight=sources[0]?.rect.height||100;
   const selected=candidates.map((item,index)=>{
    const rect=item.getBoundingClientRect(),source=sources[index],startHeight=source?.rect.height??0;
    const belowViewport=serverEntry?rect.top>=innerHeight:(first&&first.top+index*compactHeight>=innerHeight);
    // Existing placeholders must survive the handoff as a pair. Their real rows
    // can be outside the viewport before collapse/scroll restoration settles;
    // culling one here makes it disappear until the final content is revealed.
    if(!rect.width||(!preserveAll&&!source&&(rect.bottom<=0||belowViewport)))return null;
    return {item,rect,source,startHeight};
   }).filter(value=>value!==null).slice(0,maxItems);
   const measured=selected.map(({item,rect,source,startHeight})=>{
    const theme=getComputedStyle(item);
    const parts=readSkeletonParts(item);
    return {item,source,parts,layout:measureSkeleton(item),height:rect.height,startHeight,position:theme.position,
     paddingTop:theme.paddingTop,paddingBottom:theme.paddingBottom,borderBottom:theme.borderBottomWidth,
     expand,restoreGeometry:()=>{}};
   }).map((record,index)=>{
    const timing=rowTiming(index,serverEntry?"server":"spa",{expand:record.expand,stagger,textStagger});
    return {...record,
    // Preserve both placeholders while later rows join their ongoing expansion.
    delay:timing.geometryDelay,textDelay:timing.textDelay,
   };});
   const morphs:{item:HTMLElement;breathing:HTMLElement;record:(typeof measured)[number]}[]=[];
   for(const record of measured){
    const {item,source,layout,height,startHeight,position,expand,delay,textDelay,paddingTop,paddingBottom,borderBottom}=record;
    if(!layout.shapes.length)continue;
    const oldPosition=item.style.position,oldHeight=item.style.height,oldOverflow=item.style.overflow,oldPaddingTop=item.style.paddingTop,oldPaddingBottom=item.style.paddingBottom,oldBorderBottom=item.style.borderBottomWidth;
    if(position==="static")item.style.position="relative";
    if(!serverEntry){
     item.style.height=`${startHeight}px`;item.style.overflow="hidden";
     if(!source){item.style.paddingTop="0px";item.style.paddingBottom="0px";item.style.borderBottomWidth="0px";}
    }
    item.dataset.skeletonAnimated="";
    // SSR skeleton rows enter together through the resolved layer above.
    // textDelay belongs only to the later skeleton-to-content handoff.
    cleanups.push(()=>{item.style.height=oldHeight;item.style.overflow=oldOverflow;item.style.paddingTop=oldPaddingTop;item.style.paddingBottom=oldPaddingBottom;item.style.borderBottomWidth=oldBorderBottom;delete item.dataset.skeletonAnimated;});
    const children=Array.from(item.children),overlay=document.createElement("div");
    overlay.className=styles.overlay;overlay.dataset.skeletonOverlay="";overlay.setAttribute("aria-hidden","true");
    item.append(overlay);cleanups.push(()=>{overlay.remove();if(position==="static")item.style.position=oldPosition;});
    const breathing=document.createElement("div");breathing.className=styles.breathing;overlay.append(breathing);
    breathingLayers.set(item,breathing);
    if(serverEntry)drawSkeletonShapes(breathing,layout);
    else morphs.push({item,breathing,record});
    // Paused geometry preserves source shapes; real children remain transparent.
    if(!serverEntry){
     const heightAnimation=item.animate([
      {height:`${startHeight}px`,paddingTop:source?paddingTop:"0px",paddingBottom:source?paddingBottom:"0px",borderBottomWidth:source?borderBottom:"0px"},
      {height:`${height}px`,paddingTop,paddingBottom,borderBottomWidth:borderBottom},
     ],{delay,duration:expand,easing:opacityEasing,fill:"both"});
     heightAnimation.pause();heightAnimation.currentTime=0;geometryAnimations.push(heightAnimation);
     record.restoreGeometry=()=>{
      heightAnimation.cancel();item.style.height=oldHeight;item.style.overflow=oldOverflow;
      item.style.paddingTop=oldPaddingTop;item.style.paddingBottom=oldPaddingBottom;item.style.borderBottomWidth=oldBorderBottom;
     };
    }
    for(const child of children){
     const animation=child.animate([{opacity:0},{opacity:1}],{delay:textDelay,duration:fade,easing:opacityEasing,fill:"both"});
     animation.pause();animation.currentTime=0;animations.push(animation);
    }
    const fadeAnimation=overlay.animate([{opacity:1},{opacity:0}],{delay:textDelay,duration:fade,easing:opacityEasing,fill:"both"});
    fadeAnimation.pause();fadeAnimation.currentTime=0;animations.push(fadeAnimation);
   }

 // All rows now have their paused starting heights. Read their positions together
 // before inserting any shapes; a per-row read/write loop forces repeated layout.
 const origins=morphs.map(({item})=>item.getBoundingClientRect());
 morphs.forEach(({breathing,record:{layout,source,expand,delay}},index)=>{
  const rect=origins[index];
  geometryAnimations.push(...morphSkeletonShapes(breathing,layout,source?.layout,styles.shape,{duration:expand,delay,easing:opacityEasing,offsetX:source?source.rect.left-rect.left:0,offsetY:source?source.rect.top-rect.top:0}));
 });
 return {resolved,measured,restoreBatchGeometry};
}
