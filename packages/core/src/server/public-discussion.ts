import {plainMentionText} from "@sohoin/extension-api/mentions";
import {avatarUrl} from "./avatar-url";
import "server-only";
import {readWornBadges,readCommentPresentation,readSiteAncestorReplyCounts} from "@sohoin/database";
import {readSiteContentHead,readSiteCommentParent,readSiteCommentRoots,readSiteCommentReplies,readInteractionBatch,readPublicCommentIds,savePublicCommentIds,readSiteSelectedComment,readSiteDescendantReplies,type PublicCommentRow} from "@sohoin/database";
import {publicRoutes} from "./public-routes";
import type {SiteContent} from "./public-site";
import {requireAuthenticatedUser} from "./security";
import {publicIdCodec,createShortPublicId} from "./public-id";
import {ServiceError} from "./security";

export type SiteContentHead={publicId:string;title:string;excerpt:string;updatedAt:string;publishedAt:string;authorName:string;demo:boolean;slug:string|null;categorySlug:string|null;parent:{publicId:string;type:"post"|"article";slug:string|null;categorySlug:string|null}|null};
export async function getSiteContentHead(token:string,type:"post"|"article"|"comment"):Promise<SiteContentHead>{
 if(!/^(?=.*[a-z])[a-z0-9]{10}$/.test(token))throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
 if(type==="comment"){
  const content=await getSiteComment(token);
  // Comment URLs are not indexed; their canonical target is the parent thread.
  const parent=content.comment?await getSiteContentHead(content.comment.parentPublicId,content.comment.parentType):null;
  return {publicId:token,title:content.title,excerpt:plainMentionText(content.body).slice(0,160),updatedAt:content.updatedAt,publishedAt:content.publishedAt,authorName:content.author.name,demo:content.demo,slug:null,categorySlug:null,
   parent:parent&&content.comment?{publicId:parent.publicId,type:content.comment.parentType,slug:parent.slug,categorySlug:parent.categorySlug}:null};
 }
 const row=await readSiteContentHead(token,type);
 if(!row)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
 return {publicId:token,title:row.title,excerpt:plainMentionText(row.excerpt),updatedAt:row.updated_at.toISOString(),publishedAt:row.published_at.toISOString(),authorName:row.author_name,demo:row.demo,slug:row.slug,categorySlug:row.category_slug,parent:null};
}
export type DiscussionQuery={commentsBefore?:string;thread?:string;repliesBefore?:string;comment?:string};
export async function commentRoutes(ids:string[]){
 const requested=[...new Set(ids)];if(requested.length>50)throw new Error("Comment route batch exceeded");
 for(let attempt=0;attempt<8;attempt++){
  const rows=await readPublicCommentIds(requested),known=new Map(rows.map(row=>[row.id,row.token]));
  const missing=requested.filter(id=>!known.has(id));if(!missing.length)return known;
  try{await savePublicCommentIds(missing.map(id=>({id,token:createShortPublicId()})));}
  catch(error){const e=error as {code?:string;constraint?:string};if(e.code!=="23505"||e.constraint!=="public_comment_ids_short_id_key")throw error;}
 }
 throw new Error("Unable to allocate public comment IDs");
}
function cursor(token:string,kind:string,id:string){return publicIdCodec().seal("cursor",JSON.stringify([token,kind,id]));}
function decode(value:string|undefined,token:string,kind:string){
 if(value===undefined)return null;
 try{if(typeof value!=="string")throw new Error();const data=JSON.parse(publicIdCodec().open("cursor",value)??"");
  if(!Array.isArray(data)||data.length!==3||data[0]!==token||data[1]!==kind||typeof data[2]!=="string"||!/^[1-9][0-9]{0,18}$/.test(data[2])||BigInt(data[2])>9223372036854775807n)throw new Error();
  return data[2] as string;
 }catch{throw new ServiceError(400,"INVALID_COMMENT_CURSOR","讨论分页地址无效");}
}
export function readCommentActionToken(value:string,token:string){return decode(value,token,"comment-action")!;}
export async function getSiteDiscussion(token:string,type:"post"|"article"|"comment",query:DiscussionQuery={},headers?:Headers):Promise<Awaited<ReturnType<typeof readParentDiscussion>>>{
 if(!/^(?=.*[a-z])[a-z0-9]{10}$/.test(token))throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
 if(type==="comment"){
  const parent=await readSiteCommentParent(token);if(!parent)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
  const page=await readParentDiscussion(parent.token,parent.type,{...query,comment:token},headers);
  const content=page.selected!.content;
  return {...page,head:{publicId:token,title:content.title,excerpt:plainMentionText(content.body).slice(0,160),updatedAt:content.updatedAt,publishedAt:content.publishedAt,authorName:content.author.name,demo:content.demo,slug:null,categorySlug:null,
   parent:{publicId:page.head.publicId,type:parent.type,slug:page.head.slug,categorySlug:page.head.categorySlug}}};
 }
 return readParentDiscussion(token,type,query,headers);
}
async function readParentDiscussion(token:string,type:"post"|"article",query:DiscussionQuery,headers?:Headers){
 const parent=await readSiteContentHead(token,type);
 if(!parent)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
 if(query.comment!==undefined&&(typeof query.comment!=="string"||!/^(?=.*[a-z])[a-z0-9]{10}$/.test(query.comment)))throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 if(query.comment&&(query.thread||query.commentsBefore))throw new ServiceError(400,"INVALID_COMMENT_CURSOR","讨论分页地址无效");
 const selected=query.comment?await readSiteSelectedComment(parent.id,query.comment):undefined;
 if(query.comment&&!selected)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 const root=decode(query.thread,token,"thread"),before=decode(query.commentsBefore,token,"roots"),replyKind=selected?"branch-forward:"+selected.id:"replies-forward:"+(root??""),replyBefore=decode(query.repliesBefore,token,replyKind);
 if((replyBefore&&!root&&!selected)||(root&&before))throw new ServiceError(400,"INVALID_COMMENT_CURSOR","讨论分页地址无效");
 const pageSize=selected?5:10;
 const rows=selected?await readSiteDescendantReplies(parent.id,selected.id,replyBefore):await readSiteCommentRoots(parent.id,before,root),roots=rows.slice(0,pageSize);
 const replies=selected?[]:await readSiteCommentReplies(parent.id,roots.map(r=>r.id),replyBefore);
 const replyLimit=replyBefore?5:3;
 const displayed=[...(selected?[selected]:[]),...roots,...roots.flatMap(root=>replies.filter(reply=>reply.root_id===root.id).slice(0,replyLimit))];
 const loaded=await loadCommentItems(displayed,token,type,parent.demo,headers,{slug:parent.slug,categorySlug:parent.category_slug});
 const byId=new Map(displayed.map((row,index)=>[row.id,loaded[index]]));
 const comment=(row:PublicCommentRow)=>byId.get(row.id)!;
 return {selected:selected?comment(selected):null,head:{publicId:token,title:parent.title,excerpt:plainMentionText(parent.excerpt),updatedAt:parent.updated_at.toISOString(),publishedAt:parent.published_at.toISOString(),authorName:parent.author_name,demo:parent.demo,slug:parent.slug,categorySlug:parent.category_slug,parent:null as SiteContentHead["parent"]},
  threads:roots.map(r=>{const items=replies.filter(item=>item.root_id===r.id);return {comment:comment(r),token:cursor(token,"thread",r.id),replies:items.slice(0,replyLimit).map(comment),next:items.length>replyLimit?cursor(token,"replies-forward:"+r.id,items[replyLimit-1].id):null};}),
  next:rows.length>pageSize?cursor(token,selected?replyKind:"roots",roots[pageSize-1].id):null};
}
export type SiteComment=Awaited<ReturnType<typeof loadCommentItems>>[number];
export async function getSiteAncestorReplyCounts(publicId:string){
 if(typeof publicId!=="string"||!/^(?=.*[a-z])[a-z0-9]{10}$/.test(publicId))throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 return readSiteAncestorReplyCounts(publicId);
}
/** An inline branch uses the same visibility checks and cursors as comment detail. */
export async function getSiteReplyBranch(publicId:string,before:string|undefined,headers?:Headers){
 if(!/^(?=.*[a-z])[a-z0-9]{10}$/.test(publicId))throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 const parent=await readSiteCommentParent(publicId);
 if(!parent)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 const head=await readSiteContentHead(parent.token,parent.type);
 const selected=head?await readSiteSelectedComment(head.id,publicId):undefined;
 if(!head||!selected)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 const limit=5;
 const rows=await readSiteDescendantReplies(head.id,selected.id,decode(before,parent.token,"branch-forward:"+selected.id));
 const visible=rows.slice(0,limit),items=await loadCommentItems(visible,parent.token,parent.type,head.demo,headers,{slug:head.slug,categorySlug:head.category_slug});
 return {items,next:rows.length>limit?cursor(parent.token,"branch-forward:"+selected.id,visible[limit-1].id):null};
}

async function loadCommentItems(rows:PublicCommentRow[],token:string,type:"post"|"article",demo:boolean,headers?:Headers,parent?:{slug:string|null;categorySlug:string|null}){
 const [publicIds,authors,worn,presentation]=await Promise.all([commentRoutes(rows.map(row=>row.id)),publicRoutes([],rows.map(row=>row.author_id)),readWornBadges(rows.map(row=>row.author_id)),readCommentPresentation(rows.map(row=>row.id))]);
 const media=new Map(presentation.map(item=>[item.id,item.media]));
 let actor="";
 if(headers)try{actor=(await requireAuthenticatedUser(headers)).id;}catch(error){if(!(error instanceof ServiceError&&(error.status===401||error.status===403)))throw error;}
 const summaries=new Map((rows.length?await readInteractionBatch(actor,"comments",rows.map(row=>row.id),true):[]).map(row=>[row.id,row]));
 const comment=(row:PublicCommentRow)=>{
  const summary=summaries.get(row.id);
  const item={authorPublicId:authors.get("user:"+row.author_id)!,wornBadge:worn.get(row.author_id)??null,publicId:publicIds.get(row.id)!,body:row.body,authorName:row.author_name,avatar:avatarUrl(row.author_image),createdAt:row.created_at.toISOString(),replyToName:row.reply_to_name,
   replies:row.reply_count,actionToken:cursor(token,"comment-action",row.id),interaction:{publicId:token,reactions:summary?.reactions??[],myReactions:summary?.my_reactions??[],bookmarked:summary?.bookmarked??false}};
  const content:SiteContent={publicId:item.publicId,type:"comment",title:"",body:item.body,bodyTruncated:false,category:null,categorySlug:null,slug:null,publishedAt:item.createdAt,updatedAt:row.updated_at.toISOString(),author:{publicId:authors.get("user:"+row.author_id)!,name:item.authorName,avatar:item.avatar,wornBadge:item.wornBadge},media:media.get(row.id)??[],reactions:[],comments:item.replies,participants:[],demo,comment:{parentPublicId:token,parentType:type,parentSlug:parent?.slug??null,parentCategorySlug:parent?.categorySlug??null,actionToken:item.actionToken,replyToName:item.replyToName,interaction:item.interaction}};
  return {...item,content};
 };
 return rows.map(comment);
}

export async function getSiteComment(token:string):Promise<SiteContent>{
 if(!/^(?=.*[a-z])[a-z0-9]{10}$/.test(token))throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 const parent=await readSiteCommentParent(token);
 if(!parent)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 const head=await readSiteContentHead(parent.token,parent.type);
 const row=head?await readSiteSelectedComment(head.id,token):undefined;
 if(!head||!row)throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","讨论不存在或未公开");
 return (await loadCommentItems([row],parent.token,parent.type,head.demo,undefined,{slug:head.slug,categorySlug:head.category_slug}))[0].content;
}
