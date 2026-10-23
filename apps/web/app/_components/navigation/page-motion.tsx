"use client";

import Link from "next/link";
import {usePathname,useSearchParams} from "next/navigation";
import {ViewTransition,useLayoutEffect,type ComponentProps,type ReactNode} from "react";
import {commitHistoryMotion} from "./history-motion";

const motion={"page-switch":"page-switch",default:"none"};

/** Next owns navigation and scroll. Distinct snapshot names preserve each
 * page's captured position instead of interpolating restored scroll offsets. */
export function PageMotion({children}:{children:ReactNode}){
 const pathname=usePathname(),search=useSearchParams().toString();
 useLayoutEffect(()=>{commitHistoryMotion();},[pathname,search]);
 const name="page-"+Array.from(pathname+"?"+search).map(char=>char.codePointAt(0)!.toString(16)).join("-");
 return <ViewTransition name={name} default="none" enter={motion} exit={motion} update={motion}>{children}</ViewTransition>;
}

export function NavigationLink({href,transitionTypes,...props}:ComponentProps<typeof Link>){
 const pathname=usePathname();
 const target=typeof href==="string"?href:href.pathname??"";
 const local=!target||target.startsWith("#")||target.startsWith("?")||target.split(/[?#]/)[0]===pathname;
 return <Link {...props} href={href} transitionTypes={transitionTypes??(local?[]:["page-switch"])}/>;
}
