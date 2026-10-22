/** One owner for cancellable deadlines/frames. Cancellation also releases awaiters. */
export function createSkeletonClock(){
 let stopped=false;
 const pending=new Set<()=>void>();
 const wait=(schedule:(done:()=>void)=>()=>void)=>new Promise<void>(resolve=>{
  if(stopped){resolve();return;}
  let cancel=()=>{};
  const done=()=>{pending.delete(stop);resolve();};
  const stop=()=>{cancel();done();};
  pending.add(stop);cancel=schedule(done);
 });
 return {
  stopped:()=>stopped,
  waitUntil:(deadline:number)=>wait(done=>{const timer=window.setTimeout(done,Math.max(0,deadline-performance.now()));return ()=>window.clearTimeout(timer);}),
  paint:()=>wait(done=>{let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(done);});return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};}),
  stop:()=>{if(stopped)return;stopped=true;for(const cancel of pending)cancel();pending.clear();},
 };
}
