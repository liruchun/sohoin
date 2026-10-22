import {lstat,unlink} from "node:fs/promises";
import {getPool,acquireMediaStorageLock} from "@sohoin/database";
import {mediaRoot,mediaFiles,safeMediaFile} from "./media-files";
export async function cleanupMedia(options:{apply?:boolean;graceHours?:number;limit?:number}={}){
 const grace=options.graceHours??48,limit=options.limit??1000;if(!Number.isInteger(grace)||grace<24||grace>8760||!Number.isInteger(limit)||limit<1||limit>10000)throw new Error("Invalid cleanup bounds");
 const root=mediaRoot(),release=await acquireMediaStorageLock(true);const report={dryRun:!options.apply,scanned:0,candidates:0,removed:0,retained:0,failed:0,limitReached:false,sample:[] as {file:string;reason:string}[]};
 async function batch(files:string[]){
  const keys=files.map(file=>file.slice("images-v1/".length));const rows=(await getPool().query(`SELECT m.storage_key AS key,(m.status='deleted' AND NOT EXISTS(SELECT 1 FROM content_media l WHERE l.media_id=m.id)) AS deletable FROM media_assets m WHERE m.storage_provider='local' AND m.storage_namespace='images-v1' AND m.storage_key=ANY($1::text[]) UNION ALL SELECT v.storage_key AS key,(m.status='deleted' AND NOT EXISTS(SELECT 1 FROM content_media l WHERE l.media_id=m.id)) AS deletable FROM media_variants v JOIN media_assets m ON m.id=v.media_id WHERE v.storage_provider='local' AND v.storage_namespace='images-v1' AND v.storage_key=ANY($1::text[])`,[keys])).rows as {key:string;deletable:boolean}[];
  const lookup=new Map<string,boolean[]>();for(const row of rows)lookup.set(row.key,[...(lookup.get(row.key)??[]),row.deletable]);
  for(const file of files){if(report.candidates>=limit){report.limitReached=true;return;}report.scanned++;try{const target=await safeMediaFile(root,file);const info=await lstat(target);if(!info.isFile()||info.isSymbolicLink())throw new Error("Unsafe file");const records=lookup.get(file.slice("images-v1/".length));const tombstone=records?.every(Boolean)??false;const orphan=!records&&Date.now()-info.mtimeMs>=grace*3600000;if(!tombstone&&!orphan){report.retained++;continue;}report.candidates++;if(report.sample.length<20)report.sample.push({file,reason:tombstone?"deleted":"orphan"});if(options.apply){await unlink(target);report.removed++;}}catch{report.failed++;}}
 }
 try{let pending:string[]=[];for await(const file of mediaFiles(root)){pending.push(file);if(pending.length===100){await batch(pending);pending=[];if(report.limitReached)break;}}if(pending.length&&!report.limitReached)await batch(pending);return report;}finally{await release();}
}
