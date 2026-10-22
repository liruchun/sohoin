import {avatarUrl} from "./avatar-url";
import "server-only";
import {readProfileBadges,readWornBadges} from "@sohoin/database";
import type {WornBadge} from "@sohoin/extension-api/badges";
import type {SiteInteraction} from "@sohoin/extension-api/interactions";
import {readSiteFeed,readSiteContent,readSiteProfile,readPublicRouteTarget,readSiteSitemap,readSitePresentation,readSiteTopics,readSiteTopic,readSiteCommunityFeed,type SitePresentation,type PublicFeedRow} from "@sohoin/database";
import {publicIdCodec} from "./public-id";
import {publicRoutes as routes} from "./public-routes";
import {getSiteComment} from "./public-discussion";
import {ServiceError,requireAuthenticatedUser} from "./security";
import {getOwnMemberDetails} from './member-profiles';
export type SiteView="featured"|"latest"|"articles";
const communitySorts=["latest","hot","mine"] as const;
export type CommunitySort=typeof communitySorts[number];
export type SiteTopic={name:string;slug:string;description:string;iconUrl:string|null;posts:number};
export type SiteTopicRef={name:string;slug:string;description:string;iconUrl:string|null};
const missing=()=>new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
const validContent=(id:string|null|undefined):id is string=>Boolean(id&&/^[1-9][0-9]{0,18}$/.test(id)&&BigInt(id)<=9223372036854775807n);

function serialize(row:PublicFeedRow,ids:Map<string,string>,presentation?:SitePresentation,wornBadge:WornBadge|null=null){return {publicId:ids.get("content:"+row.id)!,type:row.type,title:row.title,body:row.body,bodyTruncated:row.body_truncated,category:row.category,categorySlug:row.category_slug,slug:row.slug,publishedAt:row.published_at.toISOString(),updatedAt:row.updated_at.toISOString(),author:{wornBadge,name:row.author_name,publicId:ids.get("user:"+row.author_id)!,avatar:avatarUrl(row.author_image)},media:presentation?.media??[],reactions:presentation?.reactions??[],comments:presentation?.comments??0,demo:row.demo};}
export async function getSiteFeed(view:SiteView="featured",cursor?:string,excludeDemo=false){
 let before:{id:string;at:string;view:SiteView}|null=null;if(cursor){try{before=JSON.parse(publicIdCodec().open("cursor",cursor)??"");if(!before||before.view!==view||!validContent(before.id)||!/^\d{4}-\d{2}-\d{2}T/.test(before.at)||!Number.isFinite(Date.parse(before.at)))throw new Error();}catch{throw new ServiceError(400,"INVALID_FEED_CURSOR","分页地址无效");}}
 const rows=await readSiteFeed(view,before,excludeDemo),items=rows.slice(0,20);const ids=await routes(items.map(r=>r.id),items.map(r=>r.author_id));const last=items.at(-1);const [presentationRows,worn]=await Promise.all([readSitePresentation(items.map(r=>r.id)),readWornBadges(items.map(r=>r.author_id))]);const presentation=new Map(presentationRows.map(r=>[r.id,r]));
 return {items:items.map(r=>serialize(r,ids,presentation.get(r.id),worn.get(r.author_id)??null)),next:rows.length>20&&last?publicIdCodec().seal("cursor",JSON.stringify({id:last.id,at:last.cursor_at,view})):null};
}
export async function getSiteTopics(excludeDemo=false):Promise<SiteTopic[]>{
 return (await readSiteTopics(excludeDemo)).map(({name,slug,description,icon_url,posts})=>({name,slug,description,iconUrl:icon_url,posts}));
}
export type SiteCommunityFeed={authenticated:boolean;items:SiteContent[];next:string|null;topic:SiteTopicRef|null};
/** Community feed shared by /community and /community/[slug]. `mine` requires a
 *  signed-in viewer; guests get an empty, authenticated:false result instead of
 *  an error so the page can offer the login entry. */
export async function getSiteCommunityFeed(input:{sort?:string|null;topic?:string|null;cursor?:string|null;excludeDemo:boolean;headers:Headers}):Promise<SiteCommunityFeed>{
 const sort:CommunitySort=(communitySorts as readonly string[]).includes(input.sort??"")?input.sort as CommunitySort:"latest";
 const slug=input.topic??null;
 if(slug&&(slug.length>80||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)))throw new ServiceError(404,"PUBLIC_TOPIC_NOT_FOUND","话题不存在");
 const row=slug?await readSiteTopic(slug):undefined;
 if(slug&&!row)throw new ServiceError(404,"PUBLIC_TOPIC_NOT_FOUND","话题不存在");
 const topic=row?{name:row.name,slug:row.slug,description:row.description,iconUrl:row.icon_url}:null;
 let before:{id:string;at:string;score?:number;sort?:string;topic?:string|null}|null=null;
 if(input.cursor){try{
  before=JSON.parse(publicIdCodec().open("cursor",input.cursor)??"");
  if(!before||before.sort!==sort||(before.topic??null)!==slug||!validContent(before.id)||!/^\d{4}-\d{2}-\d{2}T/.test(before.at)||!Number.isFinite(Date.parse(before.at))||(sort==="hot"&&(typeof before.score!=="number"||!Number.isInteger(before.score))))throw new Error();
 }catch{throw new ServiceError(400,"INVALID_FEED_CURSOR","分页地址无效");}}
 let viewer:string|null=null;
 if(sort==="mine"){try{viewer=(await requireAuthenticatedUser(input.headers)).id;}catch(error){if(error instanceof ServiceError&&(error.status===401||error.status===403))return {authenticated:false,items:[],next:null,topic};throw error;}}
 const rows=await readSiteCommunityFeed({sort,topicId:row?.id??null,before,excludeDemo:input.excludeDemo,viewer});
 const items=rows.slice(0,20),ids=await routes(items.map(r=>r.id),items.map(r=>r.author_id)),last=items.at(-1);
 const [presentationRows,worn]=await Promise.all([readSitePresentation(items.map(r=>r.id)),readWornBadges(items.map(r=>r.author_id))]);const presentation=new Map(presentationRows.map(r=>[r.id,r]));
 return {authenticated:true,items:items.map(r=>serialize(r,ids,presentation.get(r.id),worn.get(r.author_id)??null)),next:rows.length>20&&last?publicIdCodec().seal("cursor",JSON.stringify({sort,topic:slug,id:last.id,at:last.cursor_at,...(sort==="hot"?{score:last.score}:{})})):null,topic};
}
export async function getSiteContent(token:string,type:"post"|"article"|"comment"):Promise<SiteContent>{
 if(type==="comment")return getSiteComment(token);
 token=token.toLowerCase();
 const id=/^(?=.*[a-z])[a-z0-9]{10}$/.test(token)?await readPublicRouteTarget(token,"content"):null;if(!validContent(id))throw missing();const row=await readSiteContent(id);if(!row||row.type!==type)throw missing();const ids=await routes([id],[row.author_id]);if(ids.get("content:"+id)!==token)throw missing();const [presentation,worn]=await Promise.all([readSitePresentation([id]),readWornBadges([row.author_id])]);return serialize(row,ids,presentation[0],worn.get(row.author_id)??null);
}
export async function getSiteProfile(token:string){token=token.toLowerCase();const id=/^(?=.*[a-z])[a-z0-9]{10}$/.test(token)?await readPublicRouteTarget(token,"user"):null;if(!id||!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw missing();const row=await readSiteProfile(id);if(!row)throw missing();const ids=await routes([],[id]);if(ids.get("user:"+id)!==token)throw missing();const badges=await readProfileBadges(id);return {badges,publicId:token,joinedAt:row.joined_at.toISOString(),name:row.name,bio:row.bio,region:row.region,homepage:row.homepage,demo:row.demo,avatar:avatarUrl(row.image),wornBadge:(await readWornBadges([id])).get(id)??null};}
export async function getSiteProfileForEditing(token:string,headers:Headers){
 const actor=await requireAuthenticatedUser(headers);
 const ids=await routes([],[actor.id]);
 if(ids.get("user:"+actor.id)!==token)throw missing();
 const [profile,details]=await Promise.all([getSiteProfile(token),getOwnMemberDetails(headers)]);
 return {...profile,...details};
}
export async function getSiteSitemap(){
 const items:{path:string;updatedAt:Date}[]=[];
 const limit=()=>{if(items.length>=49000)throw new Error("Split sitemap before reaching 49000 content URLs");};
 let after="0";
 while(items.length<49000){
  const rows=await readSiteSitemap(after);if(!rows.length)break;
  for(let i=0;i<rows.length;i+=100){
   const chunk=rows.slice(i,i+100),ids=await routes(chunk.map(r=>r.id),[]);
   for(const r of chunk){
    const token=ids.get("content:"+r.id);
    if(!token)continue;
    items.push({path:(r.type==="post"?"/threads/":"/p/")+token,updatedAt:r.updated_at});limit();
   }
  }
  after=rows.at(-1)!.id;if(rows.length<1000)break;
 }
 // Comment URLs are noindex and canonical to their thread, so they stay out of the sitemap.
 return items;
}

export type SiteContent=ReturnType<typeof serialize>&{interaction?:SiteInteraction;comment?:{parentPublicId:string;parentType:"post"|"article";parentSlug:string|null;parentCategorySlug:string|null;actionToken:string;replyToName:string|null;interaction:SiteInteraction}};
