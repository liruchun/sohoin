import "server-only";
import {randomBytes,createHash} from "node:crypto";
import {MediaStoreError,readMediaList,readMediaFile,readSiteLogoFile,readSiteIconFile,readMediaReferences,insertMedia,tombstoneMedia,acquireMediaStorageLock,MediaMaintenanceBusyError,type MediaRow} from "@sohoin/database";
import {MAX_MEDIA_BYTES,mediaQuerySchema,deleteMediaSchema,type MediaAsset} from "@sohoin/extension-api/media";
import {contentIdSchema} from "@sohoin/extension-api/content";
import {requireAdministrator,enforceLimit,ServiceError} from "./security";
import {assertMediaStorage,mediaNamespace,saveMediaBytes,removeMediaBytes,loadMediaBytes} from "./media-storage";
import {sanitizeLogoSvg} from "./logo-svg";
import {buildSiteIcons} from "./site-icons";
import {buildResponsiveImages} from "./media-responsive";
import {SITE_ICON_SIZES} from "@sohoin/extension-api/media-limits";
import {insertMemberMedia,MemberMediaFullError} from "@sohoin/database";
import {createShortPublicId} from "./public-id";
import {requireAuthenticatedUser} from "./security";
import {streamVideo} from './video-http';
const state=globalThis as typeof globalThis&{sohoinMediaJobs?:number};
async function storageLock(){try{return await acquireMediaStorageLock();}catch(error){if(error instanceof MediaMaintenanceBusyError)throw new ServiceError(503,"MEDIA_MAINTENANCE","媒体正在维护，请稍后重试",5);throw error;}}
const missing=()=>new ServiceError(404,"MEDIA_NOT_FOUND","媒体不存在");
function idOf(id:unknown){const result=contentIdSchema.safeParse(id);if(!result.success)throw missing();return result.data;}
function item(row:MediaRow):MediaAsset{return {id:row.id,name:row.original_name,mimeType:row.mime_type,byteSize:Number(row.byte_size),width:row.width,height:row.height,durationMs:row.duration_ms==null?null:Number(row.duration_ms),version:row.version,createdAt:row.created_at.toISOString(),inUse:row.in_use,previewUrl:`/api/v1/admin/media/${row.id}/file?variant=thumbnail`,fileUrl:`/api/v1/admin/media/${row.id}/file`};}
async function access(headers:Headers,write=false){const actor=await requireAdministrator(headers);await enforceLimit(write?"media-write":"media-read",actor.id,write?20:240,60);return actor;}
async function stored<T>(run:()=>Promise<T>){try{return await run();}catch(error){if(error instanceof MediaStoreError){const messages={forbidden:[403,"FORBIDDEN","当前账号没有管理权限"],missing:[404,"MEDIA_NOT_FOUND","媒体不存在"],conflict:[409,"MEDIA_CONFLICT","媒体已被修改，请刷新后重试"],in_use:[409,"MEDIA_IN_USE","媒体正在被内容、头像、Logo、站点图标或分类图标使用，不能删除"]} as const;const [status,code,message]=messages[error.code];throw new ServiceError(status,code,message);}throw error;}}
export async function listMedia(headers:Headers,input:unknown){await access(headers);const query=mediaQuerySchema.safeParse(input);if(!query.success)throw new ServiceError(400,"INVALID_MEDIA_QUERY","分页参数无效");const rows=await readMediaList(query.data.before,query.data.kind);return {items:rows.slice(0,30).map(item),nextCursor:rows.length>30?rows[29].id:null};}
export async function getAdminMediaResponse(request:Request,id:unknown,variant:boolean|string=false){
 await access(request.headers);
 if(typeof variant==='string'&&variant!=='logo'&&!Object.hasOwn(SITE_ICON_SIZES,variant))throw missing();
 const row=await readMediaFile(idOf(id),variant);
 if(!row||row.storage_provider!=='local')throw missing();
 if(row.mime_type.startsWith('video/'))return streamVideo(request,row);
 return new Response(request.method==='HEAD'?null:new Uint8Array(await loadMediaBytes(row.storage_namespace,row.storage_key,Number(row.byte_size))),{headers:{'Content-Type':row.mime_type,'Cache-Control':'private, no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'Cross-Origin-Resource-Policy':'same-origin','Content-Disposition':'inline'}});
}
export async function getMediaDetail(headers:Headers,id:unknown,input:unknown={}){await access(headers);const parsedId=idOf(id);const query=mediaQuerySchema.safeParse(input);if(!query.success)throw new ServiceError(400,"INVALID_MEDIA_QUERY","分页参数无效");const asset=await readMediaFile(parsedId);if(!asset)throw missing();const rows=await readMediaReferences(parsedId,query.data.before);return {asset:item(asset),references:{items:rows.slice(0,30).map(row=>({id:row.id,contentId:row.content_id,title:row.title,status:row.status,role:row.role,position:row.position})),nextCursor:rows.length>30?rows[29].id:null}};}
export async function uploadMedia(headers:Headers,source:{name:string;mime:string;purpose?:"logo"|"icon"|"badge";read:()=>Promise<Uint8Array>}){
 const actor=await access(headers,true);return storeMediaUpload(actor.id,source);
}
/** Trusted local maintenance entry point. insertMedia rechecks the administrator inside its transaction. Not an HTTP API. */
export async function storeMediaUpload(actorId:string,source:{name:string;mime:string;purpose?:"logo"|"icon"|"badge";read:()=>Promise<Uint8Array>}){
 return processMediaUpload(actorId,source,false);
}
export async function uploadMemberImage(headers:Headers,source:{name:string;mime:string;read:()=>Promise<Uint8Array>}){
 const actor=await requireAuthenticatedUser(headers);await enforceLimit('member-media-write',actor.id,20,60);
 return processMediaUpload(actor.id,source,true);
}
async function processMediaUpload(actorId:string,source:{name:string;mime:string;purpose?:"logo"|"icon"|"badge";read:()=>Promise<Uint8Array>},member:boolean){
 assertMediaStorage();
 if(!source.name||source.name.length>255||/[\x00-\x1f\x7f/\\]/.test(source.name))throw new ServiceError(400,"INVALID_FILE_NAME","文件名无效或过长");
 const isSvg=(source.purpose==="logo"||source.purpose==="icon"||source.purpose==="badge")&&source.mime==="image/svg+xml";
 if(!isSvg&&!["image/jpeg","image/png","image/webp"].includes(source.mime))throw new ServiceError(415,"UNSUPPORTED_IMAGE","支持 JPEG、PNG 和 WebP 静态图片；Logo、图标和勋章上传另支持 SVG");
 if((state.sohoinMediaJobs??0)>=2)throw new ServiceError(503,"MEDIA_BUSY","图片处理繁忙，请稍后重试",5);
 state.sohoinMediaJobs=(state.sohoinMediaJobs??0)+1;const written:string[]=[];let release:(()=>Promise<void>)|undefined;
 try{
  release=await storageLock();
  let bytes=Buffer.from(await source.read());if(!bytes.length)throw new ServiceError(400,"EMPTY_IMAGE","请选择非空图片");if(bytes.length>MAX_MEDIA_BYTES)throw new ServiceError(413,"IMAGE_TOO_LARGE","图片不能超过 10 MiB");
  if(member&&bytes.length>5*1024*1024)throw new ServiceError(413,'IMAGE_TOO_LARGE','图片不能超过 5 MiB');
  const sourceChecksum=createHash('sha256').update(bytes).digest('hex');
  // Retain only parsed, validated static SVG; WebP is a separate library thumbnail.
  if(isSvg)bytes=sanitizeLogoSvg(bytes);
  const signature=bytes.subarray(0,12);const isJpeg=signature[0]===255&&signature[1]===216&&signature[2]===255;
  const isPng=signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp=signature.toString("ascii",0,4)==="RIFF"&&signature.toString("ascii",8,12)==="WEBP";
  const actual=isJpeg?"image/jpeg":isPng?"image/png":isWebp?"image/webp":"";
  if(!isSvg&&actual!==source.mime)throw new ServiceError(415,"IMAGE_TYPE_MISMATCH","图片实际格式与声明不一致");
  // libvips can read only the first APNG frame; reject animation explicitly.
  if(isPng){for(let offset=8;offset+12<=bytes.length;){const length=bytes.readUInt32BE(offset);if(bytes.toString("ascii",offset+4,offset+8)==="acTL")throw new ServiceError(415,"ANIMATED_IMAGE","暂不支持动态图片");if(length>bytes.length-offset-12)break;offset+=length+12;}}
  const {default:sharp}=await import("sharp");let output,thumb;
  try{const options={limitInputPixels:20_000_000,failOn:"warning" as const,...(isSvg?{density:144}:{})};const metadata=await sharp(bytes,options).timeout({seconds:20}).metadata();if((metadata.pages??1)!==1||!metadata.width||!metadata.height||(isSvg&&metadata.format!=="svg"))throw new Error("Unsupported image");
   output=await sharp(bytes,options).rotate().webp({quality:85}).timeout({seconds:20}).toBuffer({resolveWithObject:true});
   thumb=await sharp(output.data,options).resize({width:480,height:480,fit:"inside",withoutEnlargement:true}).webp({quality:75}).timeout({seconds:10}).toBuffer({resolveWithObject:true});
  }catch{throw new ServiceError(400,"INVALID_IMAGE","图片无法处理，请使用完整的静态图片，且不超过 2,000 万像素");}
  if(output.data.length>MAX_MEDIA_BYTES)throw new ServiceError(413,"IMAGE_TOO_LARGE","处理后的图片仍超过 10 MiB，请缩小后重试");
  const date=new Date();const prefix=`${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,"0")}/${randomBytes(16).toString("hex")}`;
  const imageKey=prefix+(isSvg?".svg":".webp"),thumbKey=prefix+"-thumb.webp",imageBytes=isSvg?bytes:output.data;
  await saveMediaBytes(imageKey,imageBytes);written.push(imageKey);await saveMediaBytes(thumbKey,thumb.data);written.push(thumbKey);
  const variants:{variant:string;key:string;mime:string;size:number;width:number;height:number}[]=[];
  if(!member&&!isSvg&&!source.purpose){
   for(const image of await buildResponsiveImages(output.data,output.info.width)){
    const key=prefix+"-"+image.variant+".webp";
    await saveMediaBytes(key,image.data);written.push(key);
    variants.push({variant:image.variant,key,mime:"image/webp",size:image.data.length,width:image.width,height:image.height});
   }
  }
  if(source.purpose==="icon"){
   let icons;
   try{icons=await buildSiteIcons(bytes,isSvg);}catch{throw new ServiceError(400,"INVALID_ICON","无法生成图标，请使用完整静态图片或独立 SVG");}
   for(const icon of icons){const key=prefix+"-"+icon.variant+".png";await saveMediaBytes(key,icon.data);written.push(key);variants.push({variant:icon.variant,key,mime:"image/png",size:icon.data.length,width:icon.width,height:icon.height});}
  }
  const storedImage=(key:string,result:typeof output)=>({key,mime:"image/webp",size:result.data.length,width:result.info.width,height:result.info.height});
  const image={...storedImage(imageKey,output),mime:isSvg?"image/svg+xml":"image/webp",size:imageBytes.length};
  let id:string,created=true;
  const checksum=createHash('sha256').update(imageBytes).digest('hex');
  if(member){
   try{const result=await insertMemberMedia(actorId,createShortPublicId(),sourceChecksum,mediaNamespace,source.name,checksum,image,storedImage(thumbKey,thumb));id=result.id;created=result.created;}
   catch(error){if(error instanceof MemberMediaFullError)throw new ServiceError(409,'MEDIA_LIBRARY_FULL','媒体库最多保存 500 张图片');if(error instanceof MediaStoreError)throw new ServiceError(403,'FORBIDDEN','当前账号不可上传图片');throw error;}
  }else id=await stored(()=>insertMedia(actorId,mediaNamespace,source.name,checksum,image,storedImage(thumbKey,thumb),variants));
  // Commit is the success boundary: never remove files after a successful metadata transaction.
  if(created)written.length=0;const row=await readMediaFile(id);if(!row)throw missing();return item(row);
 }finally{try{for(const key of written){try{await removeMediaBytes(mediaNamespace,key);}catch{console.error("Uncommitted media cleanup failed");}}}finally{await release?.();state.sohoinMediaJobs=(state.sohoinMediaJobs??1)-1;}}
}
export async function deleteMedia(headers:Headers,id:unknown,input:unknown){const actor=await access(headers,true);const value=deleteMediaSchema.safeParse(input);if(!value.success)throw new ServiceError(400,"INVALID_MEDIA_VERSION","删除版本无效");assertMediaStorage();const release=await storageLock();try{const files=await stored(()=>tombstoneMedia(actor.id,idOf(id),value.data.version));let cleanupPending=false;for(const file of files){try{if(file.storage_provider!=="local")throw new Error("Unsupported provider");await removeMediaBytes(file.storage_namespace,file.storage_key);}catch{cleanupPending=true;console.error("Deleted media cleanup pending");}}return {deleted:true as const,cleanupPending};}finally{await release();}}
export async function getMediaFile(headers:Headers,id:unknown,thumbnail:boolean|string=false){await access(headers);if(typeof thumbnail==="string"&&thumbnail!=="logo"&&!Object.hasOwn(SITE_ICON_SIZES,thumbnail))throw missing();const row=await readMediaFile(idOf(id),thumbnail);if(!row||row.storage_provider!=="local")throw missing();return {bytes:await loadMediaBytes(row.storage_namespace,row.storage_key,Number(row.byte_size)),mime:row.mime_type};}
export async function getSiteLogo(variant:unknown){if(variant!=="normal"&&variant!=="dark")throw missing();const row=await readSiteLogoFile(variant);if(!row||row.storage_provider!=="local")throw missing();return {bytes:await loadMediaBytes(row.storage_namespace,row.storage_key,Number(row.byte_size)),mime:row.mime_type};}
export async function getSiteIcon(variant:unknown){if(typeof variant!=="string"||!Object.hasOwn(SITE_ICON_SIZES,variant))throw missing();const row=await readSiteIconFile(variant);if(!row||row.storage_provider!=="local")throw missing();return {bytes:await loadMediaBytes(row.storage_namespace,row.storage_key,Number(row.byte_size)),mime:row.mime_type};}
export async function generateSiteIcons(headers:Headers,mediaId:unknown){const file=await getMediaFile(headers,mediaId);return uploadMedia(headers,{name:file.mime==="image/svg+xml"?"site-icons.svg":"site-icons.webp",mime:file.mime,purpose:"icon",read:async()=>file.bytes});}
