import "server-only";
import {getPool} from "./index";
import type {PoolClient} from "pg";
export class MediaStoreError extends Error{constructor(public code:"forbidden"|"missing"|"conflict"|"in_use"){super(code);}}
export type MediaRow={id:string;original_name:string;mime_type:string;byte_size:string;width:number;height:number;duration_ms:string|null;version:number;created_at:Date;in_use:boolean;storage_provider:string;storage_namespace:string;storage_key:string};
// Scalar LIMIT prevents a hashed EXISTS alternative scanning every reference for one page.
const logoReference=`EXISTS(SELECT 1 FROM site_settings s WHERE s.id=1 AND (s.value #>> '{logo,normal}'=m.id::text OR s.value #>> '{logo,dark}'=m.id::text OR s.value #>> '{icons,favicon}'=m.id::text OR s.value #>> '{icons,app}'=m.id::text))`;
const avatarReference=`(EXISTS(SELECT 1 FROM "user" a WHERE a.image='/api/site-media/'||m.storage_key OR a.image='/api/member-media/'||(SELECT public_id FROM member_media WHERE media_id=m.id)) OR EXISTS(SELECT 1 FROM user_contacts c WHERE c.media_id=m.id))`;
const projection=`m.id::text,m.original_name,m.mime_type,m.byte_size::text,m.width,m.height,m.duration_ms,m.version,m.created_at,m.storage_provider,m.storage_namespace,m.storage_key,(COALESCE((SELECT true FROM content_media l WHERE l.media_id=m.id LIMIT 1),false) OR EXISTS(SELECT 1 FROM content_links k WHERE k.cover_media_id=m.id) OR EXISTS(SELECT 1 FROM content_categories g WHERE g.icon_media_id=m.id) OR EXISTS(SELECT 1 FROM badges b WHERE b.icon_media_id=m.id) OR ${logoReference} OR ${avatarReference}) AS in_use`;
/** Only the two currently configured brand images are publicly readable. */
export async function readSiteLogoFile(variant:"normal"|"dark"){
 const fields=["storage_provider","storage_namespace","storage_key","mime_type","byte_size"].map(field=>`CASE WHEN m.mime_type='image/svg+xml' THEN m.${field} ELSE v.${field} END${field==="byte_size"?"::text":""} AS ${field}`).join(",");
 const result=await getPool().query(`SELECT ${fields} FROM site_settings s JOIN media_assets m ON m.id=(CASE WHEN $1='dark' THEN COALESCE(s.value #>> '{logo,dark}',s.value #>> '{logo,normal}') ELSE s.value #>> '{logo,normal}' END)::bigint AND m.status='ready' LEFT JOIN media_variants v ON v.media_id=m.id AND v.variant_key='thumbnail' AND v.status='ready' WHERE s.id=1 AND (m.mime_type='image/svg+xml' OR v.id IS NOT NULL)`,[variant]);
 return result.rows[0] as Pick<MediaRow,"storage_provider"|"storage_namespace"|"storage_key"|"mime_type"|"byte_size">|undefined;
}
export async function readSiteIconFile(variant:string){
 const key=variant==="favicon"?"favicon":"app";
 const result=await getPool().query(`SELECT v.storage_provider,v.storage_namespace,v.storage_key,v.mime_type,v.byte_size::text FROM site_settings s JOIN media_assets m ON m.id=(s.value #>> ARRAY['icons',$1])::bigint AND m.status='ready' JOIN media_variants v ON v.media_id=m.id AND v.variant_key=$2 AND v.status='ready' AND v.mime_type='image/png' WHERE s.id=1`,[key,variant]);
 return result.rows[0] as Pick<MediaRow,"storage_provider"|"storage_namespace"|"storage_key"|"mime_type"|"byte_size">|undefined;
}
async function mutate<T>(actor:string,run:(client:PoolClient)=>Promise<T>){const client=await getPool().connect();try{await client.query("BEGIN");const allowed=await client.query(`SELECT id FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) FOR SHARE`,[actor]);if(!allowed.rowCount)throw new MediaStoreError("forbidden");const result=await run(client);await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}
export async function readMediaList(before?:string,kind?:"image"|"video"){return (await getPool().query(`SELECT ${projection} FROM media_assets m WHERE status='ready' AND ($2::text IS NULL OR m.kind=$2) AND ($1::bigint IS NULL OR m.id<$1::bigint) ORDER BY m.id DESC LIMIT 31`,[before??null,kind??null])).rows as MediaRow[];}
export async function readMediaReferences(id:string,before?:string){return (await getPool().query(`SELECT l.id::text,c.id::text AS content_id,COALESCE(NULLIF(c.title,''),left(c.feed_text,80),'') AS title,c.status,l.role,l.position FROM content_media l JOIN contents c ON c.id=l.content_id WHERE l.media_id=$1 AND ($2::bigint IS NULL OR l.id<$2::bigint) ORDER BY l.id DESC LIMIT 31`,[id,before??null])).rows as {id:string;content_id:string;title:string;status:"draft"|"published"|"archived";role:"cover"|"gallery"|"attachment";position:number}[];}
export async function readMediaAudit(before?:string){return (await getPool().query(`SELECT a.id::text,a.media_id::text,a.label,a.action,a.created_at,u.name AS actor_name,u.email AS actor_email FROM media_audit a LEFT JOIN "user" u ON u.id=a.actor_id WHERE ($1::bigint IS NULL OR a.id<$1::bigint) ORDER BY a.id DESC LIMIT 31`,[before??null])).rows as {id:string;media_id:string;label:string;action:"uploaded"|"deleted";created_at:Date;actor_name:string|null;actor_email:string|null}[];}
export async function readMediaFile(id:string,thumbnail:boolean|string=false){const row=(await getPool().query(`SELECT ${projection} FROM media_assets m WHERE m.id=$1 AND m.status='ready'`,[id])).rows[0] as MediaRow|undefined;if(!row||!thumbnail||(thumbnail==="logo"&&row.mime_type==="image/svg+xml"))return row;const key=thumbnail===true||thumbnail==="logo"?"thumbnail":thumbnail;const variant=(await getPool().query("SELECT storage_provider,storage_namespace,storage_key,mime_type,byte_size::text,width,height FROM media_variants WHERE media_id=$1 AND variant_key=$2 AND status='ready'",[id,key])).rows[0];return variant?{...row,...variant}:undefined;}
export type StoredImage={key:string;mime:string;size:number;width:number;height:number};
/** Local maintenance: bounded work list, all authorization repeated in the write transaction. */
export async function readResponsiveMediaBatch(limit:number){
 if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error("Invalid batch limit");
 return (await getPool().query(`SELECT m.id::text FROM media_assets m WHERE m.status='ready' AND m.storage_provider='local' AND m.storage_namespace='images-v1' AND m.mime_type='image/webp' AND EXISTS(SELECT 1 FROM (VALUES ('w480',480),('w960',960),('w1440',1440)) AS sizes(key,width) WHERE sizes.width<m.width AND NOT EXISTS(SELECT 1 FROM media_variants v WHERE v.media_id=m.id AND v.variant_key=sizes.key AND v.status='ready')) ORDER BY m.id LIMIT $1`,[limit])).rows as {id:string}[];
}
export async function addResponsiveMedia(actor:string,id:string,build:(row:MediaRow,existing:string[])=>Promise<(StoredImage&{variant:string})[]>){
 return mutate(actor,async client=>{
  const row=(await client.query(`SELECT ${projection} FROM media_assets m WHERE m.id=$1 AND m.status='ready' AND m.mime_type='image/webp' FOR UPDATE OF m`,[id])).rows[0] as MediaRow|undefined;
  if(!row)throw new MediaStoreError("missing");
  const existing=(await client.query("SELECT variant_key FROM media_variants WHERE media_id=$1 AND status='ready'",[id])).rows.map(v=>v.variant_key as string);
  const variants=await build(row,existing);
  for(const v of variants)await client.query(`INSERT INTO media_variants(media_id,variant_key,storage_provider,storage_namespace,storage_key,mime_type,byte_size,width,height,status) VALUES($1,$2,'local',$3,$4,$5,$6,$7,$8,'ready') ON CONFLICT(media_id,variant_key) DO UPDATE SET storage_key=EXCLUDED.storage_key,mime_type=EXCLUDED.mime_type,byte_size=EXCLUDED.byte_size,width=EXCLUDED.width,height=EXCLUDED.height,status='ready',updated_at=now()`,[id,v.variant,row.storage_namespace,v.key,v.mime,v.size,v.width,v.height]);
  if(variants.length)await client.query("INSERT INTO media_audit(actor_id,media_id,label,action) VALUES($1,$2,$3,'uploaded')",[actor,id,row.original_name+"（补生成响应式尺寸）"]);
  return variants.length;
 });
}
export async function insertMedia(actor:string,namespace:string,name:string,checksum:string,image:StoredImage,thumbnail?:StoredImage,variants:(StoredImage&{variant:string})[]=[]){return mutate(actor,async client=>{
 const row=(await client.query(`INSERT INTO media_assets(uploader_id,storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,width,height,checksum_sha256,status) VALUES($1,'local',$2,$3,$4,'image',$5,$6,$7,$8,$9,'ready') RETURNING id::text`,[actor,namespace,image.key,name,image.mime,image.size,image.width,image.height,checksum])).rows[0];
 const derived=[...(thumbnail?[{...thumbnail,variant:"thumbnail"}]:[]),...variants];
 if(derived.length)await client.query(`INSERT INTO media_variants(media_id,variant_key,storage_provider,storage_namespace,storage_key,mime_type,byte_size,width,height,status) SELECT $1,v.variant,'local',$2,v.key,v.mime,v.size,v.width,v.height,'ready' FROM jsonb_to_recordset($3::jsonb) AS v(variant text,key text,mime text,size bigint,width integer,height integer)`,[row.id,namespace,JSON.stringify(derived)]);
 await client.query("INSERT INTO media_audit(actor_id,media_id,label,action) VALUES($1,$2,$3,'uploaded')",[actor,row.id,name]);return row.id as string;
 });}
export async function tombstoneMedia(actor:string,id:string,version:number){return mutate(actor,async client=>{
 const row=(await client.query(`SELECT ${projection},m.status FROM media_assets m WHERE m.id=$1 FOR UPDATE OF m`,[id])).rows[0] as (MediaRow&{status:string})|undefined;
 if(!row||row.status!=="ready")throw new MediaStoreError("missing");if(row.version!==version)throw new MediaStoreError("conflict");
 if((await client.query("SELECT 1 FROM content_links WHERE cover_media_id=$1 LIMIT 1",[id])).rowCount)throw new MediaStoreError("in_use");
 if((await client.query("SELECT 1 FROM content_media WHERE media_id=$1 LIMIT 1",[id])).rowCount)throw new MediaStoreError("in_use");
 if((await client.query("SELECT 1 FROM content_categories WHERE icon_media_id=$1 LIMIT 1",[id])).rowCount)throw new MediaStoreError("in_use");
 if((await client.query("SELECT 1 FROM badges WHERE icon_media_id=$1 LIMIT 1",[id])).rowCount)throw new MediaStoreError("in_use");
 if((await client.query(`SELECT 1 FROM "user" WHERE image LIKE '/api/site-media/%' AND image=$1 LIMIT 1`,['/api/site-media/'+row.storage_key])).rowCount)throw new MediaStoreError("in_use");
 if((await client.query(`SELECT 1 FROM "user" u JOIN member_media mm ON u.image='/api/member-media/'||mm.public_id WHERE mm.media_id=$1 LIMIT 1`,[id])).rowCount)throw new MediaStoreError("in_use");
 if((await client.query('SELECT 1 FROM user_contacts WHERE media_id=$1 LIMIT 1',[id])).rowCount)throw new MediaStoreError("in_use");
 if((await client.query("SELECT 1 FROM site_settings WHERE id=1 AND (value #>> '{logo,normal}'=$1 OR value #>> '{logo,dark}'=$1 OR value #>> '{icons,favicon}'=$1 OR value #>> '{icons,app}'=$1)",[id])).rowCount)throw new MediaStoreError("in_use");
 // Content writes check ready under the same asset lock before adding references.
 const variants=(await client.query("SELECT storage_provider,storage_namespace,storage_key FROM media_variants WHERE media_id=$1",[id])).rows as Pick<MediaRow,"storage_provider"|"storage_namespace"|"storage_key">[];
 await client.query("UPDATE media_assets SET status='deleted',deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1",[id]);await client.query("UPDATE media_variants SET status='deleted',updated_at=now() WHERE media_id=$1",[id]);
 await client.query("INSERT INTO media_audit(actor_id,media_id,label,action) VALUES($1,$2,$3,'deleted')",[actor,id,row.original_name]);return [row,...variants];
 });}
