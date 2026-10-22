import {plainMentionText} from "@sohoin/extension-api/mentions";
import {useTranslations} from "next-intl";
import {ReadingLink as Link} from "../../_components/feedback/page-transition";
import {contentHref} from "@/lib/public-url";
import type {ReactNode} from "react";
import type {SiteContent} from "@sohoin/core/server";
import {RecentMentionVisit} from "../../_components/content/recent-mention-members";
import {DetailPanel} from "../../_components/content/detail-panel";
import {PublicationControls} from '../../_components/content/publication-controls';
import {ContentMeta,ContentBody} from "../../_components/content/content-meta";
import {ContentMedia} from "../../_components/content/content-media";
import {ContentActions,type ReactionOption} from "../../_components/content/content-actions";
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
 const reactions=comment?(own?.reactions??[]).flatMap(reaction=>{const option=reactionOptions.find(item=>item.code===reaction.code);return option?[{...option,count:reaction.count}]:[];}):content.reactions;
 return <DetailPanel title={detailTitle(content,t("communityPost"))} discussion={children}>
  <RecentMentionVisit id={content.author.publicId}/>
  {content.comment&&<p><Link href={contentHref({type:content.comment.parentType,publicId:content.comment.parentPublicId,slug:content.comment.parentSlug,categorySlug:content.comment.parentCategorySlug})} transitionTypes={["detail-back"]}>{t("originalPost")}</Link></p>}
  <ContentMeta content={content} detail/>
  {(content.type==='post'||content.type==='comment')&&<PublicationControls publicId={content.publicId} type={content.type} updatedAt={content.updatedAt}/>}
  <ContentBody text={content.body} truncated={content.bodyTruncated}/>
  <ContentMedia media={content.media} detail priority/>
  <ContentActions publicId={comment?.parentPublicId??content.publicId} commentToken={comment?.actionToken} href={href+"#comments"} comments={content.comments} reactions={reactions} options={reactionOptions} interaction={own} discussion={discussion}/>
 </DetailPanel>;
}
