import {prefersReducedMotion} from "@sohoin/ui/theme-preference";

/** Start a client batch after its placeholder has had a chance to paint. */
export function afterPaint(task:()=>void){
 if(typeof requestAnimationFrame!=="function"){setTimeout(task,0);return;}
 requestAnimationFrame(()=>requestAnimationFrame(task));
}

/** Withdraw a batch's "more" row once its cursor ran out. Shrinking the row in
 *  place keeps the content below from jumping when the button unmounts; a batch
 *  that still has a cursor keeps the row as is. Returns the effect cleanup so a
 *  Strict Mode replay restarts the collapse instead of unmounting early. */
export function collapseLoadRow(element:HTMLElement,onDone:()=>void){
 if(prefersReducedMotion()||typeof element.animate!=="function"){onDone();return;}
 const style=getComputedStyle(element),theme=getComputedStyle(document.documentElement);
 const height=element.getBoundingClientRect().height;
 const raw=theme.getPropertyValue("--site-motion-reveal").trim();
 const duration=raw.endsWith("ms")?Number.parseFloat(raw):raw.endsWith("s")?Number.parseFloat(raw)*1000:280;
 const easing=theme.getPropertyValue("--site-ease-reveal").trim()||"cubic-bezier(.4,0,.2,1)";
 const oldHeight=element.style.height,oldOverflow=element.style.overflow;
 element.style.overflow="clip";
 const animation=element.animate([
  {height:`${height}px`,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,opacity:1},
  {height:"0px",paddingTop:"0px",paddingBottom:"0px",opacity:0},
 ],{duration,easing,fill:"both"});
 animation.finished.then(()=>onDone(),()=>{});
 return ()=>{animation.cancel();element.style.height=oldHeight;element.style.overflow=oldOverflow;};
}
