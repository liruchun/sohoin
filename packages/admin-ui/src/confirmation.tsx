"use client";
import {createContext,useContext,useState,useRef,useEffect,useCallback,type ReactNode} from "react";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "./alert-dialog";
type Confirm=(description:string,title?:string)=>Promise<boolean>;
const Context=createContext<Confirm|null>(null);
export function ConfirmationProvider({children}:{children:ReactNode}){
 const [request,setRequest]=useState<{description:string;title:string}|null>(null);
 const resolver=useRef<((value:boolean)=>void)|null>(null);
 const trigger=useRef<HTMLElement|null>(null);
 const confirm=useCallback<Confirm>((description,title="确认操作")=>{if(resolver.current)return Promise.resolve(false);trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;return new Promise(resolve=>{resolver.current=resolve;setRequest({description,title});});},[]);
 const finish=useCallback((value:boolean)=>{const resolve=resolver.current;resolver.current=null;setRequest(null);resolve?.(value);},[]);
 useEffect(()=>()=>{resolver.current?.(false);resolver.current=null;},[]);
 return <Context.Provider value={confirm}>{children}<AlertDialog open={Boolean(request)} onOpenChange={open=>{if(!open)finish(false);}}><AlertDialogContent onCloseAutoFocus={event=>{event.preventDefault();if(trigger.current?.isConnected)trigger.current.focus();}}><AlertDialogHeader><AlertDialogTitle>{request?.title}</AlertDialogTitle><AlertDialogDescription>{request?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>finish(false)}>取消</AlertDialogCancel><AlertDialogAction onClick={()=>finish(true)}>确认</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></Context.Provider>;
}
export function useConfirmation(){const confirm=useContext(Context);if(!confirm)throw new Error("ConfirmationProvider is required inside admin UI");return confirm;}
