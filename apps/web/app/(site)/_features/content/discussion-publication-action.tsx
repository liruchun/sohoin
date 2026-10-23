"use server";

import {headers} from "next/headers";
import {getSiteDiscussion,getSiteContent,getReactionTypes,getSiteAncestorReplyCounts} from "@sohoin/core/server";
import {PostCard} from "../feed/post-card";
import {DiscussionReplies} from "./discussion-replies";
import {loadCommentReplies} from "./discussion-replies-action";

export async function loadPublishedComment(id:string,ownerId:string,nested:boolean){
 if([id,ownerId].some(value=>typeof value!=="string"||!/^(?=.*[a-z])[a-z0-9]{10}$/.test(value))||typeof nested!=="boolean")throw new Error("讨论地址无效");
 const [page,catalog]=await Promise.all([getSiteDiscussion(id,"comment",{},await headers()),getReactionTypes()]);
 const comment=page.selected;
 if(!comment)throw new Error("评论不存在或已不可见");
 const parent=comment.content.comment!;
 const [content,ancestors]=await Promise.all([
  getSiteContent(parent.parentPublicId,parent.parentType),
  getSiteAncestorReplyCounts(id),
 ]);
 const counts=[{publicId:parent.parentPublicId,count:content.comments},...ancestors];
 return {counts,node:<><PostCard post={comment.content} reactionOptions={catalog.items} interaction={comment.interaction} withinDiscussion/>
  {!nested&&ownerId===parent.parentPublicId&&<DiscussionReplies publicationTarget={id} loadMore={loadCommentReplies.bind(null,id)} initialNext={null} items={[]} href={"/comments/"+id}/>}
 </>};
}
