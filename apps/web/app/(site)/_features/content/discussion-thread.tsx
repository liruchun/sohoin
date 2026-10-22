import "server-only";
import {PostCard} from "../feed/post-card";
import {DiscussionReplies} from "./discussion-replies";
import {loadDiscussionReplies} from "./discussion-replies-action";
import {publicHref} from "@/lib/public-url";
import type {ReactionOption} from "../../_components/content/content-actions";
import type {getSiteDiscussion} from "@sohoin/core/server";

type Thread=Awaited<ReturnType<typeof getSiteDiscussion>>["threads"][number];

/** Shared by the SSR first page and the cursor pages returned from the load-more action. */
export function DiscussionThread({thread,id,type,reactionOptions,locale}:{thread:Thread;id:string;type:"post"|"article"|"comment";reactionOptions:ReactionOption[];locale:string}){
 return <>
  <PostCard post={thread.comment.content} reactionOptions={reactionOptions} interaction={thread.comment.interaction} withinDiscussion/>
  {type!=="comment"&&<DiscussionReplies key={locale} publicationTarget={thread.comment.publicId} loadMore={loadDiscussionReplies.bind(null,id,type,thread.token)} initialNext={thread.next}
   href={publicHref("comment",thread.comment.publicId)}
   items={thread.replies.map(reply=>({id:reply.publicId,node:<PostCard post={reply.content} reactionOptions={reactionOptions} interaction={reply.interaction} withinDiscussion/>}))}/>}
 </>;
}
