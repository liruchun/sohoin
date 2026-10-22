import type {MetadataRoute} from "next";
import {getSiteSitemap,getSiteTopics} from "@sohoin/core/server";
import {indexingEnabled,absolute} from "@/lib/site";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 if(!indexingEnabled())return [];
 const topics=(await getSiteTopics(true)).filter(topic=>topic.posts>0).map(topic=>({url:absolute("/community/"+topic.slug)}));
 return [{url:absolute("/")},{url:absolute("/featured")},{url:absolute("/community")},...topics,...(await getSiteSitemap()).map(p=>({url:absolute(p.path),lastModified:p.updatedAt}))];
}
