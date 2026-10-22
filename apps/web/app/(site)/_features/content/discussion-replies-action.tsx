"use server";

import {headers} from "next/headers";
import {getSiteDiscussion,getSiteReplyBranch,getReactionTypes} from "@sohoin/core/server";
import {PostCard} from "../feed/post-card";

export async function loadDiscussionReplies(id:string,type:"post"|"article",thread:string,before:string|null){
 if((type!=="post"&&type!=="article")||typeof thread!=="string"||!thread||typeof before!=="string"||!before||thread.length>2048||before.length>2048)throw new Error("讨论分页地址无效");
 const [page,catalog]=await Promise.all([getSiteDiscussion(id,type,{thread,repliesBefore:before},await headers()),getReactionTypes()]);
 const result=page.threads[0];
 return {items:(result?.replies??[]).map(reply=>({id:reply.publicId,node:<PostCard post={reply.content} reactionOptions={catalog.items} interaction={reply.interaction} withinDiscussion/>})),next:result?.next??null};
}

export async function loadCommentReplies(id:string,before:string|null){
 if(before!==null&&(typeof before!=="string"||!before||before.length>2048))throw new Error("讨论分页地址无效");
 const [page,catalog]=await Promise.all([getSiteReplyBranch(id,before??undefined,await headers()),getReactionTypes()]);
 return {items:page.items.map(reply=>({id:reply.publicId,node:<PostCard post={reply.content} reactionOptions={catalog.items} interaction={reply.interaction} withinDiscussion/>})),next:page.next};
}
