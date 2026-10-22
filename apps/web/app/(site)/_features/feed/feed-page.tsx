import {getTranslations} from "next-intl/server";
import {settingsService} from "@/lib/settings";
import {ReadingLink as Link} from "../../_components/feedback/page-transition";
import type {Metadata} from "next";
import {getSiteFeed,ServiceError,type SiteView} from "@sohoin/core/server";
import {absolute,indexingEnabled,robotsFor,JsonLd} from "@/lib/site";
import {SiteFeed,FeedEmptyState} from "./feed";
import {FeedPagination} from "./feed-pagination";
import {feedHref} from "./feed-route";
export type FeedSearch={feed?:string;after?:string};
const views={featured:"featuredCommunity",latest:"recommended",articles:"articles"} as const satisfies Record<SiteView,string>;
export async function feedMetadata(view:SiteView,after?:string):Promise<Metadata>{
 const t=await getTranslations("Web");
 const {settings}=await settingsService.readPublic();
 return {title:settings.siteName+" · "+t(views[view]),description:settings.description,alternates:{canonical:absolute(feedHref(view,after))},robots:after?{index:false,follow:true}:robotsFor()};
}
async function HomeFeed({view,after}:{view:SiteView;after?:string}){
 const t=await getTranslations("Web");
 let page;
 try{page=await getSiteFeed(view,after,indexingEnabled());}
 catch(e){
  if(e instanceof ServiceError&&e.status===400)return <FeedEmptyState title={t("expiredPage")}><Link href={feedHref(view)}>{t("firstPage")}</Link></FeedEmptyState>;
  throw e;
 }
 return <><SiteFeed key={`${view}:${after??""}`} items={page.items} view={view} label={t(views[view])}/><FeedPagination view={view} after={after} next={page.next}/></>;
}
export async function FeedPage({view,after}:{view:SiteView;after?:string}){
 const t=await getTranslations("Web");
 const {settings}=await settingsService.readPublic();
 return <>
  <h1 className="sr-only">{settings.siteName} · {t(views[view])}</h1>
  <HomeFeed view={view} after={after}/>
  {view==="latest"&&indexingEnabled()&&<JsonLd value={{"@context":"https://schema.org","@type":"WebSite",name:settings.siteName,url:absolute("/")}}/>}
 </>;
}
