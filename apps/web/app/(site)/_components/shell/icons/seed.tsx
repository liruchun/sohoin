import type {ComponentProps} from "react";

/** A plump seed with a rounded body and a short inner contour. */
export function SeedIcon({size=24,strokeWidth=1.75,...props}:ComponentProps<"svg">&{size?:number|string}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
  <path d="M13 3C17 5 20 10 20 14C20 18.5 16.5 21 12 21C7.5 21 4 18 4 14C4 8 9 4 13 3Z"/>
  <path d="M8 15C7.5 12 9 9 11 7"/>
 </svg>;
}
