"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useConfirmation} from "@sohoin/admin-ui/confirmation";

export function useUnsavedChanges(dirty:boolean){
  const confirm=useConfirmation(),router=useRouter();
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    // App Router links do not trigger beforeunload. Guard same-tab navigation too.
    const guard=async(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=event.target instanceof Element?event.target.closest("a"):null;
      if(!anchor||anchor.hasAttribute("download")||(anchor.target&&anchor.target!=="_self"))return;
      const destination=new URL(anchor.href,window.location.href);
      if(destination.protocol!=="http:"&&destination.protocol!=="https:")return;
      if(destination.origin===location.origin&&destination.pathname===location.pathname&&destination.search===location.search)return;
      event.preventDefault();event.stopPropagation();
      if(await confirm("有未保存的修改，确定离开此页面吗？","离开页面")){if(destination.origin===location.origin)router.push(destination.pathname+destination.search+destination.hash);else window.location.assign(destination.href);}
    };
    window.addEventListener("beforeunload",warn);
    document.addEventListener("click",guard,true);
    return()=>{window.removeEventListener("beforeunload",warn);document.removeEventListener("click",guard,true);};
  },[dirty,confirm,router]);
}
