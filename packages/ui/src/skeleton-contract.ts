/** Public DOM contract: content provides geometry, never animation timing or phases. */
export const SKELETON = Object.freeze({
 root:"[data-reveal-root]",
 item:"[data-skeleton-item]",part:"[data-skeleton-part]",context:"[data-skeleton-context]",
 initial:"[data-skeleton-initial]",resolved:"[data-skeleton-resolved]",splash:"[data-skeleton-splash]",
 preservedRows:2,maxCandidates:30,maxItems:6,maxBatchItems:10,maxParts:12,maxShapes:36,maxRefreshes:2,recoveryMs:8000,
});

export const SKELETON_TIMING = Object.freeze({
 expand:240,fade:280,stagger:40,spaStagger:20,minimum:180,splashMinimum:300,splashExit:240,splashGap:0,entrance:180,icon:900,
});
export const SKELETON_OPACITY_EASING="cubic-bezier(.4,0,.2,1)";
/** Multiple committed fallbacks can belong to the same unconsumed wait. */
export function recordSkeletonWait(wait:{fallbackShown:boolean;fallbackStartedAt?:number;measuredStartedAt?:number},now:number){
 if(!wait.fallbackShown){wait.fallbackStartedAt=now;wait.measuredStartedAt=undefined;}
 wait.fallbackShown=true;
}
/** A parallel overlay is not a new destination for the retained background boundary. */
export function skeletonBoundaryKey(previous:string,destination:string,retainBackground:boolean){
 return retainBackground?previous:destination;
}
/** Only the initial document waits for full layout; subsequent destinations may stream. */
export function skeletonBoundaryEntry(previous:{key:string;documentEntry:boolean},destination:string,retainBackground:boolean){
 const key=skeletonBoundaryKey(previous.key,destination,retainBackground);
 return key===previous.key?previous:{key,documentEntry:false};
}
export type SkeletonTiming={ [K in keyof typeof SKELETON_TIMING]:number };
export type SkeletonEntry="server"|"spa";
export type SkeletonPhase="pending"|"splash-out"|"entering"|"measured"|"expanding"|"revealing"|"ready";

export function milliseconds(value:string,fallback:number){
 const n=parseFloat(value);return Number.isFinite(n)&&n>=0?Math.min(3000,n*(value.trim().endsWith("ms")?1:1000)):fallback;
}

export function shouldAnimateSkeleton({serverEntry,waited,completed,expired,reduced,visible,supported}:{
 serverEntry:boolean;waited:boolean;completed:boolean;expired:boolean;reduced:boolean;visible:boolean;supported:boolean;
}){
 return !completed&&(serverEntry||waited)&&!expired&&!reduced&&visible&&supported;
}

export function rowTiming(index:number,entry:SkeletonEntry,timing:Pick<SkeletonTiming,"expand"|"stagger">&{textStagger?:number}){
 return {
  // Later rows join the ongoing morph, rather than waiting for it to finish.
  geometryDelay:entry==="server"?0:index<SKELETON.preservedRows?0:(index-SKELETON.preservedRows+1)*timing.stagger,
  // Content has its own visible top-to-bottom cadence, independent of geometry.
  textDelay:index*(timing.textStagger??SKELETON_TIMING.stagger),
 };
}

/** ready is terminal; only SPA can expand and only after the measured frame. */
export function nextSkeletonPhase(current:SkeletonPhase,next:SkeletonPhase,entry:SkeletonEntry):SkeletonPhase{
 const allowed:Record<SkeletonPhase,readonly SkeletonPhase[]>={
  pending:entry==="server"?["splash-out","measured"]:["measured"],
  "splash-out":["entering"],entering:["measured"],
  measured:entry==="spa"?["expanding"]:["revealing"],
  expanding:["revealing"],revealing:[],ready:[],
 };
 if(current==="ready"&&next==="ready")return "ready";
 if(current!=="ready"&&next==="ready")return "ready";
 if(!allowed[current].includes(next))throw new Error(`Invalid skeleton phase: ${entry} ${current} -> ${next}`);
 return next;
}
