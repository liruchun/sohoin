"use client";

import {useCallback,useState,type ReactNode} from "react";
import {DiscussionComposerContext,type DiscussionTarget} from "./discussion-composer-context";
import {PostComposer} from "./post-composer";

export function DiscussionComposerProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<{target:DiscussionTarget;anchor:HTMLElement;sequence:number}|null>(null);
 const [open,setOpen]=useState(false);
 const show=useCallback((target:DiscussionTarget,anchor:HTMLElement)=>{
  setSession(previous=>({target,anchor,sequence:(previous?.sequence??0)+1}));setOpen(true);
 },[]);
 return <DiscussionComposerContext.Provider value={show}>{children}
  {session&&<PostComposer key={session.sequence} discussion={session.target} anchor={session.anchor} controlledOpen={open} onOpenChange={setOpen}/>}
 </DiscussionComposerContext.Provider>;
}
