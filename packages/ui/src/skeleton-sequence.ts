import {nextSkeletonPhase,type SkeletonEntry,type SkeletonPhase} from "./skeleton-contract";

export type SkeletonGroup="cover"|"entrance"|"geometry"|"content";
type SequenceAdapter={
 entry:SkeletonEntry;splash:boolean;releaseAt:number;gap:number;minimum:number;
 now:()=>number;begin:()=>number;stopped:()=>boolean;
 waitUntil:(deadline:number)=>Promise<void>;paint:()=>Promise<void>;
 play:(group:SkeletonGroup)=>Promise<void>;phase:(phase:SkeletonPhase)=>void;
 prepareReveal:()=>void;
 finish:(reason:string)=>void;
};

/** The only normal path to content. DOM reads/observers cannot advance this workflow. */
export async function runSkeletonSequence(adapter:SequenceAdapter){
 let phase:SkeletonPhase="pending";
 const move=(next:SkeletonPhase)=>{phase=nextSkeletonPhase(phase,next,adapter.entry);adapter.phase(phase);};
 const alive=()=>!adapter.stopped();
 try{
  await adapter.waitUntil(adapter.releaseAt);if(!alive())return;
  let shownAt:number;
  if(adapter.entry==="server"&&adapter.splash){
   move("splash-out");await adapter.play("cover");if(!alive())return;
   if(adapter.gap>0){await adapter.waitUntil(adapter.now()+adapter.gap);if(!alive())return;}
   shownAt=adapter.begin();
   move("entering");await adapter.play("entrance");if(!alive())return;
  }else shownAt=adapter.begin();
  move("measured");
  await adapter.paint();if(!alive())return;
  if(adapter.entry==="spa"){
   move("expanding");await adapter.play("geometry");if(!alive())return;
  }
  // Only document entry has a minimum hold. SPA hands off as soon as geometry
  // is ready; network placeholders never start a second measured-content timer.
  if(adapter.entry==="server"&&adapter.now()<shownAt+adapter.minimum){
   await adapter.waitUntil(shownAt+adapter.minimum);if(!alive())return;
  }
  adapter.prepareReveal();
  // One final paint covers both completed geometry and any layout refresh.
  await adapter.paint();if(!alive())return;
  move("revealing");await adapter.play("content");if(!alive())return;
  move("ready");adapter.finish("complete");
 }catch{if(alive())adapter.finish("animation-cancelled");}
}
