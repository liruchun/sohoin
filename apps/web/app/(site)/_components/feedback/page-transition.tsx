"use client";

import Link from "next/link";
import {ViewTransition,type ComponentProps,type ReactNode} from "react";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {SiteContent} from "../shell/site-shell";
import {pageTransitionName,readingTransitionTypes} from "./page-route";

/** The host stays mounted, so route changes animate its update, not enter/exit.
 * Only explicit navigation types participate; Suspense and lightbox updates do not. */
export function PageTransition({children,navigation}:{children:ReactNode;navigation:ReactNode}){
 const pathname=usePathname(),search=useSearchParams().toString();
 // Change snapshot identity, never the React key: the retained list keeps its
 // state, while old/new images keep their own pre/post-scroll capture geometry.
 return <>{navigation}<ViewTransition default="none" name={pageTransitionName(pathname,search)} update={{"detail-forward":"reading-forward","detail-back":"reading-back",default:"none"}}>
  <SiteContent>{children}</SiteContent>
 </ViewTransition></>;
}

/** Next owns link navigation, including modifier clicks, prefetch and anchors. */
export function ReadingLink({transitionTypes,href,feedTab=false,...props}:ComponentProps<typeof Link>&{feedTab?:boolean}){
 const pathname=usePathname(),search=useSearchParams();
 return <Link {...props} href={href} transitionTypes={transitionTypes??readingTransitionTypes(pathname,search.get("feed"),typeof href==="string"?href:href.pathname??"",feedTab)}/>;
}

export function useReadingReturn(){
 const router=useRouter();
 // History traversal has no transitionTypes option. Keep Next's native history
 // and scroll restoration; the retained background has a CSS entry fallback.
 return ()=>router.back();
}

export function useReadingPush(){
 const router=useRouter(),pathname=usePathname(),search=useSearchParams();
 return (href:string,options:{scroll?:boolean;feedTab?:boolean}={})=>{
  router.push(href,{scroll:options.scroll,transitionTypes:readingTransitionTypes(pathname,search.get("feed"),href,options.feedTab)});
 };
}
