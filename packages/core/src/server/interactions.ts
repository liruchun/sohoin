import "server-only";
import {cache} from "react";
import {readSiteCommentTarget} from "@sohoin/database";
import {siteCommentActionSchema} from "@sohoin/extension-api/interactions";
import {readCommentActionToken} from "./public-discussion";
import {readReactionTypes,updateStoredReactionType,writeInteraction,readInteractionBatch,readOwnBookmarks,readSiteInteractionTargets,InteractionStoreError} from "@sohoin/database";
import {interactionKindSchema,setReactionSchema,setBookmarkSchema,interactionBatchSchema,bookmarkQuerySchema,reactionCodeSchema,updateReactionTypeSchema} from "@sohoin/extension-api/interactions";
import {contentIdSchema} from "@sohoin/extension-api/content";
import {siteInteractionIdSchema,siteInteractionBatchSchema,setSiteReactionSchema,type SiteInteraction} from "@sohoin/extension-api/interactions";
import {requireAuthenticatedUser,requireAdministrator,enforceLimit,ServiceError} from "./security";
function parse<T>(schema:{safeParse:(input:unknown)=>{success:true;data:T}|{success:false}},input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw new ServiceError(400,"INVALID_INTERACTION_INPUT","互动参数无效");return result.data;}
async function access(headers:Headers,write=false){const actor=await requireAuthenticatedUser(headers);await enforceLimit(write?"interactions-write":"interactions-read",actor.id,write?60:120,60);return actor;}
async function store<T>(run:()=>Promise<T>){try{return await run();}catch(error){if(error instanceof InteractionStoreError){const values={forbidden:[403,"FORBIDDEN","当前账号无法操作"],missing:[404,"INTERACTION_TARGET_NOT_FOUND","对象不存在或不可访问"],invalid_reaction:[400,"INVALID_REACTION","该表情不存在或已停用"],conflict:[409,"REACTION_TYPE_CONFLICT","表情设置已更新，请刷新后重试"],reaction_limit:[409,"REACTION_LIMIT","最多选择 5 个表情，请先取消一个"]} as const;const [status,code,message]=values[error.code];throw new ServiceError(status,code,message);}throw error;}}
export const getReactionTypes=cache(async()=>({items:(await readReactionTypes(true)).map(({version,...item})=>item)}));
export async function getAdminReactionTypes(headers:Headers){await requireAdministrator(headers);return {items:await readReactionTypes(true)};}
export async function updateReactionType(headers:Headers,code:unknown,input:unknown){const actor=await requireAdministrator(headers);await enforceLimit("reaction-types-write",actor.id,30,60);return store(()=>updateStoredReactionType(actor.id,parse(reactionCodeSchema,code),parse(updateReactionTypeSchema,input)));}
export async function setReaction(headers:Headers,kind:unknown,id:unknown,input:unknown){const actor=await access(headers,true);const value=parse(setReactionSchema,input);return store(()=>writeInteraction(actor.id,parse(interactionKindSchema,kind),parse(contentIdSchema,id),value));}
export async function setBookmark(headers:Headers,kind:unknown,id:unknown,input:unknown){const actor=await access(headers,true);const value=parse(setBookmarkSchema,input);return store(()=>writeInteraction(actor.id,parse(interactionKindSchema,kind),parse(contentIdSchema,id),value));}
export async function getInteractionBatch(headers:Headers,kind:unknown,input:unknown){const actor=await access(headers);const {ids}=parse(interactionBatchSchema,input);return {items:(await readInteractionBatch(actor.id,parse(interactionKindSchema,kind),ids)).map(row=>({id:row.id,reactions:row.reactions,myReaction:row.my_reaction,myReactions:row.my_reactions,bookmarked:row.bookmarked}))};}
export async function getOwnBookmarks(headers:Headers,kind:unknown,input:unknown){const actor=await access(headers);const query=parse(bookmarkQuerySchema,input),rows=await readOwnBookmarks(actor.id,parse(interactionKindSchema,kind),query.before);return {items:rows.slice(0,30).map(row=>({bookmarkId:row.bookmark_id,id:row.id,contentId:row.content_id,preview:row.preview,createdAt:row.created_at.toISOString()})),nextCursor:rows.length>30?rows[29].bookmark_id:null};}

async function siteSummary(actor:string,targets:{id:string;token:string}[]):Promise<SiteInteraction[]>{
 if(!targets.length)return [];
 const rows=await readInteractionBatch(actor,"content",targets.map(target=>target.id),true);
 const tokens=new Map(targets.map(target=>[target.id,target.token]));
 return rows.map(row=>({publicId:tokens.get(row.id)!,myReactions:row.my_reactions,bookmarked:row.bookmarked,reactions:row.reactions}));
}
export async function getSiteInteractions(headers:Headers,input:unknown){
 const {ids}=parse(siteInteractionBatchSchema,input);
 let actor;
 try{actor=await requireAuthenticatedUser(headers);}catch(error){
  if(error instanceof ServiceError&&(error.status===401||error.status===403))return {authenticated:false,items:[] as SiteInteraction[]};
  throw error;
 }
 await enforceLimit("interactions-read",actor.id,120,60);
 return {authenticated:true,items:await siteSummary(actor.id,await readSiteInteractionTargets(ids))};
}
/** Public ID translation never bypasses shared authentication or transactional visibility. */
export async function setSiteInteraction(headers:Headers,token:unknown,action:unknown,input:unknown){
 const actor=await access(headers,true),publicId=parse(siteInteractionIdSchema,token);
 if(action!=="reaction"&&action!=="bookmark")throw new ServiceError(404,"NOT_FOUND","操作不存在");
 const value=action==="reaction"?parse(setSiteReactionSchema,input):parse(setBookmarkSchema,input);
 const targets=await readSiteInteractionTargets([publicId]),target=targets[0];
 if(!target)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
 await store(()=>writeInteraction(actor.id,"content",target.id,value,true));
 const summary=(await siteSummary(actor.id,targets))[0];
 if(!summary)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
 return summary;
}

export async function setSiteCommentInteraction(headers:Headers,token:unknown,action:unknown,input:unknown):Promise<SiteInteraction>{
 const actor=await access(headers,true),publicId=parse(siteInteractionIdSchema,token);
 if(action!=="reaction"&&action!=="bookmark")throw new ServiceError(404,"NOT_FOUND","操作不存在");
 const body=parse(siteCommentActionSchema,input),id=readCommentActionToken(body.commentToken,publicId);
 const value=action==="reaction"?parse(setSiteReactionSchema,body.value):parse(setBookmarkSchema,body.value);
 if(!await readSiteCommentTarget(publicId,id))throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 await store(()=>writeInteraction(actor.id,"comments",id,value,true));
 const row=(await readInteractionBatch(actor.id,"comments",[id],true))[0];
 if(!row)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 return {publicId,myReactions:row.my_reactions,bookmarked:row.bookmarked,reactions:row.reactions};
}
