"use client";
import {rememberMentionMember} from "./recent-mention-members";
import {useTranslations} from "next-intl";

import {ReadingLink as Link} from "../feedback/page-transition";
import {useRef,useState} from "react";
import {useDiscussionComposer,type DiscussionTarget} from "./discussion-composer-context";
import {StaticIcon} from "./static-icon";
import {IconButton} from "@sohoin/ui/icon-button";
import {DropdownMenu,DropdownMenuTrigger} from "@sohoin/ui/dropdown-menu";
import {DropdownMenuContent,DropdownMenuItem} from "@sohoin/ui/dropdown-menu-content";
import styles from "./content-menu.module.css";

export function ContentMenu({href,comment=false,discussion}:{href:string;comment?:boolean;discussion?:DiscussionTarget}){
 const t=useTranslations("Web");
 const showDiscussion=useDiscussionComposer();
 const trigger=useRef<HTMLButtonElement>(null);
 const openingDiscussion=useRef(false);
 const [notice,setNotice]=useState<"linkCopied"|"copyFailed"|null>(null);
 async function copy(){try{await navigator.clipboard.writeText(new URL(href,window.location.origin).href);setNotice("linkCopied");rememberMentionMember(discussion?.author.publicId);}catch{setNotice("copyFailed");}}
 return <>
  <DropdownMenu modal={false}>
   <DropdownMenuTrigger asChild><IconButton ref={trigger} className={styles.trigger} data-comment={comment?"":undefined} aria-label={comment?t("discussionMenu"):t("postMenu")}><StaticIcon name="ellipsis"/></IconButton></DropdownMenuTrigger>
   <DropdownMenuContent align="end" onCloseAutoFocus={event=>{if(openingDiscussion.current){event.preventDefault();openingDiscussion.current=false;}}}>
    {discussion&&showDiscussion&&<DropdownMenuItem onSelect={()=>{if(trigger.current){openingDiscussion.current=true;showDiscussion(discussion,trigger.current);}}}>{t("joinDiscussion")}</DropdownMenuItem>}
    <DropdownMenuItem asChild><Link href={href} transitionTypes={["detail-forward"]}>{comment?t("viewDiscussion"):t("fullContent")}</Link></DropdownMenuItem>
    <DropdownMenuItem onSelect={()=>{void copy();}}>{comment?t("copyDiscussionLink"):t("copyLink")}</DropdownMenuItem>
   </DropdownMenuContent>
  </DropdownMenu>
  <span className="sr-only" role="status">{notice&&t(notice)}</span>
 </>;
}
