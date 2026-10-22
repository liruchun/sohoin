import "server-only";
import {getPool} from './index';
import {ProfileStoreError} from './profiles';
import {contactVisibleSql} from './member-media';
import type {MemberMediaRow} from './member-media';
type Contact={kind:string;text:string;mediaId:string|null};
export type MemberDetailsRow={name:string;bio:string;image:string|null;version:number;region:string;visibility:'public'|'friends'|'hidden';contacts:{kind:string;text:string;media:MemberMediaRow|null}[]};
export async function readMemberDetails(user:string){
 // Fields and revision share one statement snapshot, so an edit cannot load a new
 // revision paired with old contact/name values from a concurrent save.
 return (await getPool().query(`SELECT u.name,u.image,COALESCE(p.bio,'') AS bio,COALESCE(p.version,0) AS version,COALESCE(p.region,'') AS region,COALESCE(p.contact_visibility,'friends') AS visibility,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',c.kind,'text',c.value,'media',CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('id',m.id::text,'public_id',mm.public_id,'original_name',m.original_name,'mime_type',m.mime_type,'byte_size',m.byte_size::text,'width',m.width,'height',m.height,'storage_namespace',m.storage_namespace,'storage_key',m.storage_key) END) ORDER BY c.kind) FROM user_contacts c LEFT JOIN member_media mm ON mm.media_id=c.media_id AND mm.user_id=u.id LEFT JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' WHERE c.user_id=u.id),'[]'::jsonb) AS contacts
 FROM "user" u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1 AND NOT COALESCE(u.banned,false)`,[user])).rows[0] as MemberDetailsRow|undefined;
}
export async function readMemberContacts(user:string,viewer:string|null){
 return (await getPool().query(`SELECT c.kind,c.value AS text,mm.public_id AS media_id FROM "user" u JOIN user_profiles p ON p.user_id=u.id JOIN user_contacts c ON c.user_id=u.id LEFT JOIN member_media mm ON mm.media_id=c.media_id WHERE u.id=$1 AND NOT COALESCE(u.banned,false) AND ${contactVisibleSql} ORDER BY c.kind LIMIT 9`,[user,viewer])).rows as {kind:string;text:string;media_id:string|null}[];
}
export async function writeMemberDetails(actor:string,input:{version:number;name:string;bio:string;region:string;visibility:string;avatarId:string|null;contacts:Contact[]}){
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  const user=(await client.query(`SELECT name,image FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) FOR UPDATE`,[actor])).rows[0];
  if(!user)throw new ProfileStoreError('forbidden');
  await client.query('INSERT INTO user_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING',[actor]);
  const old=(await client.query('SELECT bio,region,contact_visibility,version FROM user_profiles WHERE user_id=$1 FOR UPDATE',[actor])).rows[0];
  if(old.version!==input.version)throw new ProfileStoreError('conflict');
  const ids=[...new Set([input.avatarId,...input.contacts.map(c=>c.mediaId)].filter((id):id is string=>id!==null))];
  const assets=ids.length?(await client.query(`SELECT mm.public_id,m.id::text FROM member_media mm JOIN media_assets m ON m.id=mm.media_id AND m.status='ready' AND m.mime_type='image/webp' WHERE mm.user_id=$1 AND mm.public_id=ANY($2::text[]) ORDER BY m.id FOR SHARE OF m`,[actor,ids])).rows:[];
  if(assets.length!==ids.length)throw new ProfileStoreError('missing');
  const byId=new Map(assets.map(a=>[a.public_id,a.id]));
  const avatar=input.avatarId?'/api/member-media/'+input.avatarId:user.image;
  await client.query(`UPDATE "user" SET name=$2,image=$3,"updatedAt"=now() WHERE id=$1`,[actor,input.name,avatar]);
  await client.query('UPDATE user_profiles SET bio=$2,region=$3,contact_visibility=$4,version=version+1,updated_at=now() WHERE user_id=$1',[actor,input.bio,input.region,input.visibility]);
  await client.query('DELETE FROM user_contacts WHERE user_id=$1',[actor]);
  if(input.contacts.length)await client.query(`INSERT INTO user_contacts(user_id,kind,value,media_id) SELECT $1,c.kind,c.text,c.media_id FROM jsonb_to_recordset($2::jsonb) AS c(kind text,text text,media_id bigint)`,[actor,JSON.stringify(input.contacts.map(c=>({kind:c.kind,text:c.text,media_id:c.mediaId?byId.get(c.mediaId):null})))]);
  const changed=['contacts',...(user.name!==input.name?['name']:[]),...(user.image!==avatar?['avatar']:[]),...(old.bio!==input.bio?['bio']:[]),...(old.region!==input.region?['region']:[]),...(old.contact_visibility!==input.visibility?['contact_visibility']:[])];
  await client.query('INSERT INTO user_profile_audit(actor_id,target_id,changed_fields) VALUES($1,$1,$2)',[actor,changed]);
  await client.query('COMMIT');return {version:old.version+1 as number};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
