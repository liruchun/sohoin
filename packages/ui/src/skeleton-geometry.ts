import {SKELETON} from "./skeleton-contract";
/** Bounded, one-shot layout reads. No HTML/text is copied into the overlay. */
export type SkeletonShape={role:string;key?:string;x:number;y:number;width:number;height:number;radius:string};
export type SkeletonLayout={width:number;shapes:SkeletonShape[]};
export const MAX_REVEAL_ITEMS=SKELETON.maxItems;
export const MAX_SHAPES=SKELETON.maxShapes;

/** Nested streamed boundaries own their DOM even before they hydrate. */
export function skeletonNodes(container:HTMLElement,selector:string):HTMLElement[]{
 const owner=container.closest(SKELETON.root);
 return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(node=>node.closest(SKELETON.root)===owner);
}

export function measureSkeleton(item:HTMLElement):SkeletonLayout{
 const origin=item.getBoundingClientRect();
 const offsetX=origin.left+item.clientLeft,offsetY=origin.top+item.clientTop;
 const shapes:SkeletonShape[]=[];
 let textHeight:number|undefined;
 const parts=skeletonNodes(item,SKELETON.part).slice(0,SKELETON.maxParts);
 // Long detail text must not consume the budget reserved for its action row.
 const actionBudget=Math.min(MAX_SHAPES,parts.filter(part=>part.dataset.skeletonPart==="actions").reduce((count,part)=>count+skeletonNodes(part,"[data-skeleton-shape]").filter(control=>!control.closest('[inert], [hidden], [aria-hidden="true"]')).length,0));
 const add=(rect:DOMRect,role:string,radius:string,key?:string)=>{
  const left=Math.max(rect.left,origin.left),right=Math.min(rect.right,origin.right);
  const top=Math.max(rect.top,origin.top),bottom=Math.min(rect.bottom,origin.bottom);
  if(right-left<1||bottom-top<1||shapes.length>=MAX_SHAPES)return;
  if(role!=="action"&&shapes.filter(shape=>shape.role!=="action").length>=MAX_SHAPES-actionBudget)return;
  shapes.push({role,key,x:left-offsetX,y:top-offsetY,width:right-left,height:bottom-top,radius});
 };
 for(const part of parts){
  if(shapes.length>=MAX_SHAPES)break;
  const role=part.dataset.skeletonPart??"block";
  if(role==="actions"){
   // Explicit visible controls only: SVG-only buttons have no text ranges.
   // Do not inspect inherited visibility: the skeleton gate hides real content.
   for(const control of skeletonNodes(part,"[data-skeleton-shape]").slice(0,MAX_SHAPES)){
    if(control.closest('[inert], [hidden], [aria-hidden="true"]'))continue;
    add(control.getBoundingClientRect(),"action",getComputedStyle(control).borderRadius,control.dataset?.skeletonAction);
   }
   continue;
  }
  if(role==="circle"||role==="block"||part.hasAttribute("data-skeleton-placeholder")){
   add(part.getBoundingClientRect(),role,role==="circle"?"50%":getComputedStyle(part).borderRadius,part.dataset.skeletonAction);
   continue;
  }
  const walker=document.createTreeWalker(part,NodeFilter.SHOW_TEXT);
  // Share the placeholder's rem-based band height. Range still supplies each
  // real line's width and vertical center, not a different thickness per font.
  if(textHeight===undefined){
   const rootStyle=getComputedStyle(document.documentElement);
   textHeight=parseFloat(rootStyle.getPropertyValue("--site-skeleton-text-height"))*parseFloat(rootStyle.fontSize);
  }
  const lines:{left:number;right:number;top:number;bottom:number}[]=[];
  const bounds=part.getBoundingClientRect();
  let count=0,node:Node|null;
  while((node=walker.nextNode())&&count++<32){
   if(node.parentElement?.closest(SKELETON.root)!==item.closest(SKELETON.root))continue;
   if(!node.textContent?.trim())continue;
   const range=document.createRange();range.selectNodeContents(node);
   for(const rect of Array.from(range.getClientRects()).slice(0,MAX_SHAPES)){
    if(rect.width<1||rect.height<1||rect.top>=bounds.bottom||rect.bottom<=bounds.top||rect.left>=bounds.right||rect.right<=bounds.left)continue;
    const line=lines.find(line=>Math.abs(line.top-rect.top)<2);
    if(line){line.left=Math.min(line.left,rect.left);line.right=Math.max(line.right,rect.right);line.bottom=Math.max(line.bottom,rect.bottom);}
    else if(lines.length<MAX_SHAPES)lines.push({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});
   }
  }
  for(const line of lines){
   const height=textHeight,top=line.top+(line.bottom-line.top-height)/2;
   // Metadata bars keep a small radius; body lines stay pill-shaped. A full
   // radius on short name/date bars turns them into ellipses during the morph.
   add(new DOMRect(line.left,top,line.right-line.left,height),role,role==="body"?"9999px":"0.25rem");
  }
 }
 return {width:origin.width,shapes};
}
