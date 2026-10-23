"use client";

import {useRouter} from "next/navigation";

export {NavigationLink as ReadingLink} from "../../../_components/navigation/page-motion";

export function useReadingReturn(){
 return useRouter().back;
}

export function useReadingPush(){
 const router=useRouter();
 return (href:string,options:{scroll?:boolean}={})=>router.push(href,{...options,transitionTypes:["page-switch"]});
}
