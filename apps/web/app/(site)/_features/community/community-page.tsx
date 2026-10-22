import type {Metadata} from "next";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {getSiteCategoryMembership,getSiteCommunityFeed,ServiceError} from "@sohoin/core/server";
import {settingsService} from "@/lib/settings";
import {absolute,indexingEnabled,robotsFor} from "@/lib/site";
import {ReadingLink as Link} from "../../_components/feedback/page-transition";
import {FeedEmptyState,SiteFeed} from "../feed/feed";
import {CommunityPagination} from "./community-pagination";
import {communityHref,parseCommunitySort,type CommunitySort} from "./community-route";
import {readCommunityTopic,readCommunityTopics} from "./community-topic";
import {CommunityHeaderRegistration} from "./community-header-context";
import {TopicStrip} from "./topic-strip";

export type CommunitySearch={sort?:string;after?:string};
export async function communityMetadata(slug:string|null,search:CommunitySearch):Promise<Metadata>{
 const t=await getTranslations("Web");
 const [{settings},topic]=await Promise.all([settingsService.readPublic(),slug?readCommunityTopic(slug):null]);
 if(slug&&!topic)notFound();
 const sort=parseCommunitySort(search.sort);
 const canonical=absolute(communityHref({slug,sort,after:search.after}));
 return {
  title:(topic?topic.name:t("communityFeed"))+" · "+settings.siteName,
  description:topic?(topic.description||t("communityTopicDescription",{name:topic.name})):settings.description,
  alternates:{canonical},
  robots:search.after||sort!=="latest"?{index:false,follow:true}:robotsFor(),
 };
}
export async function CommunityPage({slug,sort,after}:{slug:string|null;sort:CommunitySort;after?:string}){
 const t=await getTranslations("Web");
 const [{settings},requestHeaders]=await Promise.all([settingsService.readPublic(),headers()]);
 const topic=slug?await readCommunityTopic(slug):null;
 const topics=slug?[]:await readCommunityTopics();
 if(slug&&!topic)notFound();
 const membership=slug?await getSiteCategoryMembership(requestHeaders,slug):null;
 let feed;
 try{feed=await getSiteCommunityFeed({sort,topic:slug,cursor:after??null,excludeDemo:indexingEnabled(),headers:requestHeaders});}
 catch(error){
  if(error instanceof ServiceError&&error.status===400)return <FeedEmptyState title={t("expiredPage")}><Link href={communityHref({slug,sort})}>{t("firstPage")}</Link></FeedEmptyState>;
  throw error;
 }
 const label=topic?topic.name:t("communityFeed");
 const login=sort==="mine"&&!feed.authenticated;
 return <>
  <h1 className="sr-only">{settings.siteName} · {label}</h1>
  {slug&&topic&&<CommunityHeaderRegistration topic={{slug:topic.slug,name:topic.name,description:topic.description,iconUrl:topic.iconUrl,joined:membership?.joined??false,authenticated:membership?.authenticated??false}}/>}
  {slug===null&&<TopicStrip topics={topics} slug={slug}/>}
  {login?<FeedEmptyState title={t("loginForInteractions")}><Link href="/admin/login">{t("login")}</Link> · {t("loginForInteractionsHint")}</FeedEmptyState>:<>
   {sort==="mine"&&!feed.items.length?<FeedEmptyState title={t("noInteractions")}>{t("startConversation")}</FeedEmptyState>:<SiteFeed key={`${slug??""}:${sort}:${after??""}`} items={feed.items} view="latest" label={label}/>}
   <CommunityPagination slug={slug} sort={sort} after={after} next={feed.next}/>
  </>}
 </>;
}
