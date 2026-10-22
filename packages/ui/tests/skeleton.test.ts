import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createRequire,stripTypeScriptTypes} from "node:module";
import {milliseconds,nextSkeletonPhase,rowTiming,shouldAnimateSkeleton,SKELETON_TIMING,SKELETON_OPACITY_EASING,type SkeletonEntry,type SkeletonPhase} from "../src/skeleton-contract";
import {runSkeletonSequence,type SkeletonGroup} from "../src/skeleton-sequence";
import {morphSkeletonShapes} from "../src/skeleton-morph";
import {contentBootstrap,waitingBootstrap,launchBootstrap} from "../src/skeleton-bootstrap";
import {skeletonBoundaryKey,skeletonBoundaryEntry,recordSkeletonWait} from "../src/skeleton-contract";
import {measureSkeleton,skeletonNodes,MAX_SHAPES} from "../src/skeleton-geometry";
import {feedHref,feedView,isFeedPath} from "../../../apps/web/app/(site)/_features/feed/feed-route";
import {pageTransitionName,readingTransitionTypes} from "../../../apps/web/app/(site)/_components/feedback/page-route";
import {SKELETON} from "../src/skeleton-contract";

test("text measurements read every card before committing and cancel unmounted cards",()=>{
 const source=readFileSync(new URL("../../../apps/web/app/(site)/_components/content/card-text-measure.ts",import.meta.url),"utf8").replace(/^export /gm,"");
 let nextFrame=0;
 const frames=new Map<number,()=>void>(),events:string[]=[];
 const schedule=runInNewContext(stripTypeScriptTypes(source)+"\nscheduleTextMeasurement;",{
  requestAnimationFrame:(callback:()=>void)=>{frames.set(++nextFrame,callback);return nextFrame;},
  cancelAnimationFrame:(id:number)=>{frames.delete(id);},
 });
 schedule(()=>{events.push("read first");return ()=>events.push("commit first");});
 const cancel=schedule(()=>{events.push("read unmounted");});cancel();
 schedule(()=>{events.push("read second");return ()=>events.push("commit second");});
 assert.equal(frames.size,1);
 const flush=Array.from(frames.values())[0];frames.clear();flush();
 assert.deepEqual(events,["read first","read second","commit first","commit second"]);
 const cancelLast=schedule(()=>{events.push("stale");});cancelLast();
 assert.equal(frames.size,0,"unmount must cancel the last pending frame");
});

test("text folding skips short text and stops once overflow is known, retaining paragraph gaps",()=>{
 const source=readFileSync(new URL("../../../apps/web/app/(site)/_components/content/card-text-measure.ts",import.meta.url),"utf8").replace(/^export /gm,"");
 let visited=0,ranges=0;
 const nodes=Array.from({length:100},(_,index)=>({textContent:"正文",top:100+index*40}));
 const measure=runInNewContext(stripTypeScriptTypes(source)+"\nmeasureRows;",{
  getComputedStyle:()=>({lineHeight:"24"}),NodeFilter:{SHOW_TEXT:4},
  document:{
   createTreeWalker:()=>({nextNode:()=>nodes[visited++]??null}),
   createRange:()=>{ranges++;let node=nodes[0];return {
    selectNodeContents:(value:typeof node)=>{node=value;},
    getClientRects:()=>[{top:node.top,width:100,height:20}],
   };},
  },
 });
 const body=(height:number)=>({getBoundingClientRect:()=>({top:100,width:400,height})});
 assert.equal(measure(body(48),5,4).overflowing,false);
 assert.equal(ranges,0,"short text must not create a Range");
 const folded=measure(body(4000),5,4);
 assert.equal(folded.overflowing,true);
 assert.equal(folded.height,142,"the fourth row includes actual paragraph gaps");
 assert.equal(visited,6,"later paragraphs cannot affect the fold boundary");
});

test("React owns reading snapshots outside skeleton layers and Next owns navigation",()=>{
 const base="../../../apps/web/app/(site)/";
 const read=(path:string)=>readFileSync(new URL(base+path,import.meta.url),"utf8");
 const boundary=read("_components/feedback/page-transition.tsx");
 assert.match(boundary,/<ViewTransition default="none" name=\{pageTransitionName\(pathname,search\)\} update=/);
 assert.match(boundary,/return \(\)=>router\.back\(\)/);
 assert.match(read("layout.tsx"),/<PageTransition navigation=/);
 assert.match(boundary,/\{navigation\}<ViewTransition/);
 assert.doesNotMatch(boundary,/document\.startViewTransition|setTimeout|new Promise|onNavigate=|popstate|history\.pushState/);
 for(const path of ["_features/content/detail-layer.tsx","_components/feedback/site-transition.tsx"]){
  assert.doesNotMatch(read(path),/DetailPageTransition|<ViewTransition/);
 }
 const css=read("_components/feedback/page-transition.module.css");
 assert.match(css,/reading-forward/);assert.match(css,/reading-back/);
 assert.doesNotMatch(css,/reading-history|data-state=closed/);
 // The CSS pipeline wraps selector lists in :is(), which cannot contain
 // pseudo-elements: animation still runs but its group loses the z-index.
 assert.doesNotMatch(css,/::view-transition-[^\n]*,\s*\n/);
 assert.doesNotMatch(css,/view-transition-(?:new|old)\(site-detail\)/);
});

test("a cached comment return does not inherit a consumed wait from the previous detail",()=>{
 const wait={fallbackShown:false,fallbackStartedAt:undefined as number|undefined};
 recordSkeletonWait(wait,100);
 assert.equal(wait.fallbackStartedAt,100);
 wait.fallbackShown=false; // SkeletonContent consumes the committed wait.
 const eligibility={serverEntry:false,completed:false,expired:false,reduced:false,visible:true,supported:true};
 assert.equal(shouldAnimateSkeleton({...eligibility,waited:wait.fallbackShown}),false);
 recordSkeletonWait(wait,900);
 assert.equal(wait.fallbackStartedAt,900);
 assert.equal(shouldAnimateSkeleton({...eligibility,waited:wait.fallbackShown}),true);
});

test("replacement fallbacks and measured shapes continue the same entrance and breathing clock",()=>{
 const reveal=readFileSync(new URL("../src/skeleton-reveal.tsx",import.meta.url),"utf8");
 const runtime=readFileSync(new URL("../src/skeleton-runtime.ts",import.meta.url),"utf8");
 assert.match(reveal,/recordSkeletonWait\(wait,now\)/);
 assert.match(reveal,/now-\(wait\.fallbackStartedAt\?\?now\)/);
 for(const property of ["--skeleton-entry-delay","--skeleton-breathe-delay"]){
  assert.ok(reveal.includes(property));
  assert.ok(runtime.includes(property));
 }
 for(const path of ["../src/skeleton-reveal.module.css","../../../apps/web/app/(site)/_features/content/discussion.module.css","../../../apps/web/app/(site)/_components/feedback/site-skeleton.module.css"]){
  assert.match(readFileSync(new URL(path,import.meta.url),"utf8"),/animation-delay: var\(--skeleton-breathe-delay, 0ms\)/);
 }
});

test("skeleton scans exclude nested streamed content and fallback before hydration",()=>{
 const outer={},inner={},fallback={};
 const own={closest:()=>outer},comment={closest:()=>inner},placeholder={closest:()=>fallback};
 const container={closest:()=>outer,querySelectorAll:()=>[own,comment,placeholder]} as unknown as HTMLElement;
 for(const selector of [SKELETON.item,SKELETON.part,SKELETON.context,"[data-skeleton-shape]"]){
  assert.deepEqual(skeletonNodes(container,selector),[own]);
 }
 const child={closest:()=>inner,querySelectorAll:()=>[comment]} as unknown as HTMLElement;
 assert.deepEqual(skeletonNodes(child,SKELETON.item),[comment]);
 const source=readFileSync(new URL("../src/skeleton-reveal.tsx",import.meta.url),"utf8");
 assert.equal(source.match(/data-reveal-root=""/g)?.length,2,"content and fallback both declare ownership in SSR markup");
});

test("SSR detail awaits comments while keeping one document reveal",()=>{
 const source=readFileSync(new URL("../../../apps/web/app/(site)/_features/content/content-page.tsx",import.meta.url),"utf8");
 assert.match(source,/await Promise\.all\(\[readSiteContent\(id,type\),Discussion\(\{id,type,query\}\),/);
 assert.doesNotMatch(source,/<(?:SkeletonContent|SkeletonBoundary|Suspense)\b/);
 const css=readFileSync(new URL("../src/skeleton-reveal.css",import.meta.url),"utf8");
 assert.match(css,/@scope \(\[data-reveal-root\]\) to \(\[data-reveal-root\]\)/);
 assert.match(css,/\[data-reveal-entry="server"\]\[data-reveal-phase="pending"\] > \[data-skeleton-initial\] \{ display: none; \}/);
 const shell=readFileSync(new URL("../../../apps/web/app/(site)/_components/shell/site-shell.module.css",import.meta.url),"utf8");
 assert.match(shell,/\.frame:has\(> \[data-skeleton-persistent-splash\][^\n]+\.footer\s*\{\s*visibility: hidden;/);
});
test("skeleton native scopes stay outside CSS Modules compilation",async()=>{
 const moduleCss=readFileSync(new URL("../src/skeleton-reveal.module.css",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/skeleton-reveal.css",import.meta.url),"utf8");
 const source=readFileSync(new URL("../src/skeleton-reveal.tsx",import.meta.url),"utf8");
 assert.match(source,/import "\.\/skeleton-reveal\.css";/);
 assert.match(source,/data-skeleton-placeholder=""/);
 assert.doesNotMatch(moduleCss,/@scope\b|cssmodules-pure-ignore/);
 const hostRequire=createRequire(new URL("../../../apps/web/package.json",import.meta.url));
 const nextRequire=createRequire(hostRequire.resolve("next/package.json"));
 const postcss=nextRequire("postcss");
 const local=nextRequire("next/dist/compiled/postcss-modules-local-by-default");
 const scope=nextRequire("next/dist/compiled/postcss-modules-scope");
 const result=await postcss([local({mode:"pure"}),scope({generateScopedName:(name:string)=>`test_${name}`})]).process(moduleCss,{from:undefined});
 assert.doesNotMatch(result.css,/:local\(/);
 const native=await postcss([]).process(css,{from:undefined});
 let count=0;
 native.root.walkAtRules("scope",(rule:{params:string})=>{
  count++;assert.equal(rule.params,"([data-reveal-root]) to ([data-reveal-root])");
 });
 assert.ok(count>0);
 assert.match(css,/\[data-skeleton-item\]:not\(\[data-skeleton-animated\]\) \{ visibility: hidden; \}/);
 assert.match(css,/> :not\(\[data-skeleton-overlay\]\) \{ opacity: 0 !important; \}/);
});

test("discussion wait is outside the post item faded by the document skeleton",()=>{
 const source=readFileSync(new URL("../../../apps/web/app/(site)/_components/content/detail-panel.tsx",import.meta.url),"utf8");
 assert.match(source,/<\/Panel>\s*\{discussion\}/);
 const detail=readFileSync(new URL("../../../apps/web/app/(site)/_features/content/content-detail.tsx",import.meta.url),"utf8");
 assert.match(detail,/discussion=\{children\}/);
});

for(const viewportHeight of [1000,180,50])test(`SPA preserves both placeholder origins at viewport height ${viewportHeight} with one layout read batch`,()=>{
 const source=readFileSync(new URL("../src/skeleton-layout.ts",import.meta.url),"utf8")
  .replace(/^import .*;\r?\n/gm,"").replace(/^export /gm,"");
 let dirty=false,flushes=0;
 const offsets:{offsetX:number;offsetY:number}[]=[];
 const rect=(top:number,height:number)=>({left:20,top,width:400,height,right:420,bottom:top+height});
 const read=()=>{if(dirty){flushes++;dirty=false;}};
 const node=()=>({
  style:new Proxy({} as Record<string,string>,{set:(target,key,value)=>{dirty=true;target[String(key)]=value;return true;}}),
  closest:()=>null,dataset:{},children:[],className:"",setAttribute:()=>{},append:()=>{dirty=true;},remove:()=>{},
  animate:()=>{dirty=true;return {pause:()=>{},currentTime:0};},
 });
 const items=Array.from({length:3},(_,index)=>({...node(),
  querySelectorAll:()=>[],
  getBoundingClientRect:():ReturnType<typeof rect>=>{read();return rect(items.slice(0,index).reduce((sum,item)=>sum+(item.style.height?parseFloat(item.style.height):200),100),itemHeight(index));},
 }));
 const itemHeight=(index:number):number=>items[index].style.height?parseFloat(items[index].style.height):200;
 const placeholders=[0,1].map(index=>({closest:()=>null,getBoundingClientRect:()=>{read();return rect(100+index*80,80);}}));
 const initial={closest:()=>null,querySelectorAll:(selector:string)=>selector===SKELETON.item?placeholders:[]};
 const resolved={closest:()=>null,querySelectorAll:(selector:string)=>selector===SKELETON.item?items:[]};
 const theme={getPropertyValue:()=>"",position:"static",paddingTop:"0px",paddingBottom:"0px",borderBottomWidth:"0px"};
 const prepare=runInNewContext(stripTypeScriptTypes(source)+"\nprepareSkeletonLayout;",{
  SKELETON,SKELETON_TIMING,SKELETON_OPACITY_EASING,rowTiming,milliseconds,skeletonNodes,
  styles:{overlay:"overlay",breathing:"breathing",shape:"shape"},innerHeight:viewportHeight,
  getComputedStyle:()=>theme,document:{createElement:node},
  measureSkeleton:()=>({width:400,shapes:[{role:"circle",x:0,y:0,width:20,height:20,radius:"50%"}]}),
  morphSkeletonShapes:(_target:unknown,_layout:unknown,_source:unknown,_className:unknown,timing:{offsetX:number;offsetY:number})=>{dirty=true;offsets.push(timing);return [];},
 });
 prepare({element:{querySelector:(selector:string)=>selector===SKELETON.initial?initial:resolved},
  serverEntry:false,serverSplash:false,skeletonEnter:512,stagger:20,theme,
  animations:[],geometryAnimations:[],entranceAnimations:[],chromeAnimations:[],cleanups:[],breathingLayers:new Map(),
 });
 assert.equal(flushes,1,"row setup must not alternate DOM writes and layout reads");
 const expectedRows=viewportHeight===1000?3:2;
 assert.deepEqual(offsets.map(({offsetX,offsetY})=>[offsetX,offsetY]),Array.from({length:expectedRows},()=>[0,0]));
 assert.deepEqual(items.map(item=>item.style.height),["80px","80px",expectedRows===3?"0px":undefined]);
});

test("SSR only measures text and parts for rows within the animation budget",()=>{
 const source=readFileSync(new URL("../src/skeleton-layout.ts",import.meta.url),"utf8")
  .replace(/^import .*;\r?\n/gm,"").replace(/^export /gm,"");
 const detailed:number[]=[];
 const items=Array.from({length:20},(_,index)=>({
  index,closest:()=>null,querySelectorAll:()=>[],
  getBoundingClientRect:()=>({left:0,top:index*40,width:index===0?0:400,height:40,bottom:index*40+40}),
 }));
 const resolved={closest:()=>null,querySelectorAll:(selector:string)=>selector===SKELETON.item?items:[]};
 const theme={getPropertyValue:()=>"",position:"static",paddingTop:"0px",paddingBottom:"0px",borderBottomWidth:"0px"};
 const prepare=runInNewContext(stripTypeScriptTypes(source)+"\nprepareSkeletonLayout;",{
  SKELETON,SKELETON_TIMING,SKELETON_OPACITY_EASING,rowTiming,milliseconds,skeletonNodes,
  innerHeight:1000,getComputedStyle:()=>theme,
  measureSkeleton:(item:{index:number})=>{detailed.push(item.index);return {width:400,shapes:[]};},
 });
 const result=prepare({element:{querySelector:(selector:string)=>selector===SKELETON.resolved?resolved:null},
  serverEntry:true,serverSplash:false,skeletonEnter:512,stagger:80,theme,
  animations:[],geometryAnimations:[],entranceAnimations:[],chromeAnimations:[],cleanups:[],breathingLayers:new Map(),
 });
 assert.equal(result.measured.length,SKELETON.maxItems);
 assert.deepEqual(detailed,[1,2,3,4,5,6],"skip hidden candidates before spending the text measurement budget");
});

test("SSR skeleton rows share one entrance while content keeps its separate stagger",()=>{
 const source=readFileSync(new URL("../src/skeleton-layout.ts",import.meta.url),"utf8")
  .replace(/^import .*;\r?\n/gm,"").replace(/^export /gm,"");
 const scheduled:{label:string;delay:number;duration:number}[]=[];
 const node=(label="overlay")=>({
  style:{},dataset:{},children:[] as unknown[],closest:()=>null,querySelectorAll:()=>[],
  setAttribute:()=>{},append:()=>{},replaceChildren:()=>{},remove:()=>{},
  animate:(_frames:unknown,options:{delay?:number;duration:number})=>{
   scheduled.push({label,delay:options.delay??0,duration:options.duration});
   return {pause:()=>{},currentTime:0};
  },
 });
 const items=[0,1].map(index=>({...node(`row-${index}`),children:[node(`content-${index}`)],
  getBoundingClientRect:()=>({left:20,top:100+index*200,width:400,height:200,bottom:300+index*200}),
 }));
 const resolved={...node("resolved"),querySelectorAll:(selector:string)=>selector===SKELETON.item?items:[]};
 const theme={getPropertyValue:()=>"",position:"static",paddingTop:"0px",paddingBottom:"0px",borderBottomWidth:"0px"};
 const entranceAnimations:unknown[]=[],chromeAnimations:unknown[]=[],animations:unknown[]=[],geometryAnimations:unknown[]=[];
 const sidebar=node("sidebar");
 const prepare=runInNewContext(stripTypeScriptTypes(source)+"\nprepareSkeletonLayout;",{
  SKELETON,SKELETON_TIMING,SKELETON_OPACITY_EASING,rowTiming,milliseconds,skeletonNodes,
  styles:{overlay:"overlay",breathing:"breathing",shape:"shape"},innerHeight:1000,
  getComputedStyle:(target:unknown)=>target===sidebar?{...theme,getPropertyValue:(key:string)=>key==="--skeleton-enter-duration"?"680ms":""}:theme,document:{createElement:()=>node()},
  measureSkeleton:()=>({width:400,shapes:[{role:"circle",x:0,y:0,width:20,height:20,radius:"50%"}]}),
 });
 prepare({element:{closest:()=>({querySelectorAll:(selector:string)=>selector==="[data-skeleton-chrome-group]"?[]:[sidebar]}),querySelector:(selector:string)=>selector===SKELETON.resolved?resolved:null},
  serverEntry:true,serverSplash:true,skeletonEnter:512,stagger:80,theme,
  animations,geometryAnimations,entranceAnimations,chromeAnimations,cleanups:[],breathingLayers:new Map(),
 });
 assert.equal(entranceAnimations.length,1,"only the skeleton surface blocks content reveal");
 assert.equal(chromeAnimations.length,1,"the slower sidebar has an independent animation group");
 assert.deepEqual(scheduled.filter(({label})=>label==="sidebar"),[{label:"sidebar",delay:0,duration:680}]);
 assert.deepEqual(scheduled.filter(({label})=>label==="resolved"),[{label:"resolved",delay:0,duration:512}]);
 assert.deepEqual(scheduled.filter(({label})=>label.startsWith("row-")),[],"rows must not delay skeleton visibility independently");
 assert.deepEqual(scheduled.filter(({label})=>label.startsWith("content-")),[
  {label:"content-0",delay:0,duration:280},{label:"content-1",delay:40,duration:280},
 ]);
 assert.deepEqual(scheduled.filter(({label})=>label==="overlay"),[
  {label:"overlay",delay:0,duration:240},{label:"overlay",delay:40,duration:240},
 ],"each skeleton fades out alongside its content fading in");
 assert.equal(geometryAnimations.length,0,"SSR keeps the natural card heights");
});

test("featured paths preserve list boundaries through detail navigation and encode pagination",()=>{
 const shell={key:"/featured?after=cursor",documentEntry:true};
 assert.equal(feedView("/featured",null),"featured");
 assert.equal(feedView("/",null),"latest");
 assert.equal(feedView("/","articles"),"articles");
 assert.equal(feedHref("featured"),"/featured");
 assert.equal(feedHref("featured","a+b/c="),"/featured?after=a%2Bb%2Fc%3D");
 for(const pathname of ["/","/featured"]){
  assert.equal(isFeedPath(pathname),true);
  assert.equal(skeletonBoundaryEntry(shell,pathname+"?",isFeedPath(pathname)),shell);
 }
 assert.equal(isFeedPath("/featured/unknown"),false);
 assert.equal(skeletonBoundaryEntry(shell,"/threads/abc123def4?",true),shell);
 assert.deepEqual(skeletonBoundaryEntry(shell,"/members/abc123def4?",false),{key:"/members/abc123def4?",documentEntry:false});
});

test("compact author metadata excludes the screen-reader-only date from skeleton geometry",()=>{
 const meta=readFileSync(new URL("../../../apps/web/app/(site)/_components/content/content-meta.tsx",import.meta.url),"utf8");
 assert.match(meta,/<time[^>]*dateTime=\{content\.publishedAt\}[^>]*data-skeleton-part=\{compact\?undefined:"meta"\}/);
});

test("discussion metadata reads only the head, leaving comments inside Suspense",()=>{
 const source=readFileSync(new URL("../../../apps/web/app/(site)/_features/content/discussion.tsx",import.meta.url),"utf8");
 const metadata=source.slice(source.indexOf("export async function discussionMetadata"),source.indexOf("export {DiscussionPending}"));
 assert.match(metadata,/await getSiteContentHead\(id,type\)/);
 assert.doesNotMatch(metadata,/await load\(|getSiteDiscussion\(/);
});

test("reaction layout animation is gated by data, not hydration overflow measurement",()=>{
 const actions=readFileSync(new URL("../../../apps/web/app/(site)/_components/content/content-actions.tsx",import.meta.url),"utf8");
 // Integration contract: visible/expanded updates reposition hidden absolute
 // controls immediately, so skeleton measurement cannot capture a projection.
 assert.match(actions,/const signature=reactions\.map/);
 assert.match(actions,/layoutDependency=\{signature\}/);
 assert.match(actions,/data-skeleton-shape=\{!inPanel&&!collapsed\?"":undefined\}/);
});

test("action skeleton measures SVG-only and counted controls, skips hidden overflow and stays bounded",()=>{
 const rect=(left:number,width:number)=>({left,right:left+width,top:40,bottom:68,width,height:28});
 const control=(left:number,width:number,hidden=false)=>({
  getBoundingClientRect:()=>rect(left,width),closest:(selector:string)=>selector===SKELETON.root?null:hidden?{}:null,
 });
 let controls=[control(10,28),control(42,44),control(90,32,true),control(126,28)];
 const part={closest:()=>null,dataset:{skeletonPart:"actions"},querySelectorAll:()=>controls};
 const item={closest:()=>null,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,right:200,top:0,bottom:100,width:200,height:100}),querySelectorAll:()=>[part]} as unknown as HTMLElement;
 const saved=["document","getComputedStyle"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
 try{
  Object.defineProperty(globalThis,"document",{configurable:true,value:{documentElement:{}}});
  // Parent skeleton visibility must not suppress the controls' measured geometry.
  Object.defineProperty(globalThis,"getComputedStyle",{configurable:true,value:()=>({fontSize:"16px",borderRadius:"8px",visibility:"hidden"})});
  const layout=measureSkeleton(item);
  assert.deepEqual(layout.shapes.map(({role,x,width,height})=>({role,x,width,height})),[
   {role:"action",x:10,width:28,height:28},
   {role:"action",x:42,width:44,height:28},
   {role:"action",x:126,width:28,height:28},
  ]);
  controls=Array.from({length:MAX_SHAPES+10},()=>control(10,28));
  assert.equal(measureSkeleton(item).shapes.length,MAX_SHAPES);
 }finally{
  for(const [key,descriptor] of saved){
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);
   else Reflect.deleteProperty(globalThis,key);
  }
 }
});

test("hidden SPA placeholders retain avatar and action geometry for the measured handoff",()=>{
 const roles=["circle","name","body","body","action","action","action","action"];
 const parts=roles.map((role,index)=>({
  closest:()=>null,dataset:{skeletonPart:role},hasAttribute:(name:string)=>name==="data-skeleton-placeholder",
  getBoundingClientRect:()=>({left:10+index*20,right:26+index*20,top:10,bottom:26,width:16,height:16}),
 }));
 const item={closest:()=>null,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,right:200,top:0,bottom:100,width:200,height:100}),querySelectorAll:()=>parts} as unknown as HTMLElement;
 const saved=["document","getComputedStyle"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
 try{
  Object.defineProperty(globalThis,"document",{configurable:true,value:{documentElement:{}}});
  Object.defineProperty(globalThis,"getComputedStyle",{configurable:true,value:()=>({fontSize:"16px",borderRadius:"8px",visibility:"hidden"})});
  const layout=measureSkeleton(item);
  assert.deepEqual(layout.shapes.map(shape=>shape.role),roles);
  assert.equal(layout.shapes[0].radius,"50%");
  assert.equal(layout.shapes.filter(shape=>shape.role==="action").length,4);
 }finally{
  for(const [key,descriptor] of saved){
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);
   else Reflect.deleteProperty(globalThis,key);
  }
 }
});

test("intercepted comment routes hand the same two placeholders to measured content",()=>{
 const base="../../../apps/web/app/(site)/";
 const read=(path:string)=>readFileSync(new URL(base+path,import.meta.url),"utf8");
 for(const path of ["@detail/(.)threads/[id]/page.tsx","@detail/(.)p/[id]/page.tsx"]){
  const source=read(path);
  assert.match(source,/<DiscussionContent waitKey=\{JSON.stringify\(query\)\}/,path);
  assert.doesNotMatch(source,/<Suspense|<DiscussionPending/);
  assert.match(source,/<Discussion\s/,path);
 }
 const discussion=read("_features/content/discussion.tsx");
 assert.match(discussion,/<PostCard post=\{thread.comment.content\}/);
 assert.doesNotMatch(discussion,/data-skeleton-item=\{validate/);
 const placeholder=read("_features/content/discussion-skeleton.tsx");
 assert.match(placeholder,/<SkeletonContent[^>]+suspend[^>]+fallback=\{<DiscussionSkeleton\/>\}>/);
 const commentRoute=read("@detail/(.)comments/[id]/page.tsx");
 assert.match(commentRoute,/<DetailLayer>/);
 for(const segment of ["p","comments"]){
  const layout=read(`@detail/(.)${segment}/[id]/layout.tsx`);
  assert.match(layout,/<DetailRouteBoundary type=/);
  assert.doesNotMatch(layout,/\basync\b|\bawait\b/);
  assert.match(read(`@detail/(.)${segment}/[id]/loading.tsx`),/<DetailLayer><DiscussionPending\/>/);
 }
 const detail=read("_features/content/detail-layer.tsx");
 assert.match(detail,/useParams<\{id:string\}>\(\)/);
 assert.match(detail,/<DetailEntryBoundary key=\{id\} id=\{id\} type=\{type\}/);
 assert.match(detail,/<SkeletonBoundary scope="body">/);
 assert.match(detail,/<SkeletonBoundary scope="discussion" resetKey=\{query\}>/);
 assert.match(detail,/if\(check.unavailable\|\|ready\)return/);
 assert.doesNotMatch(detail,/if\(check.unavailable\|\|!check.head\)/);
 assert.match(commentRoute,/<DiscussionContent waitKey=/);
 assert.match(read("@detail/(.)comments/[id]/loading.tsx"),/<DiscussionPending\/>/);
 for(const source of [discussion,placeholder]){
  assert.match(source,/<h2>(?:评论|\{page.selected\?"回复":"评论"\})<\/h2>/);
  assert.doesNotMatch(source,/data-skeleton-context/);
 }
 assert.match(placeholder,/\[0,1\]\.map/);
 // Individual placeholder shapes use singular action. The plural actions role
 // only reads data-skeleton-shape descendants and would drop an empty bar.
 assert.match(placeholder,/data-skeleton-part="action" data-skeleton-placeholder=""/);
 assert.doesNotMatch(placeholder,/data-skeleton-part="actions" data-skeleton-placeholder/);
 // Pending content is absolute; measured content returns to normal flow.
 // Keep section spacing inside the box so margin collapse cannot move it.
 const css=read("_features/content/discussion.module.css");
 assert.match(css,/\.section\s*\{\s*@apply pt-14;/);
});

test("SPA suspense keeps its one placeholder slot mounted until measured handoff",()=>{
 const source=readFileSync(new URL("../src/skeleton-reveal.tsx",import.meta.url),"utf8");
 assert.match(source,/<Suspense fallback=\{<SkeletonCommit ready=\{false\}/);
 assert.match(source,/\{children\}<SkeletonCommit ready onCommit=\{commit\}\/>/);
 assert.ok(source.indexOf('data-skeleton-initial=""')<source.indexOf('<Suspense fallback={<SkeletonCommit'));
 assert.equal(source.match(/>\{fallback\}<\/div>/g)?.length,1);
 assert.match(source,/if\(!resolved\)\{/);
 const feed=readFileSync(new URL("../../../apps/web/app/(site)/_features/feed/feed-transition.tsx",import.meta.url),"utf8");
 assert.match(feed,/<SkeletonContent suspend label="正在加载帖子" fallback=\{skeleton\}/);
 assert.doesNotMatch(feed,/<Suspense|<SkeletonFallback/);
 const runtime=readFileSync(new URL("../src/skeleton-runtime.ts",import.meta.url),"utf8");
 assert.match(runtime,/if\(!element\.hasAttribute\("data-skeleton-persistent-initial"\)\)continueEntrance/);
});

test("feed filters retain the page shell while only the list enters SPA mode",()=>{
 const shell={key:"/?",documentEntry:true};
 const firstList={key:'["featured",null]',documentEntry:true};
 assert.equal(skeletonBoundaryEntry(shell,"/?feed=latest",true),shell);
 const latest=skeletonBoundaryEntry(firstList,'["latest",null]',false);
 assert.deepEqual(latest,{key:'["latest",null]',documentEntry:false});
 const returned=skeletonBoundaryEntry(latest,firstList.key,false);
 assert.deepEqual(returned,{key:firstList.key,documentEntry:false});
 assert.equal(skeletonBoundaryEntry(returned,returned.key,false),returned);
 assert.equal(skeletonBoundaryEntry(shell,"/threads/abc123def4?",true),shell);
 assert.deepEqual(skeletonBoundaryEntry(shell,"/members/abc123def4?",false),{key:"/members/abc123def4?",documentEntry:false});
 // Returning from a freshly loaded detail is the first mount of the feed,
 // but not a new document entry. Its list must catch a real wait locally.
 const detailDocument={key:"/threads/abc123def4?",documentEntry:true};
 const home=skeletonBoundaryEntry(detailDocument,"/?",false);
 assert.equal(home.documentEntry,false);
 const firstReturnedList={key:firstList.key,documentEntry:home.documentEntry};
 assert.equal(skeletonBoundaryEntry(firstReturnedList,firstList.key,false).documentEntry,false);
 const ready={serverEntry:false,completed:false,expired:false,reduced:false,visible:true,supported:true};
 assert.equal(shouldAnimateSkeleton({...ready,waited:true}),true);
 assert.equal(shouldAnimateSkeleton({...ready,waited:false}),false);
});

test("route loading and comment Suspense share a wait clock; a later page starts a fresh wait",()=>{
 const wait:{fallbackShown:boolean;fallbackStartedAt?:number}={fallbackShown:false};
 recordSkeletonWait(wait,100);
 recordSkeletonWait(wait,180); // Loading hands off to local Suspense.
 recordSkeletonWait(wait,190); // Strict Mode setup replay.
 assert.equal(wait.fallbackStartedAt,100);
 assert.equal(wait.fallbackShown,true);
 wait.fallbackShown=false; // Resolved SkeletonContent consumes this wait.
 recordSkeletonWait(wait,900); // A later comment page really suspends.
 assert.equal(wait.fallbackStartedAt,900);
});

test("document layout stays unstreamed through hydration and overlays, then enables SPA waits permanently",()=>{
 const initial={key:"/?",documentEntry:true};
 assert.equal(skeletonBoundaryEntry(initial,"/?",false),initial);
 assert.equal(skeletonBoundaryEntry(initial,"/threads/abc123def4?",true),initial);
 const next=skeletonBoundaryEntry(initial,"/?feed=articles",false);
 assert.deepEqual(next,{key:"/?feed=articles",documentEntry:false});
 const back=skeletonBoundaryEntry(next,"/?",false);
 assert.deepEqual(back,{key:"/?",documentEntry:false});
 assert.equal(skeletonBoundaryEntry(back,"/threads/abc123def4?",true),back);
 const spa={key:"/?",documentEntry:false};
 assert.equal(skeletonBoundaryEntry(spa,"/?",false),spa);
});

test("launch icon holds its second sway through the end instead of returning to center",()=>{
 const css=readFileSync(new URL("../../../apps/web/app/(site)/_components/feedback/site-splash.module.css",import.meta.url),"utf8");
 const finalPose=css.match(/100%\s*\{\s*transform:\s*([^;]+);/)?.[1];
 const secondPose=css.match(/70%\s*\{\s*transform:\s*([^;]+);/)?.[1];
 assert.ok(secondPose);assert.equal(finalPose,secondPose);
 assert.match(css,/animation:\s*handshake[^;]+1 both;/);
});

test("detail navigation and comment paging retain the feed boundary; real navigation does not",()=>{
 let key="/?feed=latest&after=cursor";
 for(const destination of ["/threads/abc123def4?","/threads/abc123def4?thread=opaque","/p/abc123def4?"]){
  key=skeletonBoundaryKey(key,destination,true);assert.equal(key,"/?feed=latest&after=cursor");
 }
 assert.equal(skeletonBoundaryKey(key,"/?feed=latest&after=cursor",false),key);
 assert.equal(skeletonBoundaryKey(key,"/?feed=articles",false),"/?feed=articles");
 assert.equal(skeletonBoundaryKey(key,"/threads/abc123def4?",false),"/threads/abc123def4?");
});

function deferred(){
 let resolve!:()=>void,reject!:(reason:Error)=>void;
 const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
// Only microtasks; no real sleep, DOM, browser, server or database required.
async function flush(){for(let index=0;index<30;index++)await Promise.resolve();}
function harness(entry:SkeletonEntry="spa",splash=false,measuredStartedAt?:number){
 const phases:SkeletonPhase[]=[],groups:SkeletonGroup[]=[],deadlines:number[]=[],finishes:string[]=[];
 const gates=new Map<SkeletonGroup,Promise<void>>(),waits=new Map<number,Promise<void>>();
 let now=0,stopped=false,paints=0;
 return {
  phases,groups,deadlines,finishes,gates,waits,setNow:(value:number)=>{now=value;},
  stop:()=>{stopped=true;},paints:()=>paints,
  start:()=>runSkeletonSequence({
   entry,splash,releaseAt:0,gap:SKELETON_TIMING.splashGap,minimum:SKELETON_TIMING.minimum,
   now:()=>now,begin:()=>measuredStartedAt??now,stopped:()=>stopped,
   waitUntil:async deadline=>{deadlines.push(deadline);await waits.get(deadline);now=Math.max(now,deadline);},
   paint:async()=>{paints++;},prepareReveal:()=>{},phase:phase=>phases.push(phase),finish:reason=>finishes.push(reason),
   play:async group=>{groups.push(group);await gates.get(group);},
  }),
 };
}

test("cache/immediate content never starts animation; a committed SPA wait does",()=>{
 const options={serverEntry:false,waited:false,completed:false,expired:false,reduced:false,visible:true,supported:true};
 assert.equal(shouldAnimateSkeleton(options),false);
 assert.equal(shouldAnimateSkeleton({...options,waited:true}),true);
 assert.equal(shouldAnimateSkeleton({...options,serverEntry:true}),true);
 for(const extra of [{completed:true},{expired:true},{reduced:true},{visible:false},{supported:false}]){
  assert.equal(shouldAnimateSkeleton({...options,waited:true,...extra}),false);
 }
});

test("SPA placeholder morph and downward expansion overlap while SSR keeps its stagger",()=>{
 const spa={expand:SKELETON_TIMING.expand,stagger:SKELETON_TIMING.spaStagger};
 const delays=Array.from({length:6},(_,i)=>rowTiming(i,"spa",spa).geometryDelay);
 assert.deepEqual(delays,[0,0,20,40,60,80]);
 assert.equal(delays.slice(2).every(delay=>delay>0&&delay<spa.expand),true);
 assert.deepEqual(Array.from({length:6},(_,i)=>rowTiming(i,"spa",spa).textDelay),[0,40,80,120,160,200]);
 assert.equal(rowTiming(1,"server",SKELETON_TIMING).textDelay,40);
 assert.equal(SKELETON_TIMING.fade,280);
 assert.equal(SKELETON_OPACITY_EASING,"cubic-bezier(.4,0,.2,1)");
 assert.equal(SKELETON_TIMING.splashGap,0);
 assert.equal(milliseconds("0ms",300),0);
 assert.equal(milliseconds(".4s",0),400);
 assert.equal(milliseconds("",180),180);
});

test("changing geometry stagger cannot make content appear all at once",()=>{
 const timings=Array.from({length:4},(_,i)=>rowTiming(i,"spa",{expand:320,stagger:0,textStagger:80}));
 assert.deepEqual(timings.map(t=>t.geometryDelay),[0,0,0,0]);
 assert.deepEqual(timings.map(t=>t.textDelay),[0,80,160,240]);
});

test("phase gate prevents early text, SSR expansion and restarting ready",()=>{
 assert.throws(()=>nextSkeletonPhase("measured","revealing","spa"));
 assert.throws(()=>nextSkeletonPhase("measured","expanding","server"));
 assert.throws(()=>nextSkeletonPhase("pending","splash-out","spa"));
 assert.throws(()=>nextSkeletonPhase("ready","pending","spa"));
 assert.equal(nextSkeletonPhase("expanding","ready","spa"),"ready");
});

test("no content starts until ALL geometry completes, regardless of row count or size",async()=>{
 const app=harness(),first=deferred(),last=deferred(),content=deferred();
 app.gates.set("geometry",Promise.all([first.promise,last.promise]).then(()=>{}));app.gates.set("content",content.promise);
 const running=app.start();await flush();
 assert.deepEqual(app.phases,["measured","expanding"]);
 first.resolve();await flush();assert.equal(app.groups.includes("content"),false);
 last.resolve();await flush();assert.deepEqual(app.groups,["geometry","content"]);
 assert.equal(app.phases.at(-1),"revealing");assert.deepEqual(app.finishes,[]);
 content.resolve();await running;assert.equal(app.phases.at(-1),"ready");assert.deepEqual(app.finishes,["complete"]);
 assert.deepEqual(app.deadlines,[0]); // SPA has no measured-content hold.
 assert.equal(app.paints(),2);
});

test("SSR cover exits fully before entrance; SSR never animates card height",async()=>{
 const app=harness("server",true),cover=deferred(),entrance=deferred(),lastSkeleton=deferred();
 app.gates.set("cover",cover.promise);app.gates.set("entrance",Promise.all([entrance.promise,lastSkeleton.promise]).then(()=>{}));
 const running=app.start();await flush();assert.deepEqual(app.phases,["splash-out"]);
 assert.deepEqual(app.groups,["cover"]);
 cover.resolve();await flush();assert.deepEqual(app.phases,["splash-out","entering"]);
 assert.equal(app.groups.includes("content"),false);
 entrance.resolve();await flush();assert.equal(app.groups.includes("content"),false);
 assert.equal(app.phases.at(-1),"entering");
 lastSkeleton.resolve();await running;
 assert.deepEqual(app.groups,["cover","entrance","content"]);
 assert.deepEqual(app.phases,["splash-out","entering","measured","revealing","ready"]);
 assert.deepEqual(app.deadlines,[0,SKELETON_TIMING.minimum]); // The mock entrance does not advance time.
});

for(const stage of ["cover","entrance","geometry","content"] as const){
 test(`interruption at ${stage} cannot revive an old sequence`,async()=>{
  const app=harness(stage==="cover"||stage==="entrance"?"server":"spa",true),gate=deferred();
  app.gates.set(stage,gate.promise);const running=app.start();await flush();
  const before=[...app.phases];app.stop();gate.resolve();await running;
  assert.deepEqual(app.phases,before);assert.deepEqual(app.finishes,[]);
 });
}

test("empty animation groups still paint and complete in order",async()=>{
 const app=harness();await app.start();
 assert.deepEqual(app.phases,["measured","expanding","revealing","ready"]);
 assert.equal(app.paints(),2);assert.deepEqual(app.finishes,["complete"]);
});

for(const entry of ["server","spa"] as const){
 test(`${entry}: fast skeleton only holds on document entry`,async()=>{
  const app=harness(entry,entry==="server"),minimum=deferred();
  app.waits.set(SKELETON_TIMING.minimum,minimum.promise);
  const running=app.start();await flush();
  assert.equal(app.groups.includes("content"),entry==="spa");
  assert.equal(app.deadlines.at(-1),entry==="server"?SKELETON_TIMING.minimum:0);
  minimum.resolve();await running;
  assert.equal(app.groups.at(-1),"content");
 });
 test(`${entry}: slow skeleton must finish after the minimum, without a second hold`,async()=>{
  const app=harness(entry,entry==="server"),geometry=deferred();
  app.gates.set(entry==="server"?"entrance":"geometry",geometry.promise);
  const running=app.start();await flush();
  app.setNow(900);await flush();
  assert.equal(app.groups.includes("content"),false);
  geometry.resolve();await running;
  assert.deepEqual(app.deadlines,[0]);
  assert.equal(app.groups.at(-1),"content");
 });
}

test("unmount during the shared minimum cannot reveal old content",async()=>{
 const app=harness("server"),minimum=deferred();app.waits.set(SKELETON_TIMING.minimum,minimum.promise);
 const running=app.start();await flush();app.stop();minimum.resolve();await running;
 assert.equal(app.groups.includes("content"),false);assert.deepEqual(app.finishes,[]);
});

test("loading-to-Page handoff retains the measured deadline instead of starting another minimum",async()=>{
 const app=harness("spa",false,0);app.setNow(350);
 await app.start();
 assert.deepEqual(app.deadlines,[0]);
 const wait={fallbackShown:true,fallbackStartedAt:10,measuredStartedAt:100};
 recordSkeletonWait(wait,350);
 assert.equal(wait.measuredStartedAt,100);
 wait.fallbackShown=false;
 recordSkeletonWait(wait,900);
 assert.equal(wait.measuredStartedAt,undefined);
 assert.equal(wait.fallbackStartedAt,900);
});

test("feed tab directions stay list-local, while reading links use the page transition",()=>{
 assert.deepEqual(readingTransitionTypes("/",null,"/featured",true),["feed-forward"]);
 assert.deepEqual(readingTransitionTypes("/featured",null,"/",true),["feed-back"]);
 assert.deepEqual(readingTransitionTypes("/","featured","/",true),["feed-back"]);
 assert.deepEqual(readingTransitionTypes("/","featured","/featured",true),[]);
 assert.deepEqual(readingTransitionTypes("/",null,"/",true),[]);
 assert.deepEqual(readingTransitionTypes("/",null,"/threads/abc1234567"),["detail-forward"]);
 assert.deepEqual(readingTransitionTypes("/threads/abc1234567",null,"/featured",true),["detail-forward"]);
 assert.deepEqual(readingTransitionTypes("/",null,"/featured"),["detail-forward"]);
});

test("route snapshots keep separate geometry across scroll restoration without identity collisions",()=>{
 const routes=[["/",""],["/featured",""],["/","feed=featured"],["/threads/abc1234567",""],["/threads/abc1234567","commentsBefore=cursor"],["/members/abc1234567",""]];
 const names=routes.map(([pathname,search])=>pageTransitionName(pathname,search));
 assert.equal(new Set(names).size,routes.length);
 for(const name of names)assert.match(name,/^site-page-[a-f0-9-]+$/);
 assert.equal(pageTransitionName("/",""),names[0]);
 assert.notEqual(pageTransitionName("/","a=bc"),pageTransitionName("/","ab=c"));
});

test("failed geometry recovers instead of revealing through a broken barrier",async()=>{
 const app=harness(),gate=deferred();app.gates.set("geometry",gate.promise);
 const running=app.start();await flush();gate.reject(new Error("cancelled"));await running;
 assert.equal(app.groups.includes("content"),false);assert.deepEqual(app.finishes,["animation-cancelled"]);
});

test("changed text/media geometry maps by role and introduces media as skeleton only",()=>{
 const nodes:{style:Record<string,string>;frames:Keyframe[];paused:boolean;className:string}[]=[];
 const original=Object.getOwnPropertyDescriptor(globalThis,"document");
 Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:()=>{
  const node={style:{},frames:[] as Keyframe[],paused:false,className:"",animate(frames:Keyframe[]){
   node.frames=frames;return {pause:()=>{node.paused=true;},currentTime:0};
  }};nodes.push(node);return node;
 }}});
 try{
  const shape=(role:string,x:number,y:number,width:number,height:number)=>({role,x,y,width,height,radius:"8px"});
  const target={append:()=>{}} as unknown as HTMLElement;
  morphSkeletonShapes(target,{width:640,shapes:[shape("body",70,20,50,8),shape("block",70,40,500,300)]},
   {width:640,shapes:[shape("body",10,12,100,8),shape("meta",400,12,48,8)]},"shape",
   {duration:400,delay:0,easing:"linear",offsetX:0,offsetY:0});
  assert.equal(nodes[0].style.width,"50px");
  assert.equal(nodes[0].frames[0].transform,"translate(-60px, -8px) scale(2, 1)");
  assert.deepEqual(nodes[1].frames,[{opacity:0,transform:"scale(.96)"},{opacity:1,transform:"scale(1)"}]);
  assert.equal(nodes[1].style.height,"300px");
  assert.deepEqual(nodes[2].frames,[{opacity:1},{opacity:0}]);
  assert.equal(nodes.every(node=>node.paused),true);
 }finally{
  if(original)Object.defineProperty(globalThis,"document",original);else Reflect.deleteProperty(globalThis,"document");
 }
});

function parserHarness(reduced=false){
 let time=10;
 const timers:(()=>void)[]=[],window={setTimeout:(fn:()=>void)=>{timers.push(fn);return timers.length;}};
 function node(tagName="DIV"){
  const properties=new Map<string,string>();let writes=0;
  return {tagName,dataset:{} as Record<string,string>,properties,writes:()=>writes,
   style:{setProperty:(name:string,value:string)=>{writes++;properties.set(name,value);}},
   parentElement:{querySelector:(_selector:string):unknown=>launch},__skeletonStartedAt:undefined as number|undefined};
 }
 const launch=node();
 return {launch,timers,node,parse:(source:string,target:ReturnType<typeof node>,at:number)=>{
  time=at;runInNewContext(source,{window,document:{currentScript:{parentElement:{parentElement:target}}},performance:{now:()=>time},matchMedia:()=>({matches:reduced})});
 }};
}

for(const tagName of ["DIV","MAIN"]){
test(`cold streamed ${tagName} content shares the launch clock without rewriting the persistent SVG clock`,()=>{
 const page=parserHarness(),fallback=page.node(),content=page.node(tagName);
 page.parse(launchBootstrap,page.launch,10);
 page.parse(waitingBootstrap,fallback,430);
 page.parse(contentBootstrap,content,920);
 assert.equal(page.launch.__skeletonStartedAt,10);
 assert.equal(fallback.__skeletonStartedAt,10);assert.equal(content.__skeletonStartedAt,10);
 assert.equal(page.launch.properties.get("--skeleton-launch-delay"),"0ms");
 assert.equal(page.launch.writes(),1); // No seek/reset when streamed roots arrive.
 assert.equal(content.properties.get("--skeleton-launch-delay"),"-910ms");
 assert.equal(page.launch.dataset.revealPhase,"pending");
 assert.equal(content.dataset.revealPhase,"pending");
 page.timers[1]();
 assert.equal(content.dataset.revealPhase,"expired");
});
}

test("hydration failure recovers both real content and the persistent cover",()=>{
 const page=parserHarness(),content=page.node();
 page.parse(launchBootstrap,page.launch,10);assert.equal(page.timers.length,1);
 page.parse(contentBootstrap,content,1500);assert.equal(page.timers.length,2);
 page.timers[0]();
 assert.equal(page.launch.dataset.revealPhase,"expired");
 assert.equal(content.dataset.revealPhase,"pending");
 page.timers[1]();
 assert.equal(content.dataset.revealPhase,"expired");
});

test("layout splash recovers even when no content boundary arrives",()=>{
 const page=parserHarness();
 page.parse(launchBootstrap,page.launch,10);
 page.timers[0]();
 assert.equal(page.launch.dataset.revealPhase,"expired");
});

test("reduced motion does not arm a launch or hydration animation wait",()=>{
 const page=parserHarness(true),content=page.node();
 page.parse(launchBootstrap,page.launch,10);page.parse(contentBootstrap,content,500);
 assert.equal(page.launch.dataset.revealPhase,undefined);assert.equal(page.timers.length,0);
});
