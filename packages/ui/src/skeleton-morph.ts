import {MAX_SHAPES,type SkeletonLayout,type SkeletonShape} from "./skeleton-geometry";

type MorphTiming={duration:number;delay:number;easing:string;offsetX:number;offsetY:number};

function place(element:HTMLElement,shape:SkeletonShape,className:string){
 element.className=className;
 Object.assign(element.style,{left:`${shape.x}px`,top:`${shape.y}px`,width:`${shape.width}px`,height:`${shape.height}px`,borderRadius:shape.radius});
}

/** Match placeholders by semantic role, using stable action keys when present. */
export function morphSkeletonShapes(target:HTMLElement,layout:SkeletonLayout,source:SkeletonLayout|undefined,className:string,timing:MorphTiming):Animation[]{
 const queues=new Map<string,SkeletonShape[]>();
 const matchKey=(shape:SkeletonShape)=>shape.key??shape.role;
 for(const shape of source?.shapes??[])queues.set(matchKey(shape),[...(queues.get(matchKey(shape))??[]),shape]);
 const animations:Animation[]=[],nodes:HTMLElement[]=[];
 const options={duration:timing.duration,delay:timing.delay,easing:timing.easing,fill:"both" as const};
 for(const shape of layout.shapes){
  const node=document.createElement("span");place(node,shape,className);target.append(node);nodes.push(node);
  const previous=queues.get(matchKey(shape))?.shift()??(shape.key?queues.get(shape.role)?.shift():undefined);
  const animation=previous?
   node.animate([
    {transform:`translate(${previous.x+timing.offsetX-shape.x}px, ${previous.y+timing.offsetY-shape.y}px) scale(${previous.width/shape.width}, ${previous.height/shape.height})`},
    {transform:"translate(0px, 0px) scale(1, 1)"},
   ],options):node.animate(shape.role==="block"?
    // A newly introduced media block grows from its resolved top-left instead
    // of inheriting an unrelated placeholder block (for example the card menu).
    [{opacity:0,transform:"scale(.96)"},{opacity:1,transform:"scale(1)"}]:
    [{opacity:0},{opacity:1}],options);
  animation.pause();animation.currentTime=0;animations.push(animation);
 }
 // Any old metadata/line that has no corresponding real shape leaves locally.
 for(const previous of [...queues.values()].flat().slice(0,Math.max(0,MAX_SHAPES-nodes.length))){
  const node=document.createElement("span");place(node,{...previous,x:previous.x+timing.offsetX,y:previous.y+timing.offsetY},className);target.append(node);
  const animation=node.animate([{opacity:1},{opacity:0}],options);animation.pause();animation.currentTime=0;animations.push(animation);
 }
 return animations;
}
