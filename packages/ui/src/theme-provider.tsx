"use client";

import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {parseTheme,themeStorageKey,parseReadingSize,readingStorageKey,motionStorageKey,primaryStorageKey,parsePrimaryColor,preferenceEvent,type ReadingSize,type ThemePreference,type PrimaryColor} from "./theme-preference";

const ThemeContext=createContext<{preference:ThemePreference;setPreference:(value:ThemePreference)=>void;readingSize:ReadingSize;setReadingSize:(value:ReadingSize)=>void;reduceMotion:boolean;setReduceMotion:(value:boolean)=>void;systemReduce:boolean;primary:PrimaryColor;setPrimary:(value:PrimaryColor)=>void}|null>(null);
export function ThemeProvider({children,enabled=true}:{children:ReactNode;enabled?:boolean}){
 const [preference,setPreference]=useState<ThemePreference>("system");
 const [ready,setReady]=useState(false);
 const [readingSize,setReadingSize]=useState<ReadingSize>("standard");
 const [primary,setPrimaryState]=useState<PrimaryColor>("red");
 const [reduceMotion,setReduceMotion]=useState(false),[systemReduce,setSystemReduce]=useState(false);
 useEffect(()=>{
  try{setPreference(parseTheme(localStorage.getItem(themeStorageKey)));setReadingSize(parseReadingSize(localStorage.getItem(readingStorageKey)));setPrimaryState(parsePrimaryColor(localStorage.getItem(primaryStorageKey)));setReduceMotion(localStorage.getItem(motionStorageKey)==="true");}catch{}
  setReady(true);
  const sync=(event:StorageEvent)=>{
   if(event.key===themeStorageKey||event.key===null)setPreference(parseTheme(event.newValue));
   if(event.key===readingStorageKey||event.key===null)setReadingSize(parseReadingSize(event.newValue));
   if(event.key===primaryStorageKey||event.key===null)setPrimaryState(parsePrimaryColor(event.newValue));
   if(event.key===motionStorageKey||event.key===null)setReduceMotion(event.newValue==="true");
  };
  const media=matchMedia("(prefers-reduced-motion: reduce)");
  const syncMotion=()=>setSystemReduce(media.matches);
  syncMotion();media.addEventListener("change",syncMotion);
  window.addEventListener("storage",sync);
  return()=>{window.removeEventListener("storage",sync);media.removeEventListener("change",syncMotion);};
 },[]);
 useEffect(()=>{
  if(!ready)return;
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const sync=()=>document.documentElement.classList.toggle("dark",enabled&&(preference==="dark"||(preference==="system"&&media.matches)));
  sync();
  media.addEventListener("change",sync);
  return()=>media.removeEventListener("change",sync);
 },[preference,enabled,ready]);
 useEffect(()=>{
  if(!ready)return;
  const root=document.documentElement;
  const previousSize=root.style.getPropertyValue("--reading-body-size"),previousMotion=root.dataset.reduceMotion;
  if(enabled&&readingSize!=="standard")root.style.setProperty("--reading-body-size",readingSize==="large"?"1.125rem":"1.25rem");
  else root.style.removeProperty("--reading-body-size");
  if(enabled&&reduceMotion)root.dataset.reduceMotion="true";
  else delete root.dataset.reduceMotion;
  if(previousSize!==root.style.getPropertyValue("--reading-body-size")||previousMotion!==root.dataset.reduceMotion)window.dispatchEvent(new Event(preferenceEvent));
 },[readingSize,reduceMotion,enabled,ready]);
 useEffect(()=>{
  if(!ready)return;
  const root=document.documentElement;
  if(enabled&&primary!=="red")root.dataset.sitePrimary=primary;
  else delete root.dataset.sitePrimary;
 },[primary,enabled,ready]);
 const change=(value:ThemePreference)=>{
  setPreference(value);
  try{localStorage.setItem(themeStorageKey,value);}catch{/* The current tab still works when storage is unavailable. */}
 };
 const saveReading=(value:ReadingSize)=>{setReadingSize(value);try{localStorage.setItem(readingStorageKey,value);}catch{}};
 const savePrimary=(value:PrimaryColor)=>{setPrimaryState(value);try{localStorage.setItem(primaryStorageKey,value);}catch{}};
 const saveMotion=(value:boolean)=>{setReduceMotion(value);try{localStorage.setItem(motionStorageKey,String(value));}catch{}};
 return <ThemeContext.Provider value={{preference,setPreference:change,readingSize,setReadingSize:saveReading,primary,setPrimary:savePrimary,reduceMotion:enabled&&reduceMotion,setReduceMotion:saveMotion,systemReduce}}>{children}</ThemeContext.Provider>;
}
export function useReducedMotionPreference(){const context=useContext(ThemeContext);return Boolean(context?.reduceMotion||context?.systemReduce);}
export function useThemePreference(){
 const context=useContext(ThemeContext);
 if(!context)throw new Error("ThemeProvider is required");
 return context;
}
