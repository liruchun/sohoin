"use client";
import {rememberMentionMember} from "./recent-mention-members";
import {useTranslations} from "next-intl";

import {ReadingLink as Link} from "../feedback/reading-navigation";
import {useRef,useState,type RefObject} from "react";
import {useDiscussionComposer,type DiscussionTarget} from "./discussion-composer-context";
import {Ellipsis} from "lucide-react";
import {IconButton} from "@sohoin/ui/icon-button";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuGroup} from "@sohoin/ui/dropdown-menu";
import {DropdownMenuContent,DropdownMenuItem} from "@sohoin/ui/dropdown-menu-content";
import styles from "./content-menu.module.css";

export function ContentMenu({href,comment=false,discussion,detail=false,ownerActions,triggerRef}:{href:string;comment?:boolean;discussion?:DiscussionTarget;detail?:boolean;ownerActions?:{edit:()=>void;remove:()=>void};triggerRef?:RefObject<HTMLButtonElement|null>}){
 const t=useTranslations("Web");
 const publishing=useTranslations("Publishing");
 const showDiscussion=useDiscussionComposer();
 const localTrigger=useRef<HTMLButtonElement>(null);
 const trigger=triggerRef??localTrigger;
 const openingDiscussion=useRef(false);
 const [notice,setNotice]=useState<"linkCopied"|"copyFailed"|null>(null);
 async function copy(){try{await navigator.clipboard.writeText(new URL(href,window.location.origin).href);setNotice("linkCopied");rememberMentionMember(discussion?.author.publicId);}catch{setNotice("copyFailed");}}
 return <>
  <DropdownMenu modal={false}>
   <DropdownMenuTrigger asChild><IconButton ref={trigger} className={styles.trigger} data-comment={comment?"":undefined} aria-label={comment?t("discussionMenu"):t("postMenu")}><Ellipsis aria-hidden="true"/></IconButton></DropdownMenuTrigger>
   <DropdownMenuContent align="end" onCloseAutoFocus={event=>{if(openingDiscussion.current){event.preventDefault();openingDiscussion.current=false;}}}>
    <DropdownMenuGroup>
    {discussion&&showDiscussion&&<DropdownMenuItem onSelect={()=>{if(trigger.current){openingDiscussion.current=true;showDiscussion(discussion,trigger.current);}}}>{t("joinDiscussion")}</DropdownMenuItem>}
    {!detail&&<DropdownMenuItem asChild><Link href={href}>{comment?t("viewDiscussion"):t("fullContent")}</Link></DropdownMenuItem>}
    <DropdownMenuItem onSelect={()=>{void copy();}}>{comment?t("copyDiscussionLink"):t("copyLink")}</DropdownMenuItem>
    {ownerActions&&<><DropdownMenuItem onSelect={()=>{openingDiscussion.current=true;ownerActions.edit();}}>{publishing("edit")}</DropdownMenuItem><DropdownMenuItem onSelect={()=>{openingDiscussion.current=true;ownerActions.remove();}}>{publishing("delete")}</DropdownMenuItem></>}
    </DropdownMenuGroup>
   </DropdownMenuContent>
  </DropdownMenu>
  <span className="sr-only" role="status">{notice&&t(notice)}</span>
 </>;
}
