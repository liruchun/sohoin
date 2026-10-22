import "server-only";
import {readPublicMediaFile} from "@sohoin/database";
import {loadMediaBytes} from "./media-storage";
import {ServiceError} from "./security";

export async function getPublicMedia(key:string,thumbnail:boolean|string){
 if(typeof thumbnail==="string"&&!["thumbnail","w480","w960","w1440"].includes(thumbnail))throw new ServiceError(400,"INVALID_MEDIA_VARIANT","图片规格无效");
 if(!/^\d{4}\/\d{2}\/[a-f0-9]{32}\.(?:webp|svg)$/.test(key))throw new ServiceError(404,"MEDIA_NOT_FOUND","图片不存在");
 const row=await readPublicMediaFile(key,thumbnail);
 if(!row||row.storage_provider!=="local")throw new ServiceError(404,"MEDIA_NOT_FOUND","图片不存在或未公开");
 return {bytes:await loadMediaBytes(row.storage_namespace,row.storage_key,Number(row.byte_size)),mime:row.mime_type,indexable:row.mime_type!=="image/svg+xml"&&row.indexable&&process.env.SITE_INDEXING_ENABLED==="true"};
}
