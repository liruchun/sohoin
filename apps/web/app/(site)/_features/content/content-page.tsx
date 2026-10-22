import {getTranslations} from "next-intl/server";
import {ContentDetail,detailTitle} from "./content-detail";
import {Discussion,type DiscussionSearch} from "./discussion";
import type {Metadata} from "next";
import {getReactionTypes,getSiteInteractions} from "@sohoin/core/server";
import {headers} from "next/headers";
import {settingsService} from "@/lib/settings";
import {readSiteContent,robotsFor,absolute,contentHref,indexingEnabled,JsonLd} from "@/lib/site";
export async function contentMetadata(id:string,type:"post"|"article"|"comment"):Promise<Metadata>{
 const t=await getTranslations("Web");const [p,{settings}]=await Promise.all([readSiteContent(id,type),settingsService.readPublic()]);return {title:(p.title||p.body.trim().slice(0,48)||t("communityPost"))+" · "+settings.siteName,description:p.body.slice(0,160),alternates:{canonical:absolute(contentHref(p))},robots:robotsFor(p.demo)};}
export async function ContentPage({id,type,query={}}:{id:string;type:"post"|"article"|"comment";query?:DiscussionSearch}){
 const t=await getTranslations("Web");
 // A document entry reserves its complete height before the shared SSR reveal.
 // The intercepted SPA routes retain their independent comment Suspense fallback.
 const [p,discussion,catalog,viewer]=await Promise.all([readSiteContent(id,type),Discussion({id,type,query}),getReactionTypes(),type==="comment"?Promise.resolve({items:[]}):headers().then(value=>getSiteInteractions(value,{ids:[id]}))]);
 const title=detailTitle(p,t("communityPost"));
 return <>
  <ContentDetail content={p} reactionOptions={catalog.items} interaction={viewer.items[0]}>
   {discussion}
  </ContentDetail>
  {indexingEnabled()&&!p.demo&&<JsonLd value={{"@context":"https://schema.org","@type":type==="comment"?"Comment":type==="post"?"DiscussionForumPosting":"Article","@id":absolute(contentHref(p))+"#content",url:absolute(contentHref(p)),mainEntityOfPage:absolute(contentHref(p)),headline:title,...(type!=="article"?{text:p.body.replace(/<@[^|>]+\|([^>]+)>/g,"@$1")}:{}),...(p.media.some(item=>item.kind!=='video'&&item.kind!=='link')?{image:p.media.filter(image=>image.kind!=='video'&&image.kind!=='link').map(image=>absolute(image.url))}:{}),...(p.media.some(item=>item.kind==='video'&&item.poster)?{video:p.media.filter(item=>item.kind==='video'&&item.poster).map(item=>({'@type':'VideoObject',name:title,description:p.body.replace(/<@[^|>]+\|([^>]+)>/g,'@$1').slice(0,160),thumbnailUrl:absolute(item.poster!),contentUrl:absolute(item.url),uploadDate:p.publishedAt,...(item.durationMs?{duration:`PT${item.durationMs/1000}S`}:{})}))}:{}),author:{"@type":"Person",name:p.author.name,url:absolute("/members/"+p.author.publicId)},datePublished:p.publishedAt,dateModified:p.updatedAt}}/>}
 </>;
}
