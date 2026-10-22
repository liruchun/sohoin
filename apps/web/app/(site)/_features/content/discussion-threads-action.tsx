"use server";

import {headers} from "next/headers";
import {getLocale} from "next-intl/server";
import {getSiteDiscussion,getReactionTypes} from "@sohoin/core/server";
import {DiscussionThread} from "./discussion-thread";

export async function loadDiscussionThreads(id:string,type:"post"|"article"|"comment",before:string|null){
 if(type==="comment"||typeof before!=="string"||!before||before.length>2048)throw new Error("讨论分页地址无效");
 const requestHeaders=await headers();
 const [page,catalog,locale]=await Promise.all([getSiteDiscussion(id,type,{commentsBefore:before},requestHeaders),getReactionTypes(),getLocale()]);
 return {
  items:page.threads.map(thread=>({id:thread.comment.publicId,node:<DiscussionThread thread={thread} id={id} type={type} reactionOptions={catalog.items} locale={locale}/>})),
  next:page.next,
 };
}
