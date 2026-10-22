import 'server-only';
import {createHash} from 'node:crypto';
import {createMemberPublication,readPublishingCategories,readOwnPublication,changeOwnPublication,PublishingStoreError} from '@sohoin/database';
import {memberPublicationSchema,memberPublicationChangeSchema} from '@sohoin/extension-api/content';
import {requireAuthenticatedUser,enforceLimit,ServiceError} from './security';
import {createShortPublicId} from './public-id';
import {normalizeMemberMentions} from './member-mentions';

export async function getPublishingOptions(headers:Headers){const actor=await requireAuthenticatedUser(headers);await enforceLimit('member-publishing-options',actor.id,120,60);return {categories:await readPublishingCategories()};}
function target(kind:string,id:string):asserts kind is 'post'|'comment'{if(!['post','comment'].includes(kind)||!/^(?=.*[a-z])[a-z0-9]{10}$/.test(id))throw new ServiceError(404,'PUBLICATION_NOT_FOUND','内容不存在');}
export async function getOwnPublication(headers:Headers,kind:string,id:string){target(kind,id);let actor;try{actor=await requireAuthenticatedUser(headers);}catch(error){if(error instanceof ServiceError&&error.status===401)return {publication:null};throw error;}return {publication:await readOwnPublication(actor.id,kind,id)??null};}
export async function updateOwnPublication(headers:Headers,kind:string,id:string,input:unknown){
 target(kind,id);const actor=await requireAuthenticatedUser(headers);await enforceLimit('member-publication-change',actor.id,30,60);
 const parsed=memberPublicationChangeSchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,'INVALID_PUBLICATION','请检查正文和附件');
 if(kind==='comment'&&parsed.data.value&&parsed.data.value.category)throw new ServiceError(400,'INVALID_PUBLICATION','回复不支持分类');
 const value=parsed.data.value?{...parsed.data.value,body:await normalizeMemberMentions(parsed.data.value.body)}:null;
 try{return await changeOwnPublication(actor.id,kind,id,parsed.data.version,value);}catch(error){publishingError(error);}
}
export function publishingError(error:unknown):never{
 if(error instanceof PublishingStoreError){
  const errors={forbidden:[403,'当前账号不能发布内容'],missing:[404,'内容不存在或已不可回复'],conflict:[409,'内容已发生变化，请刷新后重试'],media:[400,'媒体不存在或不属于当前账号；每次可选最多 9 项图片、视频或链接'],category:[400,'请选择有效的分类']} as const;
  const [status,message]=errors[error.code];throw new ServiceError(status,'PUBLISH_'+error.code.toUpperCase(),message);
 }throw error;
}
export async function publishMemberContent(headers:Headers,input:unknown){
 const actor=await requireAuthenticatedUser(headers);
 const parsed=memberPublicationSchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,'INVALID_PUBLICATION','请检查正文、分类和媒体，正文最多 5000 字，可选最多 9 项图片、视频或链接');
 const value=parsed.data;
 await enforceLimit('member-publish-'+value.kind,actor.id,value.kind==='post'?5:20,60);
 const fingerprint=createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const normalized={...value,body:await normalizeMemberMentions(value.body)};
 for(let attempt=0;attempt<8;attempt++)try{
  const result=await createMemberPublication(actor.id,{...normalized,media:value.media},value.requestId,fingerprint,createShortPublicId());
  return {...result,href:(result.type==='post'?'/threads/':'/comments/')+result.publicId};
 }catch(error){
  const pg=error as {code?:string;constraint?:string};
  if(pg.code==='23505'&&['public_route_ids_short_id_key','public_comment_ids_short_id_key'].includes(pg.constraint??''))continue;
  publishingError(error);
 }
 throw new ServiceError(503,'PUBLISH_RETRY','发布未完成，请重试');
}
