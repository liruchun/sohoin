"use client";

import {createContext,useCallback,useContext,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {useSelectedLayoutSegments} from "next/navigation";
import type {SiteContent} from "@sohoin/core/server";
import type {PublicSiteSettings} from "@sohoin/extension-api/settings";
import styles from "./detail-layer.module.css";
import type {ReactionOption} from "../../_components/content/content-actions";

type Registry={items:Map<string,SiteContent>;opened:Map<string,SiteContent>;cache:Map<string,SiteContent>};
type DetailData={registry:Registry;brand:string;logo:PublicSiteSettings["logo"];active:boolean;reactionOptions:ReactionOption[];revision:number;invalidate:()=>void};
const Context=createContext<DetailData|null>(null);
export function DetailDataProvider({brand,logo,children,reactionOptions}:{brand:string;logo:PublicSiteSettings["logo"];children:ReactNode;reactionOptions:ReactionOption[]}){
 const registry=useRef<Registry>({items:new Map(),opened:new Map(),cache:new Map()});
 const [revision,setRevision]=useState(0);
 const invalidate=useCallback(()=>{registry.current.opened.clear();registry.current.cache.clear();registry.current.items.clear();setRevision(value=>value+1);},[]);
 const segments=useSelectedLayoutSegments("detail");
 const active=segments.some(segment=>segment==="(.)p"||segment==="(.)threads"||segment==="(.)comments");
 useLayoutEffect(()=>{if(!active)registry.current.opened.clear();},[active]);
 const value=useMemo(()=>({registry:registry.current,brand,logo,active,reactionOptions,revision,invalidate}),[brand,logo,active,reactionOptions,revision,invalidate]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
/** Only records opened in the current detail flow survive list unmounts; never pages or DOM. */
export function rememberDetail(registry:Registry,item:SiteContent){
 const key=item.type+":"+item.publicId;
 registry.opened.delete(key);registry.opened.set(key,item);
 while(registry.opened.size>32)registry.opened.delete(registry.opened.keys().next().value!);
}
export function useDetailData(){const value=useContext(Context);if(!value)throw new Error("Missing detail provider");return value;}
export function DetailBackground({children,active:forced}:{children:ReactNode;active?:boolean}){
 const {active}=useDetailData();
 const covered=forced??active;
 return <div className={styles.background} data-covered={covered} inert={covered||undefined}>{children}</div>;
}

/** Current lists register; a bounded cache keeps clicked cards usable after the
 *  list unmounts, so SPA details reuse the body instead of fetching it again. */
export function FeedDetailData({items,children,label,className,id}:{items:SiteContent[];children:ReactNode;label:string;className:string;id?:string}){
 const {registry}=useDetailData();
 useLayoutEffect(()=>{
  for(const item of items)registry.items.set(item.type+":"+item.publicId,item);
  return ()=>{for(const item of items){const key=item.type+":"+item.publicId;if(registry.items.get(key)===item)registry.items.delete(key);registry.cache.delete(key);registry.cache.set(key,item);}while(registry.cache.size>32)registry.cache.delete(registry.cache.keys().next().value!);};
 },[items,registry]);
 return <section id={id} aria-label={label} className={className}>{children}</section>;
}
