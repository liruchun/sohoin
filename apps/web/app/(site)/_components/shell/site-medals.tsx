"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {useTranslations} from "next-intl";
import {useToast} from "@sohoin/ui/toast";
import type {MedalCollection,WornBadge} from "@sohoin/extension-api/badges";

type MedalState={collection:MedalCollection|null;pending:boolean;wear:(badge:WornBadge|null)=>Promise<void>;loadMore:()=>Promise<void>;check:()=>Promise<void>};
const MedalContext=createContext<MedalState|null>(null);
export function useSiteMedals(){return useContext(MedalContext);}

export function SiteMedalsProvider({initial,children}:{initial:MedalCollection|null;children:ReactNode}){
 const [collection,setCollection]=useState(initial),[pending,setPending]=useState(false);
 const lock=useRef(false),t=useTranslations("Rewards"),{notify}=useToast();
 const account=useRef(collection);account.current=collection;
 const check=useCallback(async()=>{
  if(!account.current||lock.current)return;
  lock.current=true;setPending(true);
  try{
   const response=await fetch("/api/v1/account/medals/check",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error?.message||t("loadFailed"));
   setCollection(data.collection);
  }catch(error){notify({variant:"error",message:error instanceof Error?error.message:t("loadFailed")});}
  finally{lock.current=false;setPending(false);}
 },[notify,t]);
 useEffect(()=>{if(!lock.current)setCollection(initial);},[initial]);
 async function read(before?:string):Promise<MedalCollection>{
  const response=await fetch("/api/v1/account/medals"+(before?"?before="+encodeURIComponent(before):""),{cache:"no-store"});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error?.message||t("loadFailed"));
  return data;
 }
 async function wear(badge:WornBadge|null){
  if(!collection||lock.current)return;
  lock.current=true;setPending(true);
  const previous=collection;
  setCollection({...collection,worn:badge});
  try{
   const response=await fetch("/api/v1/account/medals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({badgeKey:badge?.key??null,revision:previous.revision})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error?.message||t("wearFailed"));
   setCollection(current=>current?{...current,worn:badge,revision:result.revision}:current);
  }catch(error){
   setCollection(previous);
   notify({variant:"error",message:error instanceof Error?error.message:t("wearFailed")});
   // A conflict or ambiguous network failure is reconciled against the saved account state.
   try{setCollection(await read());}catch{/* Keep the last confirmed state; never claim a failed save succeeded. */}
  }finally{lock.current=false;setPending(false);}
 }
 async function loadMore(){
  if(!collection?.nextCursor||lock.current)return;
  lock.current=true;setPending(true);
  try{
   const page=await read(collection.nextCursor);
   setCollection(current=>current?{...page,items:[...new Map([...current.items,...page.items].map(item=>[item.key,item])).values()]}:page);
  }catch(error){notify({variant:"error",message:error instanceof Error?error.message:t("loadFailed")});}
  finally{lock.current=false;setPending(false);}
 }
 return <MedalContext.Provider value={{collection,pending,wear,loadMore,check}}>{children}</MedalContext.Provider>;
}
