import path from "node:path";
import {lstat,opendir} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash} from "node:crypto";
export const mediaRelativePattern=/^images-v1\/\d{4}\/(?:0[1-9]|1[0-2])\/[a-f0-9]{32}(?:-thumb|-w(?:480|960|1440)|-(?:favicon|apple|app-192|app-512|maskable-512))?\.(?:webp|png|jpg|svg|mp4|webm)$/;
export function mediaRoot(){const value=process.env.MEDIA_STORAGE_DIR;if(!value||!path.isAbsolute(value))throw new Error("Set absolute MEDIA_STORAGE_DIR");return path.resolve(value);}
export async function safeMediaFile(root:string,relative:string){
 if(!path.isAbsolute(root)||!mediaRelativePattern.test(relative))throw new Error("Invalid media path");const target=path.resolve(root,...relative.split("/"));if(!target.startsWith(root+path.sep))throw new Error("Media path escaped root");
 let current=root;for(const part of ["",...relative.split("/")]){if(part)current=path.join(current,part);try{const info=await lstat(current);if(info.isSymbolicLink())throw new Error("Media symlinks are not supported");if(current!==target&&!info.isDirectory())throw new Error("Invalid media directory");}catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT")break;throw error;}}
 return target;
}
export async function fileHash(file:string){const hash=createHash("sha256");for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest("hex");}
export async function* mediaFiles(root:string):AsyncGenerator<string>{
 const namespace=path.join(root,"images-v1");for(const dir of [root,namespace]){try{const info=await lstat(dir);if(info.isSymbolicLink()||!info.isDirectory())throw new Error("Invalid media root");}catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT")return;throw error;}}
 for await(const year of await opendir(namespace)){if(!year.isDirectory()||!/^\d{4}$/.test(year.name))continue;for await(const month of await opendir(path.join(namespace,year.name))){if(!month.isDirectory()||!/^(?:0[1-9]|1[0-2])$/.test(month.name))continue;for await(const entry of await opendir(path.join(namespace,year.name,month.name))){const relative=`images-v1/${year.name}/${month.name}/${entry.name}`;if(entry.isFile()&&mediaRelativePattern.test(relative))yield relative;}}}
}
