export type Fold={overflowing:boolean;height:number|null;end?:number;lineTop?:number};
type ReadMeasurement=()=>undefined|(()=>void);

const pending=new Set<ReadMeasurement>();
let frame=0;

const observed=new Map<Element,{read:ReadMeasurement;width:number|null}>();
let observer:ResizeObserver|undefined;

/** ResizeObserver runs after layout. Share its read phase across cards, then
 * commit folds together so one card cannot invalidate the next card's read. */
export function observeTextMeasurement(element:HTMLElement,read:ReadMeasurement){
 observer??=new ResizeObserver(entries=>{
  const reads:ReadMeasurement[]=[];
  for(const entry of entries){
   const record=observed.get(entry.target);
   if(!record||record.width===entry.contentRect.width)continue;
   record.width=entry.contentRect.width;
   if(record.width>0)reads.push(record.read);
  }
  const commits=reads.map(read=>read());
  commits.forEach(commit=>commit?.());
 });
 observed.set(element,{read,width:null});observer.observe(element);
 return ()=>{observer?.unobserve(element);observed.delete(element);};
}

/** All cards read layout before any card commits a new folded height. */
export function scheduleTextMeasurement(read:ReadMeasurement){
 pending.add(read);
 if(!frame)frame=requestAnimationFrame(()=>{
  frame=0;
  const reads=Array.from(pending);pending.clear();
  const commits=reads.map(read=>read());
  commits.forEach(commit=>commit?.());
 });
 return ()=>{
  pending.delete(read);
  if(!pending.size&&frame){cancelAnimationFrame(frame);frame=0;}
 };
}

/** ContentBody supplies text and inline links in document-order paragraphs. */
export function measureRows(body:HTMLElement,after:number,visible:number,actionWidth=0,truncated=false):Fold{
 const origin=body.getBoundingClientRect(),lineHeight=parseFloat(getComputedStyle(body).lineHeight);
 if(!origin.width||!Number.isFinite(lineHeight))return {overflowing:false,height:null};
 // Paragraph gaps can make short text taller, but cannot fit extra rows into
 // this height. Avoid creating ranges for text that is already short enough.
 if(!truncated&&origin.height<=lineHeight*after)return {overflowing:false,height:null};
 const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT),rows:DOMRect[]=[];
 let node:Node|null,visited=0,rectCount=0,bounded=false;
 scan:while((node=walker.nextNode())){
  if(++visited>128){bounded=true;break;}
  if(!node.textContent?.trim())continue;
  const range=document.createRange();range.selectNodeContents(node);
  for(const rect of range.getClientRects()){
   if(++rectCount>256){bounded=true;break scan;}
   if(rect.width<=.5||rect.height<=.5)continue;
   if(!rows.length||Math.abs(rows.at(-1)!.top-rect.top)>1)rows.push(rect);
   if(rows.length>after)break scan;
  }
 }
 if(!truncated&&!bounded&&rows.length<=after)return {overflowing:false,height:null};
 const last=rows[Math.min(visible,rows.length)-1];
 const height=last?Math.ceil(last.top+last.height/2+lineHeight/2-origin.top):lineHeight*visible;
 let end=0;
 if(last){
  // Reserve the action on the final visible line, ending at a whole character.
  // Read only text nodes crossing that line, then binary-search its first glyph.
  walker.currentNode=body;
  let checked=0;
  while((node=walker.nextNode())&&checked++<128){
   const text=node.textContent??"";
   if(!text.length)continue;
   const range=document.createRange();range.selectNodeContents(node);
   if(!Array.from(range.getClientRects()).some(r=>Math.abs(r.top-last.top)<=1))continue;
   let low=0,high=text.length;
   while(low<high){
    const middle=Math.floor((low+high)/2);
    range.setStart(node,middle);range.setEnd(node,middle+1);
    if(range.getBoundingClientRect().top<last.top-1)low=middle+1;else high=middle;
   }
   for(let i=low,letters=0;i<text.length&&letters++<256;){
    const next=i+(text.codePointAt(i)!>0xffff?2:1);
    range.setStart(node,i);range.setEnd(node,next);
    const rect=range.getBoundingClientRect();
    if(rect.top>last.top+1||rect.right>origin.right-actionWidth)break;
    // Keep internal punctuation, but anchor the fold after the last meaningful
    // glyph so trailing punctuation/space does not collide with the ellipsis.
    // Only the clipping boundary changes; expanding still shows the original.
    if(rect.width>0&&!/^[\p{P}\s]+$/u.test(text.slice(i,next)))end=Math.max(end,rect.right-origin.left);
    i=next;
   }
  }
 }
 return {overflowing:true,height,end:Math.min(Math.ceil(end),Math.max(0,origin.width-actionWidth)),lineTop:Math.max(0,height-lineHeight)};
}
