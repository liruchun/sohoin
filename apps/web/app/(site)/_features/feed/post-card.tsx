import {plainMentionText} from "@sohoin/extension-api/mentions";
import type {ReactNode} from "react";
import {useTranslations} from "next-intl";
import styles from "./post-card.module.css";
import {PostCardSurface} from "./post-card-surface";
import {ReadingLink as Link} from "../../_components/feedback/reading-navigation";

import type {SiteContent} from "@sohoin/core/server";
import {contentHref} from "@/lib/public-url";
import {ContentMeta} from "../../_components/content/content-meta";
import {AuthorAvatar} from "../../_components/content/author-avatar";
import {CardBody} from "../../_components/content/card-body";
import {ContentMenu} from "../../_components/content/content-menu";
import {ContentActions,type ReactionOption} from "../../_components/content/content-actions";
import type {SiteInteraction} from "@sohoin/extension-api/interactions";
import type {DiscussionTarget} from "../../_components/content/discussion-composer-context";

export function PostCard({post,priority=false,reactionOptions,interaction,withinDiscussion=false,detailTitle,menu,children}:{post:SiteContent;priority?:boolean;reactionOptions:ReactionOption[];interaction?:SiteInteraction;withinDiscussion?:boolean;detailTitle?:string;menu?:ReactNode;children?:ReactNode}){
 const t=useTranslations("Web");
 const href=contentHref(post),comment=post.comment;
 const discussion:DiscussionTarget|undefined=post.type==="post"||post.type==="article"||post.type==="comment"?{publicId:post.publicId,type:post.type,href,author:post.author,excerpt:plainMentionText(post.title||post.body).slice(0,180)}:undefined;
 interaction=interaction??comment?.interaction;
 const labels=new Map(reactionOptions.map(option=>[option.code,option]));
 const reactions=comment?(interaction?.reactions??[]).flatMap(reaction=>{const option=labels.get(reaction.code);return option?[{...option,count:reaction.count}]:[];}):post.reactions;
 const detail=detailTitle!==undefined;
 const body=<>
  <header className={styles.heading}>
   <Link className={styles.avatarLink} href={"/members/"+post.author.publicId} prefetch={false} aria-label={t("profileLabel",{name:post.author.name})}><AuthorAvatar src={post.author.avatar} name={post.author.name} publicId={post.author.publicId} wornBadge={post.author.wornBadge}/></Link>
   <ContentMeta content={post} card replyToName={withinDiscussion||detail?comment?.replyToName:undefined}/>
   {menu??<ContentMenu href={href} comment={Boolean(comment)} discussion={discussion} detail={detail}/>}
  </header>
  <div className={styles.content}>
  {detail?<h1 className={post.title?styles.title:"sr-only"} data-skeleton-part={post.title?"title":undefined}>{detailTitle}</h1>:post.title&&<h2 className={styles.title} data-skeleton-part="title"><Link href={href} className={styles.titleLink}>{post.title}</Link></h2>}
  <CardBody text={post.body} media={post.media} priority={priority} preview={detail?undefined:{href,truncated:post.bodyTruncated,updatedAt:post.updatedAt}}/>
  {children}
  <ContentActions publicId={comment?.parentPublicId??post.publicId} commentToken={comment?.actionToken} href={detail?href+"#comments":href} comments={post.comments} participants={post.participants} reactions={reactions} options={reactionOptions} interaction={interaction} discussion={discussion}/>
  </div>
 </>;
 return detail?<article className={styles.post} data-detail="" data-skeleton-item="">{body}</article>:<PostCardSurface href={href} className={styles.post} data-within-discussion={withinDiscussion||undefined} data-skeleton-item="">{body}</PostCardSurface>;
}
