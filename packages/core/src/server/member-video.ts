import 'server-only';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {insertMemberMedia,readMemberMediaById,acquireMediaStorageLock,MemberMediaFullError,MediaMaintenanceBusyError} from '@sohoin/database';
import {MAX_VIDEO_BYTES,MAX_VIDEO_SECONDS} from '@sohoin/extension-api/video';
import {checkWriteOrigin,requireAuthenticatedUser,enforceLimit,ServiceError} from './security';
import {readMediaRequestBytes} from './media-http';
import {saveMediaBytes,removeMediaBytes,mediaNamespace,assertMediaStorage} from './media-storage';
import {createShortPublicId} from './public-id';

const execute=promisify(execFile);
const jobs=globalThis as typeof globalThis&{sohoinVideoJobs?:number};
async function run(binary:'ffmpeg'|'ffprobe',args:string[],timeout=60000){
 try{return await execute(process.env[binary==='ffmpeg'?'FFMPEG_PATH':'FFPROBE_PATH']||binary,args,{timeout,maxBuffer:1024*1024,windowsHide:true});}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new ServiceError(503,'VIDEO_UNAVAILABLE','视频处理服务不可用，请稍后重试');throw new ServiceError(400,'INVALID_VIDEO','视频无法处理，请使用完整的 MP4 或 WebM 文件');}
}
export async function prepareVideo(bytes:Buffer,mime:'video/mp4'|'video/webm'){
  const directory=await mkdtemp(path.join(tmpdir(),'sohoin-video-'));
 try{
  const extension=mime==='video/mp4'?'mp4':'webm',input=path.join(directory,'source.'+extension),output=path.join(directory,'output.'+extension),poster=path.join(directory,'poster.png');
  await writeFile(input,bytes,{flag:'wx',mode:0o600});
  // Force a container demuxer; never interpret an uploaded playlist or URL.
  const inputArgs=['-protocol_whitelist','file,pipe','-f',extension==='mp4'?'mov':'matroska','-i',input];
  const probe=await run('ffprobe',['-v','error',...inputArgs,'-show_entries','stream=codec_type,codec_name,pix_fmt,width,height:format=duration','-of','json']);
  let metadata:{streams:{codec_type:string;codec_name:string;pix_fmt?:string;width?:number;height?:number}[];format:{duration:string}};
  try{metadata=JSON.parse(probe.stdout);}catch{throw new ServiceError(400,'INVALID_VIDEO','无法读取视频信息');}
  const streams=metadata.streams??[],video=streams.filter(s=>s.codec_type==='video'),audio=streams.filter(s=>s.codec_type==='audio'),duration=Number(metadata.format?.duration);
  const v=video[0];
  if(video.length!==1||audio.length>1||!v?.width||!v.height||v.width>3840||v.height>3840||!Number.isFinite(duration)||duration<=0||duration>MAX_VIDEO_SECONDS)throw new ServiceError(400,'VIDEO_LIMIT','视频最长 5 分钟，宽高不能超过 3840 像素');
  if(extension==='webm'&&(!['vp8','vp9'].includes(v.codec_name)||audio.some(s=>!['opus','vorbis'].includes(s.codec_name))))throw new ServiceError(415,'VIDEO_CODEC','WebM 请使用 VP8/VP9 和 Opus/Vorbis 编码');
  const convertVideo=extension==='mp4'&&(v.codec_name!=='h264'||v.pix_fmt!=='yuv420p');
  const convertAudio=extension==='mp4'&&audio.some(s=>s.codec_name!=='aac');
  // Keep compatible streams intact; only re-encode streams that browsers cannot reliably play.
  await run('ffmpeg',['-nostdin','-v','error','-threads','2',...inputArgs,'-map','0:v:0','-map','0:a:0?','-map_metadata','-1','-map_chapters','-1',
   ...(convertVideo?['-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-threads','2','-filter_threads','1']:['-c:v','copy']),
   ...(convertAudio?['-c:a','aac','-b:a','128k']:['-c:a','copy']),
   ...(extension==='mp4'?['-movflags','+faststart']:[]),output],120000);
  if((await stat(output)).size>MAX_VIDEO_BYTES)throw new ServiceError(413,'VIDEO_TOO_LARGE','视频不能超过 50 MiB');
  await run('ffmpeg',['-nostdin','-v','error','-threads','1',...inputArgs,'-map','0:v:0','-frames:v','1','-vf','scale=960:960:force_original_aspect_ratio=decrease','-threads','1',poster]);
  const {default:sharp}=await import('sharp');
  const cover=await sharp(await readFile(poster)).webp({quality:80}).toBuffer({resolveWithObject:true});
  const data=await readFile(output),checksum=createHash('sha256').update(data).digest('hex');
  let width=v.width,height=v.height;
  if(convertVideo){
   const converted=JSON.parse((await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-select_streams','v:0','-show_entries','stream=width,height','-of','json',output])).stdout);
   width=converted.streams[0].width;height=converted.streams[0].height;
  }
  return {extension,data,checksum,cover,width,height,durationMs:Math.round(duration*1000),hasAudio:audio.length>0};
 }finally{await rm(directory,{recursive:true,force:true});}
}
export async function uploadOwnVideo(request:Request){
 checkWriteOrigin(request);
 const actor=await requireAuthenticatedUser(request.headers);
 await enforceLimit('member-video-write',actor.id,6,60);
 const mime=request.headers.get('content-type')?.split(';')[0].trim();
 if(mime!=='video/mp4'&&mime!=='video/webm')throw new ServiceError(415,'UNSUPPORTED_VIDEO','请选择 MP4 或 WebM 视频');
 let name:string;
 try{name=decodeURIComponent(request.headers.get('x-file-name')??'');}catch{throw new ServiceError(400,'INVALID_FILE_NAME','文件名编码无效');}
 if(!name||name.length>255||/[\x00-\x1f\x7f/\\]/.test(name))throw new ServiceError(400,'INVALID_FILE_NAME','文件名无效或过长');
 assertMediaStorage();
 if((jobs.sohoinVideoJobs??0)>=2)throw new ServiceError(503,'VIDEO_BUSY','视频处理繁忙，请稍后重试',5);
 jobs.sohoinVideoJobs=(jobs.sohoinVideoJobs??0)+1;
 let release:(()=>Promise<void>)|undefined;
 const written:string[]=[];
 try{
  const bytes=await readMediaRequestBytes(request,MAX_VIDEO_BYTES,'video');
  if(!bytes.length)throw new ServiceError(400,'EMPTY_VIDEO','请选择非空视频');
  const {extension,data,checksum,cover,width,height,durationMs,hasAudio}=await prepareVideo(bytes,mime);
  const date=new Date(),prefix=`${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${randomBytes(16).toString('hex')}`;
  const key=prefix+'.'+extension,thumbKey=prefix+'-thumb.webp';
  release=await acquireMediaStorageLock();
  await saveMediaBytes(key,data);written.push(key);await saveMediaBytes(thumbKey,cover.data);written.push(thumbKey);
  const stored=await insertMemberMedia(actor.id,createShortPublicId(),createHash('sha256').update(bytes).digest('hex'),mediaNamespace,name,checksum,{key,mime,size:data.length,width,height},{key:thumbKey,mime:'image/webp',size:cover.data.length,width:cover.info.width,height:cover.info.height},{kind:'video',durationMs,hasAudio});
  if(stored.created)written.length=0;
  const row=await readMemberMediaById(actor.id,stored.id);
  if(!row)throw new ServiceError(500,'VIDEO_SAVE_FAILED','视频保存失败，请重试');
  return {id:row.public_id,file:{name:row.original_name,type:row.mime_type,size:Number(row.byte_size)},url:`/api/v1/account/media/${row.public_id}`,width:row.width,height:row.height,durationMs:row.duration_ms==null?null:Number(row.duration_ms)};
 }catch(error){if(error instanceof MediaMaintenanceBusyError)throw new ServiceError(503,'MEDIA_MAINTENANCE','媒体正在维护，请稍后重试',5);if(error instanceof MemberMediaFullError)throw new ServiceError(409,'MEDIA_LIBRARY_FULL','媒体库已满，请先清理不再使用的媒体');throw error;}
 finally{
  try{try{for(const key of written)await removeMediaBytes(mediaNamespace,key);}finally{await release?.();}}finally{jobs.sohoinVideoJobs=Math.max(0,(jobs.sohoinVideoJobs??1)-1);}
 }
}
