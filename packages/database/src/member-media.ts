import "server-only";
import {getPool} from "./index";
import {MediaStoreError,type StoredImage} from "./media";

export const MEMBER_MEDIA_PAGE_SIZE=32;
export type MemberMediaRow={id:string;public_id:string;original_name:string;mime_type:string;byte_size:string;width:number;height:number;duration_ms:string|null;storage_namespace:string;storage_key:string};
const fields=`m.id::text,mm.public_id,m.original_name,m.mime_type,m.byte_size::text,m.width,m.height,m.duration_ms,m.storage_namespace,m.storage_key`;
export async function readMemberMedia(user:string){return (await getPool().query(`SELECT ${fields} FROM member_media mm JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' WHERE mm.user_id=$1 ORDER BY m.id DESC LIMIT 50`,[user])).rows as MemberMediaRow[];}
export async function readMemberMediaPage(user:string,before?:string,kind: "image"|"video"|"all"="image"){return (await getPool().query(`SELECT ${fields} FROM member_media mm JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' WHERE mm.user_id=$1 AND m.kind IN ('image','video') AND ($3::text='all' OR m.kind=$3) AND ($2::text IS NULL OR m.id<(SELECT media_id FROM member_media WHERE user_id=$1 AND public_id=$2)) ORDER BY m.id DESC LIMIT $4`,[user,before??null,kind,MEMBER_MEDIA_PAGE_SIZE+1])).rows as MemberMediaRow[];}
export async function readMemberMediaById(user:string,id:string){return (await getPool().query(`SELECT ${fields} FROM member_media mm JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' WHERE mm.user_id=$1 AND m.id=$2`,[user,id])).rows[0] as MemberMediaRow|undefined;}
export async function readMemberMediaFile(user:string,id:string){return (await getPool().query(`SELECT ${fields} FROM member_media mm JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' WHERE mm.user_id=$1 AND mm.public_id=$2`,[user,id])).rows[0] as MemberMediaRow|undefined;}
export class MemberMediaFullError extends Error{}
/** Serialize by owner to make both deduplication and the 500-image cap atomic. */
export async function insertMemberMedia(actor:string,publicId:string,sourceChecksum:string,namespace:string,name:string,checksum:string,image:StoredImage,thumbnail:StoredImage,options:{kind:'image'|'video';durationMs?:number;hasAudio?:boolean}={kind:'image'}){
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  const allowed=await client.query(`SELECT id FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) FOR UPDATE`,[actor]);
  if(!allowed.rowCount)throw new MediaStoreError('forbidden');
  const existing=(await client.query(`SELECT ${fields},m.status FROM member_media mm JOIN media_assets m ON m.id=mm.media_id WHERE mm.user_id=$1 AND mm.source_checksum=$2 FOR SHARE OF m`,[actor,sourceChecksum])).rows[0];
  if(existing?.status==='ready'){await client.query('COMMIT');return {id:existing.id as string,created:false};}
  const count=await client.query(`SELECT 1 FROM member_media mm JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' WHERE mm.user_id=$1 LIMIT 500`,[actor]);
  if(count.rowCount===500)throw new MemberMediaFullError();
  const row=(await client.query(`INSERT INTO media_assets(uploader_id,storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,width,height,checksum_sha256,status,duration_ms,has_audio) VALUES($1,'local',$2,$3,$4,$10,$5,$6,$7,$8,$9,'ready',$11,$12) RETURNING id::text`,[actor,namespace,image.key,name,image.mime,image.size,image.width,image.height,checksum,options.kind,options.durationMs??null,options.hasAudio??null])).rows[0];
  await client.query(`INSERT INTO media_variants(media_id,variant_key,storage_provider,storage_namespace,storage_key,mime_type,byte_size,width,height,status) VALUES($1,'thumbnail','local',$2,$3,$4,$5,$6,$7,'ready')`,[row.id,namespace,thumbnail.key,thumbnail.mime,thumbnail.size,thumbnail.width,thumbnail.height]);
  // A deleted asset can be uploaded again without accumulating duplicate library entries.
  await client.query(`INSERT INTO member_media(media_id,user_id,public_id,source_checksum) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,source_checksum) DO UPDATE SET media_id=EXCLUDED.media_id`,[row.id,actor,publicId,sourceChecksum]);
  await client.query(`INSERT INTO media_audit(actor_id,media_id,label,action) VALUES($1,$2,$3,'uploaded')`,[actor,row.id,name]);
  await client.query('COMMIT');return {id:row.id as string,created:true};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

/** The same visibility predicate gates both contact metadata and QR bytes. */
export const contactVisibleSql=`(u.id=$2 OR p.contact_visibility='public' OR (p.contact_visibility='friends' AND EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=u.id AND f.following_id=$2) AND EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=$2 AND f.following_id=u.id)))`;
export async function readVisibleMemberMedia(id:string,viewer:string|null,contact:boolean){
 return (await getPool().query(`SELECT ${fields} FROM member_media mm JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' JOIN "user" u ON u.id=mm.user_id AND NOT COALESCE(u.banned,false) LEFT JOIN user_profiles p ON p.user_id=u.id WHERE mm.public_id=$1 AND ${contact?`EXISTS(SELECT 1 FROM user_contacts c WHERE c.user_id=u.id AND c.media_id=m.id) AND ${contactVisibleSql}`:`u.image='/api/member-media/'||mm.public_id`} LIMIT 1`,[id,...(contact?[viewer]:[])])).rows[0] as MemberMediaRow|undefined;
}
