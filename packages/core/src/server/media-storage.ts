import "server-only";
import path from "node:path";
import {mkdir,unlink,open} from "node:fs/promises";
import {ServiceError} from "./security";
export const mediaNamespace="images-v1";
function root(){const value=process.env.MEDIA_STORAGE_DIR;if(!value||!path.isAbsolute(value))throw new ServiceError(503,"MEDIA_STORAGE_UNCONFIGURED","媒体存储目录尚未配置");return path.resolve(value);}
export function mediaFilePath(namespace:string,key:string){if(namespace!==mediaNamespace||!/^\d{4}\/\d{2}\/[a-f0-9]{32}(?:-thumb|-w(?:480|960|1440)|-(?:favicon|apple|app-192|app-512|maskable-512))?\.(?:jpg|png|webp|svg|mp4|webm)$/.test(key))throw new ServiceError(404,"MEDIA_NOT_FOUND","媒体不存在");const base=root();return path.join(base,namespace,...key.split("/"));}
export async function saveMediaBytes(key:string,bytes:Buffer){const target=mediaFilePath(mediaNamespace,key);await mkdir(path.dirname(target),{recursive:true});const handle=await open(target,"wx",0o600);try{await handle.writeFile(bytes);}catch(error){await handle.close();await unlink(target).catch(()=>{});throw error;}finally{await handle.close();}}
export async function removeMediaBytes(namespace:string,key:string){try{await unlink(mediaFilePath(namespace,key));}catch(error){if(!(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT"))throw error;}}
export async function loadMediaBytes(namespace:string,key:string,expected:number){let handle;try{handle=await open(mediaFilePath(namespace,key),"r");const info=await handle.stat();if(!info.isFile()||info.size!==expected||info.size>12*1024*1024)throw new ServiceError(503,"MEDIA_FILE_UNAVAILABLE","媒体文件暂时不可用");return await handle.readFile();}catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT")throw new ServiceError(404,"MEDIA_NOT_FOUND","媒体文件不存在");throw error;}finally{await handle?.close();}}
export function assertMediaStorage(){root();}
