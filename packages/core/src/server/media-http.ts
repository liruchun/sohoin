import "server-only";
import {MAX_MEDIA_BYTES} from "@sohoin/extension-api/media";
import {checkWriteOrigin,ServiceError} from "./security";
import {uploadMedia} from "./media";
export async function readMediaRequestBytes(request:Request,maxBytes=MAX_MEDIA_BYTES,kind:'image'|'video'='image'){
 const label=kind==='video'?'视频':'图片';
 if(Number(request.headers.get("content-length"))>maxBytes)throw new ServiceError(413,kind==='video'?'VIDEO_TOO_LARGE':'IMAGE_TOO_LARGE',`${label}不能超过 ${maxBytes/1024/1024} MiB`);
 const reader=request.body?.getReader();if(!reader)throw new ServiceError(400,kind==='video'?'EMPTY_VIDEO':'EMPTY_IMAGE',`请选择${label}`);const parts:Uint8Array[]=[];let size=0;
 let expired=false;const timer=setTimeout(()=>{expired=true;void reader.cancel().catch(()=>{});},kind==='video'?120000:30000);let complete=false;
 try{while(true){const {done,value}=await reader.read();if(expired)throw new ServiceError(408,"UPLOAD_TIMEOUT","上传超时，请重试");if(done){complete=true;break;}size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ServiceError(413,kind==='video'?'VIDEO_TOO_LARGE':'IMAGE_TOO_LARGE',`${label}不能超过 ${maxBytes/1024/1024} MiB`);}parts.push(value);}return Buffer.concat(parts);}
 finally{clearTimeout(timer);if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function uploadMediaRequest(request:Request){checkWriteOrigin(request);const purpose=new URL(request.url).searchParams.get("purpose");if(purpose!==null&&purpose!=="logo"&&purpose!=="icon"&&purpose!=="badge")throw new ServiceError(400,"INVALID_MEDIA_PURPOSE","上传用途无效");let name;try{name=decodeURIComponent(request.headers.get("x-file-name")??"");}catch{throw new ServiceError(400,"INVALID_FILE_NAME","文件名编码无效");}return uploadMedia(request.headers,{name,mime:request.headers.get("content-type")?.split(";")[0].trim()??"",purpose:purpose??undefined,read:()=>readMediaRequestBytes(request)});}
