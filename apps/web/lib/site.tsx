import "server-only";
import {cache} from "react";
import {notFound,permanentRedirect} from "next/navigation";
import {getSiteContent,getSiteProfile,ServiceError} from "@sohoin/core/server";
export const siteOrigin=()=>{const value=new URL(process.env.SITE_URL??"https://sohoin.com");if(!["http:","https:"].includes(value.protocol)||value.username||value.password)throw new Error("Invalid SITE_URL");return value.origin;};
export const indexingEnabled=()=>process.env.SITE_INDEXING_ENABLED==="true";
import {contentHref} from "./public-url";
export {publicHref} from "./public-url";
export {contentHref} from "./public-url";
export const readSiteContent=cache(async(id:string,type:"post"|"article"|"comment")=>{try{const item=await getSiteContent(id,type);if(id!==item.publicId)permanentRedirect(contentHref(item));return item;}catch(e){if(e instanceof ServiceError&&e.status===404)notFound();throw e;}});
export const readSiteProfile=cache(async(id:string)=>{try{const profile=await getSiteProfile(id);if(id!==profile.publicId)permanentRedirect("/members/"+profile.publicId);return profile;}catch(e){if(e instanceof ServiceError&&e.status===404)notFound();throw e;}});
export function robotsFor(demo=false){return {index:indexingEnabled()&&!demo,follow:true};}
export const absolute=(path:string)=>new URL(path,siteOrigin()).toString();
export function JsonLd({value}:{value:unknown}){return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(value).replace(/</g,"\\u003c")}}/>;}
