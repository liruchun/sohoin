"use server";
import {plainMentionText} from "@sohoin/extension-api/mentions";

import {getSiteDiscussion,type SiteComment} from "@sohoin/core/server";

export async function loadDiscussionPreview(id:string,type:"post"|"article"|"comment"){
 if(typeof id!=="string"||!/^(?=.*[a-z])[a-z0-9]{10}$/.test(id)||!["post","article","comment"].includes(type))throw new Error("讨论地址无效");
 // Core owns visibility checks and bounded queries. No viewer interaction data is needed here.
 const page=await getSiteDiscussion(id,type);
 const preview=(item:SiteComment)=>({publicId:item.publicId,body:plainMentionText(item.body).slice(0,240),authorName:item.authorName,authorPublicId:item.authorPublicId,wornBadge:item.wornBadge,avatar:item.avatar,replyToName:item.replyToName});
 return page.threads.slice(0,2).map(thread=>({comment:preview(thread.comment),replies:thread.replies.slice(0,1).map(preview)}));
}
