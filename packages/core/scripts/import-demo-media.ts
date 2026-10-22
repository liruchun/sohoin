import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {getPool,readMediaFile,acquireMediaStorageLock,MIGRATION_LOCK,ADMIN_PERMISSIONS_LOCK} from "@sohoin/database";
import {storeMediaUpload} from "../src/server/media";

// Import only the captured demo cohort. Never crawl pages or follow arbitrary remote URLs.
const db=getPool(),cache=path.resolve(".local/demo/media-originals");
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const ensure=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
async function download(source:string){
 const url=new URL(source);ensure(url.protocol==="https:"&&url.hostname==="cdn.bonjour.bio"&&!url.port&&!url.username&&!url.password,"Unsupported source host");
 const target=path.join(cache,digest(source));
 try{return await readFile(target);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
 const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(30000)});
 ensure(response.ok&&response.body,"Source download failed: "+response.status);
 const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;ensure(size<=10*1024*1024,"Source image exceeds 10 MiB");chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const bytes=Buffer.concat(chunks);ensure(bytes.length>0,"Empty source image");await writeFile(target,bytes);return bytes;
}
async function main(){
 ensure(["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Demo media import only permits a local database");
 const actor=(await db.query(`SELECT id FROM "user" WHERE NOT COALESCE(banned,false) AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) ORDER BY id LIMIT 1`)).rows[0]?.id;
 ensure(actor,"Create a local administrator before importing media");await mkdir(cache,{recursive:true});
 const rows=(await db.query("SELECT batch_id,kind,local_id,snapshot FROM demo_import_objects WHERE kind IN ('user','content','comment') ORDER BY batch_id,kind,source_id LIMIT 5001")).rows;
 ensure(rows.length>0&&rows.length<=5000,"Missing or oversized demo cohort");
 const sources=new Set<string>();
 for(const row of rows){const urls=row.kind==="user"?[row.snapshot.avatar].filter(Boolean):row.snapshot.media??[];ensure(Array.isArray(urls)&&urls.length<=30,"Invalid media list");for(const url of urls){ensure(typeof url==="string","Invalid media source");sources.add(url);}}
 const assets=new Map<string,{id:string;url:string}>();let uploaded=0;
 for(const source of sources){
  const name="bonjour-"+digest(source)+".webp";
  let asset=(await db.query("SELECT id::text,storage_key FROM media_assets WHERE original_name=$1 AND status='ready' AND storage_namespace='images-v1' AND mime_type='image/webp' ORDER BY id LIMIT 1",[name])).rows[0];
  if(!asset){const original=await download(source);
   // The library supports static images. Archive originals and import a bounded first-frame WebP for GIF/AVIF sources too.
   const {default:sharp}=await import("sharp");
   const options={animated:false,limitInputPixels:20_000_000,failOn:"warning" as const};
   const metadata=await sharp(original,options).timeout({seconds:20}).metadata();
   ensure(["jpeg","png","webp","gif","avif","heif"].includes(metadata.format??""),"Only raster source images can be imported");
   const bytes=["jpeg","png","webp"].includes(metadata.format??"")&&(metadata.pages??1)===1?original:await sharp(original,options).rotate().webp({quality:90}).timeout({seconds:20}).toBuffer();
   const mime=bytes===original?({jpeg:"image/jpeg",png:"image/png",webp:"image/webp"} as Record<string,string>)[metadata.format!]:"image/webp";
   const result=await storeMediaUpload(actor,{name,mime,read:async()=>bytes});const stored=await readMediaFile(result.id);ensure(stored,"Uploaded media missing");asset={id:result.id,storage_key:stored!.storage_key};uploaded++;
  }
  assets.set(source,{id:asset.id,url:"/api/site-media/"+asset.storage_key});
  console.log(JSON.stringify({processed:assets.size,total:sources.size,uploaded}));
 }
 const release=await acquireMediaStorageLock(),client=await db.connect();let avatars=0,gallery=0;
 try{
  await client.query("BEGIN");await client.query("SET LOCAL lock_timeout='10s'");
  await client.query("SELECT pg_advisory_xact_lock_shared($1)",[MIGRATION_LOCK]);await client.query("SELECT pg_advisory_xact_lock_shared($1)",[ADMIN_PERMISSIONS_LOCK]);await client.query("SELECT pg_advisory_xact_lock(82405624)");
  ensure((await client.query(`SELECT id FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) FOR SHARE`,[actor])).rowCount,"Administrator no longer available");
  const ready=await client.query("SELECT id FROM media_assets WHERE id=ANY($1::bigint[]) AND status='ready' ORDER BY id FOR SHARE",[[...new Set([...assets.values()].map(a=>a.id))]]);ensure(ready.rowCount===new Set([...assets.values()].map(a=>a.id)).size,"Media changed during import");
  for(const row of rows){
   if(row.kind==="user"&&row.snapshot.avatar){const asset=assets.get(row.snapshot.avatar)!;
    const changed=await client.query(`UPDATE "user" SET image=$2,"updatedAt"=now() WHERE id=$1 AND (image=$3 OR image IS NULL) RETURNING id`,[row.local_id,asset.url,row.snapshot.avatar]);
    if(changed.rowCount){await client.query("INSERT INTO user_profile_audit(actor_id,target_id,changed_fields) VALUES($1,$2,ARRAY['image'])",[actor,row.local_id]);avatars++;}
   }else if(row.kind==="content"){
    await client.query("SELECT id FROM contents WHERE id=$1 FOR UPDATE",[row.local_id]);let changed=false;
    for(const [position,source] of (row.snapshot.media??[]).entries()){
     const asset=assets.get(source)!;const prior=(await client.query("SELECT media_id::text FROM content_media WHERE content_id=$1 AND role='gallery' AND position=$2",[row.local_id,position])).rows[0];
     if(prior){ensure(prior.media_id===asset.id,"Existing gallery differs; refusing to overwrite");continue;}
     await client.query("INSERT INTO content_media(content_id,media_id,role,position,alt_text) VALUES($1,$2,'gallery',$3,'')",[row.local_id,asset.id,position]);gallery++;changed=true;
    }
    if(changed){await client.query("UPDATE contents SET version=version+1,updated_at=now() WHERE id=$1",[row.local_id]);await client.query("INSERT INTO content_audit(actor_id,kind,object_id,label,action) VALUES($1,'content',$2,'演示配图本地化','updated')",[actor,row.local_id]);}
   }
  }
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();await release();}
 // Comment images are archived in the library; the current comment model has no media relation.
 await writeFile(path.join(cache,"manifest.json"),JSON.stringify(Object.fromEntries(assets),null,2));
 console.log(JSON.stringify({complete:true,sources:sources.size,uploaded,avatars,gallery,commentImagesArchivedOnly:true}));
}
try{await main();}finally{await db.end();}
