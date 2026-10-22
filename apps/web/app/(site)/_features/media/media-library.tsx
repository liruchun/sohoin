"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {MAX_VIDEO_BYTES,videoAccept} from "@sohoin/extension-api/video";
import type {MemberMedia} from "@sohoin/extension-api/profiles";
export type LocalMedia=MemberMedia;
export type PendingUpload={id:string;file:File;preview:string|null;progress:number;status:'queued'|'uploading'|'processing'|'failed'|'complete';result?:LocalMedia};
export type MediaKind="all"|"image"|"video";
type Library={kind:MediaKind;filter:MediaKind;setFilter:(kind:MediaKind)=>void;items:LocalMedia[];pageIds:string[];uploads:PendingUpload[];dismissUpload:(id:string)=>void;loading:boolean;error:string;reload:()=>Promise<void>;hasMore:boolean;loadMore:()=>Promise<void>;add:(file:File)=>Promise<LocalMedia>;addMany:(files:File[],onUploaded?:(item:LocalMedia)=>void)=>Promise<LocalMedia[]>};
const Context=createContext<Library|null>(null);
export const imageAccept="image/png,image/jpeg,image/webp";

export function MediaLibraryProvider({children,kind="image"}:{children:ReactNode;kind?:MediaKind}){
 const [items,setItems]=useState<LocalMedia[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const alive=useRef(true),generation=useRef(0);
 const [filter,setFilter]=useState<MediaKind>(kind);
 const queryKind=kind==='all'?filter:kind;
 const [pageIds,setPageIds]=useState<string[]>([]);
 const [uploads,setUploads]=useState<PendingUpload[]>([]);
 const previews=useRef(new Map<string,string>()),requests=useRef(new Set<XMLHttpRequest>());
 const [next,setNext]=useState<string|null>(null),pageLock=useRef(false);
 const reload=useCallback(async()=>{
  const version=++generation.current;setLoading(true);setError("");setPageIds([]);
  try{const response=await fetch('/api/v1/account/media?kind='+queryKind,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error?.message);if(alive.current&&version===generation.current){setNext(data.next);setPageIds(data.items.map((item:LocalMedia)=>item.id));setItems(current=>Array.from(new Map([...data.items,...current].map((item:LocalMedia)=>[item.id,item])).values()));}}
  catch(error){if(alive.current&&version===generation.current)setError(error instanceof Error&&error.message?error.message:'loadError');}
  finally{if(alive.current&&version===generation.current)setLoading(false);}
 },[queryKind]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;for(const request of requests.current)request.abort();requests.current.clear();for(const url of previews.current.values())URL.revokeObjectURL(url);previews.current.clear();};},[]);
 async function loadMore(){
  if(!next||pageLock.current||loading)return;const version=generation.current;pageLock.current=true;setLoading(true);setError('');
  try{const response=await fetch('/api/v1/account/media?kind='+queryKind+'&before='+encodeURIComponent(next),{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error?.message);if(alive.current&&version===generation.current){setNext(data.next);setPageIds(current=>Array.from(new Set([...current,...data.items.map((item:LocalMedia)=>item.id)])));setItems(current=>Array.from(new Map([...current,...data.items].map((item:LocalMedia)=>[item.id,item])).values()));}}
  catch(error){if(alive.current&&version===generation.current)setError(error instanceof Error?error.message:'loadError');}
  finally{pageLock.current=false;if(alive.current&&version===generation.current)setLoading(false);}
 }
 function dismissUpload(id:string){
  const url=previews.current.get(id);if(url)URL.revokeObjectURL(url);previews.current.delete(id);
  if(alive.current)setUploads(current=>current.filter(item=>item.id!==id));
 }
 function updateUpload(id:string,patch:Partial<PendingUpload>){if(alive.current)setUploads(current=>current.map(item=>item.id===id?{...item,...patch}:item));}
 function send(upload:PendingUpload){
  return new Promise<LocalMedia>((resolve,reject)=>{
   const request=new XMLHttpRequest();requests.current.add(request);
   const fail=()=>reject(new Error('uploadFailed'));
   request.upload.onprogress=event=>{if(event.lengthComputable)updateUpload(upload.id,{progress:Math.min(100,Math.floor(event.loaded/event.total*100))});};
   request.upload.onload=()=>updateUpload(upload.id,{status:'processing',progress:100});
   request.onload=()=>{
    const data=request.response;
    if(request.status<200||request.status>=300||!data?.id){reject(new Error(data?.error?.code==='MEDIA_LIBRARY_FULL'?'libraryFull':data?.error?.message||'uploadFailed'));return;}
    resolve(data as LocalMedia);
   };
   request.onerror=fail;request.ontimeout=fail;request.onabort=fail;
   request.onloadend=()=>requests.current.delete(request);
   request.open('POST',upload.file.type.startsWith('video/')?'/api/v1/account/videos':'/api/v1/account/media');
   request.responseType='json';request.timeout=300000;
   request.setRequestHeader('Content-Type',upload.file.type);request.setRequestHeader('X-File-Name',encodeURIComponent(upload.file.name));
   updateUpload(upload.id,{status:'uploading'});
   request.send(upload.file);
  });
 }
 async function addMany(files:File[],onUploaded?:(item:LocalMedia)=>void){
  for(const file of files){const video=file.type.startsWith('video/');if(!(kind==='all'?imageAccept+','+videoAccept:kind==='video'?videoAccept:imageAccept).split(',').includes(file.type)||file.size>(video?MAX_VIDEO_BYTES:5*1024*1024)||!file.size)throw new Error(video?'videoError':'imageError');}
  const queued=files.map(file=>{
   const id=crypto.randomUUID(),preview=file.type.startsWith('image/')?URL.createObjectURL(file):null;
   if(preview)previews.current.set(id,preview);
   return {id,file,preview,progress:0,status:'queued' as const};
  });
  setUploads(current=>[...queued,...current]);
  const results:LocalMedia[]=[];let failure:unknown;
  for(const upload of queued){
   if(!alive.current)throw new Error('uploadFailed');
   try{
    const item=await send(upload);
    if(alive.current){setItems(current=>[item,...current.filter(existing=>existing.id!==item.id)]);onUploaded?.(item);}
    results.push(item);updateUpload(upload.id,{status:'complete',progress:100,result:item});
   }catch(error){updateUpload(upload.id,{status:'failed'});failure??=error;}
  }
  if(failure)throw failure;
  return results;
 }
 async function add(file:File){return (await addMany([file]))[0];}
 return <Context.Provider value={{kind,filter,setFilter,items,pageIds,uploads,dismissUpload,loading,error,reload,add,addMany,hasMore:!!next,loadMore}}>{children}</Context.Provider>;
}
export function useMediaLibrary(){const library=useContext(Context);if(!library)throw new Error("MediaLibraryProvider required");return library;}
