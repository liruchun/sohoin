import {useLocale,useTranslations} from "next-intl";
import {getTranslations} from "next-intl/server";
import "server-only";
import {cache} from "react";
import {ReadingLink as Link} from "../../_components/feedback/reading-navigation";
import type {Metadata} from "next";
import {getSiteDiscussion,getSiteContentHead,getReactionTypes,ServiceError,type DiscussionQuery,type SiteContentHead} from "@sohoin/core/server";
import {headers} from "next/headers";
import {settingsService} from "@/lib/settings";
import {absolute,publicHref,contentHref,robotsFor,indexingEnabled,JsonLd} from "@/lib/site";
import {PostCard} from "../feed/post-card";
import {FeedDetailData} from "./detail-data";
import {DetailValidation} from "./detail-validation";
import {DiscussionRetry} from "./discussion-retry";
import {DiscussionReplies} from "./discussion-replies";
import {loadCommentReplies} from "./discussion-replies-action";
import {DiscussionThread} from "./discussion-thread";
import {DiscussionThreads} from "./discussion-threads";
import {loadDiscussionThreads} from "./discussion-threads-action";
import styles from "./discussion.module.css";

export type DiscussionSearch=DiscussionQuery;
const readDiscussion=cache(async(id:string,type:"post"|"article"|"comment",before?:string,thread?:string,replies?:string)=>getSiteDiscussion(id,type,{commentsBefore:before,thread,repliesBefore:replies},await headers()));
const load=(id:string,type:"post"|"article"|"comment",q:DiscussionSearch)=>readDiscussion(id,type,q.commentsBefore,q.thread,q.repliesBefore);
function href(id:string,type:string,q:DiscussionSearch={},head?:SiteContentHead){
 const search=new URLSearchParams();for(const key of ["commentsBefore","thread","repliesBefore"] as const){const value=q[key];if(value)search.set(key,value);}
 return (head?contentHref({type,publicId:id,slug:head.slug,categorySlug:head.categorySlug}):publicHref(type,id))+(search.size?"?"+search.toString():"")+"#comments";
}
export async function discussionMetadata(id:string,type:"post"|"article"|"comment",q:DiscussionSearch):Promise<Metadata>{
 const t=await getTranslations("Web");
 const {settings}=await settingsService.readPublic();
 try{
  // Metadata only needs the post head; fetching comments here can start their
  // entire query outside the visible discussion Suspense boundary.
  const head=await getSiteContentHead(id,type);
  // Comment URLs stay reachable but never indexed; the thread is the canonical page.
  const canonical=type==="comment"?(head.parent?contentHref(head.parent):publicHref("comment",id)):contentHref({type,publicId:id,slug:head.slug,categorySlug:head.categorySlug});
  return {title:(head.title||head.excerpt.trim().slice(0,48)||t("communityPost"))+" · "+settings.siteName,description:head.excerpt,alternates:{canonical:absolute(canonical)},robots:type==="comment"?{index:false,follow:true}:robotsFor(head.demo||Boolean(q.repliesBefore))};
 }
 catch{return {title:t("contentUnavailableTitle",{brand:settings.siteName}),robots:{index:false,follow:true}};}
}
export {DiscussionPending} from "./discussion-skeleton";
type DiscussionPage=Awaited<ReturnType<typeof getSiteDiscussion>>;
function DiscussionList({id,type,query,page,catalog}:{id:string;type:"post"|"article"|"comment";query:DiscussionSearch;page:DiscussionPage;catalog:Awaited<ReturnType<typeof getReactionTypes>>}){
 const t=useTranslations("Web");
 const locale=useLocale();
 return <FeedDetailData id="comments" items={page.threads.flatMap(thread=>[thread.comment.content,...thread.replies.map(reply=>reply.content)])} className={styles.section} label={page.selected?t("reply"):t("discussion")}>
  {(query.thread||query.commentsBefore)&&<Link href={href(id,type,{},page.head)} replace scroll={false}>{t("allComments")}</Link>}
  {!page.threads.length&&query.thread&&<p>{t("hiddenDiscussion")}</p>}
  {page.selected?<DiscussionReplies key={`${locale}:${id}`} publicationTarget={page.selected.publicId} loadMore={loadCommentReplies.bind(null,page.selected.publicId)} initialNext={page.next} depth={0} href={href(id,type,{repliesBefore:page.next??undefined},page.head)} items={page.threads.map(({comment})=>({id:comment.publicId,node:<PostCard post={comment.content} reactionOptions={catalog.items} interaction={comment.interaction} withinDiscussion/>}))}/>:<DiscussionThreads key={`${locale}:${id}`} publicationTarget={id} existingIds={page.threads.map(thread=>thread.comment.publicId)} listId="discussion-threads" loadMore={loadDiscussionThreads.bind(null,id,type)} initialNext={page.next} initialHref={page.next?href(id,type,{commentsBefore:page.next},page.head):undefined}>
   {page.threads.map(thread=><li key={thread.comment.publicId} className={styles.thread}>
   <DiscussionThread thread={thread} id={id} type={type} reactionOptions={catalog.items} locale={locale}/>
  </li>)}</DiscussionThreads>}
 </FeedDetailData>;
}
export async function Discussion({id,type,query={},validate=false}:{id:string;type:"post"|"article"|"comment";query?:DiscussionSearch;validate?:boolean}){
 const t=await getTranslations("Web");
 try{
  const [page,catalog]=await Promise.all([load(id,type,query),getReactionTypes()]);
  return <>{validate&&<DetailValidation head={page.head}/>}<DiscussionList id={id} type={type} query={query} page={page} catalog={catalog}/>{validate&&indexingEnabled()&&!page.head.demo&&<JsonLd value={{"@context":"https://schema.org","@type":type==="comment"?"Comment":type==="post"?"DiscussionForumPosting":"Article","@id":absolute(contentHref({type,publicId:id,slug:page.head.slug,categorySlug:page.head.categorySlug}))+"#content",url:absolute(contentHref({type,publicId:id,slug:page.head.slug,categorySlug:page.head.categorySlug})),mainEntityOfPage:absolute(contentHref({type,publicId:id,slug:page.head.slug,categorySlug:page.head.categorySlug})),headline:page.head.title||page.head.excerpt.trim().split("\n")[0].slice(0,60)||t("communityPost"),...(type!=="article"?{text:page.head.excerpt.replace(/<@[^|>]+\|([^>]+)>/g,"@$1")}:{}),author:{"@type":"Person",name:page.head.authorName},datePublished:page.head.publishedAt,dateModified:page.head.updatedAt}}/>}</>;
 }catch(error){
  let unavailable=error instanceof ServiceError&&error.status===404;
  let head:SiteContentHead|undefined;
  // A comment failure must not block a long post's full-body fetch.
  if(validate&&!unavailable)try{head=await getSiteContentHead(id,type);}catch(e){unavailable=e instanceof ServiceError&&e.status===404;}
  return <>{validate&&(unavailable||head)&&<DetailValidation head={head} unavailable={unavailable}/>}<section id="comments" className={styles.section} aria-label={t("discussion")}><p role="status">{unavailable?t("unavailable"):error instanceof ServiceError&&error.status===400?t("invalidDiscussionPage"):t("discussionTryAgain")}</p>{!unavailable&&<><Link href={href(id,type,{},head)} replace scroll={false}>{t("allComments")}</Link><DiscussionRetry/></>}</section></>;
 }
}
