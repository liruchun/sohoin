"use client";
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";

export type CommunityHeaderTopic={slug:string;name:string;description:string;iconUrl:string|null;joined:boolean;authenticated:boolean};
type CommunityHeaderState={topic:CommunityHeaderTopic|null;setTopic:(topic:CommunityHeaderTopic)=>void};
const CommunityHeaderContext=createContext<CommunityHeaderState|null>(null);

/** The page already owns the topic query; publish it to the global Header without
 *  a second request. The last topic is retained so sort changes do not blink. */
export function CommunityHeaderProvider({children}:{children:ReactNode}){
 const [topic,setTopic]=useState<CommunityHeaderTopic|null>(null);
 const value=useMemo(()=>({topic,setTopic}),[topic]);
 return <CommunityHeaderContext.Provider value={value}>{children}</CommunityHeaderContext.Provider>;
}

export function useCommunityHeader(){return useContext(CommunityHeaderContext);}

export function CommunityHeaderRegistration({topic}:{topic:CommunityHeaderTopic}){
 const state=useCommunityHeader();
 const setTopic=state?.setTopic;
 const current=state?.topic;
 useEffect(()=>{
  if(!setTopic)return;
  if(current?.slug===topic.slug&&current.name===topic.name&&current.description===topic.description&&current.iconUrl===topic.iconUrl&&current.joined===topic.joined&&current.authenticated===topic.authenticated)return;
  setTopic({slug:topic.slug,name:topic.name,description:topic.description,iconUrl:topic.iconUrl,joined:topic.joined,authenticated:topic.authenticated});
 },[setTopic,current?.slug,current?.name,current?.description,current?.iconUrl,current?.joined,current?.authenticated,topic.slug,topic.name,topic.description,topic.iconUrl,topic.joined,topic.authenticated]);
 return null;
}
