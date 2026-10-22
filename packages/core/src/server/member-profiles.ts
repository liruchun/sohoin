import 'server-only';
import {MEMBER_MEDIA_PAGE_SIZE,readMemberMediaPage,readMemberMediaById,readMemberMediaFile,readVisibleMemberMedia,readMemberDetails,readMemberContacts,writeMemberDetails,readMediaFile,readPublicRouteTarget,ProfileStoreError,type MemberMediaRow} from '@sohoin/database';
import {memberMediaIdSchema,memberProfileUpdateSchema,type MemberMedia,type MemberProfileDetails,type ContactKind} from '@sohoin/extension-api/profiles';
import {requireAuthenticatedUser,ServiceError,enforceLimit,checkWriteOrigin} from './security';
import {uploadMemberImage} from './media';
import {readMediaRequestBytes} from './media-http';
import {loadMediaBytes} from './media-storage';
import {avatarUrl} from './avatar-url';

const missing=()=>new ServiceError(404,'MEDIA_NOT_FOUND','图片不存在或无权访问');
function media(row:MemberMediaRow):MemberMedia{return {id:row.public_id,file:{name:row.original_name,type:row.mime_type,size:Number(row.byte_size)},url:`/api/v1/account/media/${row.public_id}`,width:row.width,height:row.height,durationMs:row.duration_ms==null?null:Number(row.duration_ms)};}
export async function listOwnMedia(headers:Headers,before?:string,kind:string="image"){const actor=await requireAuthenticatedUser(headers);await enforceLimit('member-media-read',actor.id,240,60);if(before&&!memberMediaIdSchema.safeParse(before).success)throw missing();if(kind!=='image'&&kind!=='video'&&kind!=='all')throw new ServiceError(400,'INVALID_MEDIA_QUERY','媒体类型无效');const rows=await readMemberMediaPage(actor.id,before,kind);return {items:rows.slice(0,MEMBER_MEDIA_PAGE_SIZE).map(media),next:rows.length>MEMBER_MEDIA_PAGE_SIZE?rows[MEMBER_MEDIA_PAGE_SIZE-1].public_id:null};}
export async function uploadOwnMedia(request:Request){
 checkWriteOrigin(request);let name:string;
 try{name=decodeURIComponent(request.headers.get('x-file-name')??'');}catch{throw new ServiceError(400,'INVALID_FILE_NAME','文件名编码无效');}
 const uploaded=await uploadMemberImage(request.headers,{name,mime:request.headers.get('content-type')?.split(';')[0].trim()??'',read:()=>readMediaRequestBytes(request,5*1024*1024)});
 const actor=await requireAuthenticatedUser(request.headers);
 const row=await readMemberMediaById(actor.id,uploaded.id);if(!row)throw missing();return media(row);
}
export async function getMemberImage(headers:Headers,id:string,scope:'own'|'avatar'|'contact',thumbnail=false){
 if(!memberMediaIdSchema.safeParse(id).success)throw missing();
 let viewer:string|null=null;
 if(scope!=='avatar')try{viewer=(await requireAuthenticatedUser(headers)).id;}catch(error){if(scope==='own'||!(error instanceof ServiceError&&error.status===401))throw error;}
 const row=scope==='own'?await readMemberMediaFile(viewer!,id):await readVisibleMemberMedia(id,viewer,scope==='contact');
 if(!row)throw missing();
 const file=thumbnail?await readMediaFile(row.id,true):row;if(!file)throw missing();
 return {bytes:await loadMediaBytes(file.storage_namespace,file.storage_key,Number(file.byte_size)),mime:file.mime_type};
}
export async function getOwnMemberDetails(headers:Headers):Promise<MemberProfileDetails>{
 const actor=await requireAuthenticatedUser(headers);
 const details=await readMemberDetails(actor.id);
 if(!details)throw new ServiceError(404,'PROFILE_NOT_FOUND','用户不存在');
 return {name:details.name,bio:details.bio,avatar:avatarUrl(details.image),version:details.version,region:details.region,visibility:details.visibility,contacts:details.contacts.map(c=>({kind:c.kind as ContactKind,text:c.text,media:c.media?media(c.media):null}))};
}
export async function saveMemberDetails(headers:Headers,input:unknown){
 const actor=await requireAuthenticatedUser(headers);await enforceLimit('member-profile-write',actor.id,30,60);
 const parsed=memberProfileUpdateSchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,'INVALID_PROFILE','请检查昵称、简介和联系方式');
 try{return await writeMemberDetails(actor.id,parsed.data);}catch(error){
  if(error instanceof ProfileStoreError){if(error.code==='conflict')throw new ServiceError(409,'PROFILE_CONFLICT','资料已在其他页面修改，请刷新后重试');if(error.code==='missing')throw missing();throw new ServiceError(403,'FORBIDDEN','当前账号不可修改资料');}throw error;
 }
}
export async function getVisibleMemberContacts(headers:Headers,publicId:string){
 if(!memberMediaIdSchema.safeParse(publicId).success)throw missing();
 const user=await readPublicRouteTarget(publicId,'user');if(!user)throw missing();
 let viewer:string|null=null;try{viewer=(await requireAuthenticatedUser(headers)).id;}catch(error){if(!(error instanceof ServiceError&&error.status===401))throw error;}
 return (await readMemberContacts(user,viewer)).map(c=>({kind:c.kind as ContactKind,text:c.text,qrUrl:c.media_id?`/api/member-media/${c.media_id}?contact=1`:null}));
}
