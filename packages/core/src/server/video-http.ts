import 'server-only';
import {open} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {readMemberMediaFile,readPublicMediaFile,readMediaFile} from '@sohoin/database';
import {MAX_VIDEO_BYTES} from '@sohoin/extension-api/video';
import {memberMediaIdSchema} from '@sohoin/extension-api/profiles';
import {requireAuthenticatedUser,ServiceError} from './security';
import {getPublicMedia} from './public-media';
import {mediaFilePath,loadMediaBytes} from './media-storage';

const headersFor=(mime:string,indexable=false)=>new Headers({'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin',...(!indexable?{'X-Robots-Tag':'noindex'}:{})});
type VideoFile={storage_namespace:string;storage_key:string;mime_type:string;byte_size:string};
export async function streamVideo(request:Request,file:VideoFile,indexable=false){
 const total=Number(file.byte_size),headers=headersFor(file.mime_type,indexable);
 headers.set('Accept-Ranges','bytes');
 let start=0,end=total-1;
 const range=request.headers.get('range');
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match||(!match[1]&&!match[2])){headers.set('Content-Range',`bytes */${total}`);return new Response(null,{status:416,headers});}
  if(!match[1])start=Math.max(0,total-Number(match[2]));
  else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=total||end<start){headers.set('Content-Range',`bytes */${total}`);return new Response(null,{status:416,headers});}
  headers.set('Content-Range',`bytes ${start}-${end}/${total}`);
 }
 headers.set('Content-Length',String(end-start+1));
 let handle;
 try{
  handle=await open(mediaFilePath(file.storage_namespace,file.storage_key),'r');
  const info=await handle.stat();
  if(!info.isFile()||info.size!==total||total>MAX_VIDEO_BYTES)throw new ServiceError(503,'MEDIA_FILE_UNAVAILABLE','视频文件暂时不可用');
  if(request.method==='HEAD'){await handle.close();return new Response(null,{status:range?206:200,headers});}
  const body=Readable.toWeb(handle.createReadStream({start,end,autoClose:true})) as ReadableStream<Uint8Array>;
  return new Response(body,{status:range?206:200,headers});
 }catch(error){await handle?.close();if((error as NodeJS.ErrnoException).code==='ENOENT')throw new ServiceError(404,'MEDIA_NOT_FOUND','视频不存在');throw error;}
}
export async function getOwnMediaResponse(request:Request,id:string){
 if(!memberMediaIdSchema.safeParse(id).success)throw new ServiceError(404,'MEDIA_NOT_FOUND','媒体不存在');
 const thumbnail=new URL(request.url).searchParams.get('variant')==='thumbnail';
 const actor=await requireAuthenticatedUser(request.headers);
 const file=await readMemberMediaFile(actor.id,id);
 if(!file)throw new ServiceError(404,'MEDIA_NOT_FOUND','媒体不存在或无权访问');
 if(!thumbnail&&file.mime_type.startsWith('video/'))return streamVideo(request,file);
 const image=thumbnail?await readMediaFile(file.id,true):file;
 if(!image)throw new ServiceError(404,'MEDIA_NOT_FOUND','媒体不存在');
 return new Response(request.method==='HEAD'?null:new Uint8Array(await loadMediaBytes(image.storage_namespace,image.storage_key,Number(image.byte_size))),{headers:headersFor(image.mime_type)});
}
export async function getPublicMediaResponse(request:Request,key:string,variant:string|false){
 if(/^\d{4}\/\d{2}\/[a-f0-9]{32}\.(?:mp4|webm)$/.test(key)){
  const file=await readPublicMediaFile(key,variant);
  if(!file||file.storage_provider!=='local')throw new ServiceError(404,'MEDIA_NOT_FOUND','视频不存在或未公开');
  const indexable=file.indexable&&process.env.SITE_INDEXING_ENABLED==='true';
  if(!variant)return streamVideo(request,file,indexable);
  // Thumbnails share the parent video's visibility predicate.
  return new Response(request.method==='HEAD'?null:new Uint8Array(await loadMediaBytes(file.storage_namespace,file.storage_key,Number(file.byte_size))),{headers:headersFor(file.mime_type,indexable)});
 }
 const file=await getPublicMedia(key,variant),headers=headersFor(file.mime,file.indexable);
 headers.set('Content-Security-Policy',"default-src 'none'; sandbox");
 return new Response(request.method==='HEAD'?null:new Uint8Array(file.bytes),{headers});
}
