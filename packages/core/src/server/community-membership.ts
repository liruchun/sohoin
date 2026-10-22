import "server-only";
import {readSiteCategoryMembership,writeSiteCategoryMembership} from "@sohoin/database";
import {categoryMembershipSchema} from "@sohoin/extension-api/community";
import {enforceLimit,requireAuthenticatedUser,ServiceError} from "./security";

export type SiteCategoryMembership={authenticated:boolean;joined:boolean};
const slugPattern=/^[a-z0-9]+(-[a-z0-9]+)*$/;
function topicSlug(value:unknown){
 if(typeof value!=="string"||value.length>80||!slugPattern.test(value))throw new ServiceError(404,"PUBLIC_TOPIC_NOT_FOUND","话题不存在");
 return value;
}
/** The page calls this with the same headers it already uses for the feed. */
export async function getSiteCategoryMembership(headers:Headers,slugInput:unknown):Promise<SiteCategoryMembership>{
 const slug=topicSlug(slugInput);
 let actor;
 try{actor=await requireAuthenticatedUser(headers);}catch(error){
  if(error instanceof ServiceError&&(error.status===401||error.status===403))return {authenticated:false,joined:false};
  throw error;
 }
 return {authenticated:true,joined:await readSiteCategoryMembership(slug,actor.id)};
}
/** Join/leave is idempotent; the single write statement also proves the category exists. */
export async function setSiteCategoryMembership(headers:Headers,slugInput:unknown,input:unknown){
 const actor=await requireAuthenticatedUser(headers);
 await enforceLimit("community-membership-write",actor.id,60,60);
 const parsed=categoryMembershipSchema.safeParse(input);
 if(!parsed.success)throw new ServiceError(400,"INVALID_MEMBERSHIP_INPUT","操作参数无效");
 const result=await writeSiteCategoryMembership(topicSlug(slugInput),actor.id,parsed.data.joined);
 if(!result.exists)throw new ServiceError(404,"PUBLIC_TOPIC_NOT_FOUND","话题不存在");
 return {joined:parsed.data.joined};
}
