import {plainMentionText} from "@sohoin/extension-api/mentions";
import {useTranslations} from "next-intl";
import styles from "./post-card.module.css";
import {PostCardSurface} from "./post-card-surface";
import {ReadingLink as Link} from "../../_components/feedback/page-transition";

import type {SiteContent} from "@sohoin/core/server";
import {contentHref} from "@/lib/public-url";
import {ContentMeta} from "../../_components/content/content-meta";
import {AuthorAvatar} from "../../_components/content/author-avatar";
import {CardBody} from "../../_components/content/card-body";
import {ContentMenu} from "../../_components/content/content-menu";
import {ContentActions,type ReactionOption} from "../../_components/content/content-actions";
import type {SiteInteraction} from "@sohoin/extension-api/interactions";
import type {DiscussionTarget} from "../../_components/content/discussion-composer-context";

export function PostCard({post,priority=false,reactionOptions,interaction,withinDiscussion=false}:{post:SiteContent;priority?:boolean;reactionOptions:ReactionOption[];interaction?:SiteInteraction;withinDiscussion?:boolean}){
 const t=useTranslations("Web");
 const href=contentHref(post),comment=post.comment;
 const discussion:DiscussionTarget|undefined=post.type==="post"||post.type==="article"||post.type==="comment"?{publicId:post.publicId,type:post.type,href,author:post.author,excerpt:plainMentionText(post.title||post.body).slice(0,180)}:undefined;
 interaction=interaction??comment?.interaction;
 const labels=new Map(reactionOptions.map(option=>[option.code,option]));
 const reactions=comment?(interaction?.reactions??[]).flatMap(reaction=>{const option=labels.get(reaction.code);return option?[{...option,count:reaction.count}]:[];}):post.reactions;
 return <PostCardSurface href={href} className={styles.post} data-within-discussion={withinDiscussion||undefined} data-skeleton-item="">
  <header className={styles.heading}>
   <Link className={styles.avatarLink} href={"/members/"+post.author.publicId} prefetch={false} aria-label={t("profileLabel",{name:post.author.name})}><AuthorAvatar src={post.author.avatar} name={post.author.name} publicId={post.author.publicId} wornBadge={post.author.wornBadge}/></Link>
   <ContentMeta content={post} card replyToName={withinDiscussion?comment?.replyToName:undefined}/>
   <ContentMenu href={href} comment={Boolean(comment)} discussion={discussion}/>
  </header>
  <div className={styles.content}>
  {post.title&&<h2 className={styles.title} data-skeleton-part="title"><Link href={href} className={styles.titleLink}>{post.title}</Link></h2>}
  <CardBody text={post.body} media={post.media} priority={priority} preview={{href,truncated:post.bodyTruncated,updatedAt:post.updatedAt}}/>
  <ContentActions publicId={comment?.parentPublicId??post.publicId} commentToken={comment?.actionToken} href={href} comments={post.comments} reactions={reactions} options={reactionOptions} interaction={interaction} discussion={discussion}/>
  </div>
 </PostCardSurface>;
}
