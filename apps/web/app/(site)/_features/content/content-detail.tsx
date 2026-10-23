import {plainMentionText} from "@sohoin/extension-api/mentions";
import {useTranslations} from "next-intl";
import {ReadingLink as Link} from "../../_components/feedback/reading-navigation";
import {contentHref} from "@/lib/public-url";
import type {ReactNode} from "react";
import type {SiteContent} from "@sohoin/core/server";
import {RecentMentionVisit} from "../../_components/content/recent-mention-members";
import panelStyles from "../../_components/content/detail-panel.module.css";
import {PostCard} from "../feed/post-card";
import {PublicationControls} from '../../_components/content/publication-controls';
import type {ReactionOption} from "../../_components/content/content-actions";
import type {SiteInteraction} from "@sohoin/extension-api/interactions";
import type {DiscussionTarget} from "../../_components/content/discussion-composer-context";

export const detailTitle=(p:Pick<SiteContent,"title"|"body">,fallback:string)=>p.title||plainMentionText(p.body).trim().split("\n")[0].slice(0,60)||fallback;
/** Shared pure view: server rendered on hard navigation; the interactive layer reuses its feed record. */
export function ContentDetail({content,children,reactionOptions,interaction}:{content:SiteContent;children?:ReactNode;reactionOptions:ReactionOption[];interaction?:SiteInteraction}){
 const t=useTranslations("Web");
 const comment=content.comment;
 const href=contentHref(content);
 const discussion:DiscussionTarget|undefined=content.type==="post"||content.type==="article"||content.type==="comment"?{publicId:content.publicId,type:content.type,href,author:content.author,excerpt:(content.title||content.body).slice(0,180)}:undefined;
 const own=comment?.interaction??interaction;
 return <div className={panelStyles.frame}>
  <RecentMentionVisit id={content.author.publicId}/>
  <PostCard post={content} priority reactionOptions={reactionOptions} interaction={own} detailTitle={detailTitle(content,t("communityPost"))}
   menu={(content.type==='post'||content.type==='comment')?<PublicationControls publicId={content.publicId} type={content.type} updatedAt={content.updatedAt} href={href} discussion={discussion}/>:undefined}>
  {content.comment&&<p><Link href={contentHref({type:content.comment.parentType,publicId:content.comment.parentPublicId,slug:content.comment.parentSlug,categorySlug:content.comment.parentCategorySlug})}>{t("originalPost")}</Link></p>}
  </PostCard>
  {children}
 </div>;
}
