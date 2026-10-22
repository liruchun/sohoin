import {SKELETON} from "./skeleton-contract";

// Trusted parser-only scripts, shared by the stable launch and streamed slots.
const root=`const r=document.currentScript?.parentElement?.parentElement;if(!r)return;`;
const clock=`r.dataset.revealEntry='server';window.__siteSkeletonLaunchAt??=performance.now();r.__skeletonStartedAt=window.__siteSkeletonLaunchAt;r.style.setProperty('--skeleton-launch-delay',-(performance.now()-r.__skeletonStartedAt)+'ms');`;
export const waitingBootstrap=`(()=>{${root}${clock}})()`;
export const launchBootstrap=`(()=>{${root}${clock}if(document.documentElement.dataset.reduceMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;r.dataset.revealPhase='pending';r.__skeletonTimeout=window.setTimeout(()=>{r.dataset.revealPhase='expired'},${SKELETON.recoveryMs})})()`;
export const contentBootstrap=`(()=>{${root}${clock}if(document.documentElement.dataset.reduceMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;r.dataset.revealPhase='pending';r.__skeletonTimeout=window.setTimeout(()=>{r.dataset.revealPhase='expired'},${SKELETON.recoveryMs})})()`;
