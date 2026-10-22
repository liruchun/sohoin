import 'server-only';
import type {PoolClient} from 'pg';
import {getPool} from './index';

export class PublishingStoreError extends Error{constructor(public code:'forbidden'|'missing'|'conflict'|'media'|'category'){super(code);}}
type PublicationLink={url:string;title:string;image:string;icon:string;position:number;coverMediaId?:string};
export type MemberPublicationInput={kind:'post'|'comment';body:string;category?:string;media:string[];links?:PublicationLink[];target?:{type:'post'|'article'|'comment';publicId:string};replyTo?:string};
export async function readPublishingCategories(){return (await getPool().query('SELECT slug,name FROM content_categories ORDER BY name,id LIMIT 200')).rows as {slug:string;name:string}[];}
async function transaction<T>(actor:string,run:(client:PoolClient)=>Promise<T>){
 const client=await getPool().connect();try{await client.query('BEGIN');
  if(!(await client.query('SELECT id FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) FOR NO KEY UPDATE',[actor])).rowCount)throw new PublishingStoreError('forbidden');
  const result=await run(client);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function category(client:PoolClient,slug?:string){const row=(await client.query('SELECT id::text FROM content_categories WHERE slug=$1 FOR KEY SHARE',[slug])).rows[0];if(!row)throw new PublishingStoreError('category');return row.id as string;}
async function attach(client:PoolClient,actor:string,id:string,media:string[],links:PublicationLink[]=[],kind:'post'|'comment'='post'){
 const owner=kind==='comment'?'comment_id':'content_id';
 const rows=(await client.query(`SELECT m.id::text,mm.public_id,m.mime_type FROM member_media mm JOIN media_assets m ON m.id=mm.media_id WHERE mm.user_id=$1 AND mm.public_id=ANY($2::text[]) AND m.status='ready' AND m.mime_type IN ('image/webp','video/mp4','video/webm') ORDER BY m.id FOR SHARE OF m`,[actor,media])).rows as {id:string;public_id:string;mime_type:string}[];
 if(rows.length!==media.length||media.length+links.length>9)throw new PublishingStoreError('media');
 await client.query(`DELETE FROM content_media WHERE ${owner}=$1 AND role='gallery'`,[id]);
 if(media.length)await client.query(`INSERT INTO content_media(${owner},media_id,role,position,alt_text,caption) SELECT $1,x.id,'gallery',x.position,'','' FROM jsonb_to_recordset($2::jsonb) AS x(id bigint,position integer)`,[id,JSON.stringify(media.map((token,index)=>({id:rows.find(row=>row.public_id===token)!.id,position:Array.from({length:media.length+links.length},(_,i)=>i).filter(i=>!links.some(link=>link.position===i))[index]})))]);
 const covers=links.flatMap(link=>link.coverMediaId?[link.coverMediaId]:[]);
 const coverRows=covers.length?(await client.query(`SELECT mm.public_id,m.id::text FROM member_media mm JOIN media_assets m ON m.id=mm.media_id WHERE mm.user_id=$1 AND mm.public_id=ANY($2::text[]) AND m.status='ready' AND m.mime_type='image/webp' FOR SHARE OF m`,[actor,covers])).rows as {public_id:string;id:string}[]:[];
 if(covers.some(token=>!coverRows.some(row=>row.public_id===token)))throw new PublishingStoreError('media');
 await client.query(`DELETE FROM content_links WHERE ${owner}=$1`,[id]);
 if(links.length)await client.query(`INSERT INTO content_links(${owner},position,url,title,image_url,icon_url,cover_media_id) SELECT $1,x.position,x.url,x.title,x.image,x.icon,x.cover FROM jsonb_to_recordset($2::jsonb) AS x(position integer,url text,title text,image text,icon text,cover bigint)`,[id,JSON.stringify(links.map(link=>({...link,cover:coverRows.find(row=>row.public_id===link.coverMediaId)?.id??null})))]);
}
async function audit(client:PoolClient,actor:string,kind:string,id:string,action:string){await client.query('INSERT INTO member_publication_audit(actor_id,kind,object_id,action) VALUES($1,$2,$3,$4)',[actor,kind,id,action]);}
export async function createMemberPublication(actor:string,input:MemberPublicationInput,requestId:string,fingerprint:string,publicId:string){return transaction(actor,async client=>{
 const previous=(await client.query('SELECT fingerprint,kind,public_id FROM member_publications WHERE user_id=$1 AND request_id=$2',[actor,requestId])).rows[0];
 if(previous){if(previous.fingerprint!==fingerprint)throw new PublishingStoreError('conflict');return {publicId:previous.public_id as string,type:previous.kind as 'post'|'comment'};}
 let id:string;
 if(input.kind==='post'){
  const categoryId=await category(client,input.category);
  id=(await client.query(`INSERT INTO contents(type,title,body,category_id,status,author_id,published_at) VALUES('post','',$1,$2,'published',$3,now()) RETURNING id::text`,[input.body,categoryId,actor])).rows[0].id;
  await attach(client,actor,id,input.media,input.links);
  await client.query("INSERT INTO public_route_ids(kind,content_id,short_id) VALUES('content',$1,$2)",[id,publicId]);
 }else{
  const target=input.target!;
  const parent=(await client.query(`SELECT p.id::text FROM contents p JOIN "user" u ON u.id=p.author_id AND NOT COALESCE(u.banned,false) WHERE p.status='published' AND p.type IN ('post','article') AND ${target.type==='comment'?"p.id=(SELECT c.content_id FROM public_comment_ids r JOIN comments c ON c.id=r.comment_id WHERE r.short_id=$1)":"p.type=$2 AND p.id=(SELECT content_id FROM public_route_ids WHERE kind='content' AND short_id=$1)"} FOR SHARE OF p`,target.type==='comment'?[target.publicId]:[target.publicId,target.type])).rows[0];
  if(!parent)throw new PublishingStoreError('missing');
  const tokens=[...new Set([target.type==='comment'?target.publicId:null,input.replyTo].filter((value):value is string=>!!value))];
  let root:string|null=null,reply:string|null=null;
  if(tokens.length){
   const candidates=(await client.query(`SELECT a.id::text,COALESCE(a.root_id,a.id)::text AS root_id,r.short_id FROM public_comment_ids r JOIN comments a ON a.id=r.comment_id JOIN "user" u ON u.id=a.author_id AND NOT COALESCE(u.banned,false) WHERE r.short_id=ANY($1::text[]) AND a.content_id=$2 AND a.status='visible' AND NOT a.thread_hidden`,[tokens,parent.id])).rows as {id:string;root_id:string;short_id:string}[];
   if(candidates.length!==tokens.length)throw new PublishingStoreError('missing');
   const chosen=candidates.find(row=>row.short_id===(input.replyTo??target.publicId))!;root=chosen.root_id;reply=chosen.id;
   if(candidates.some(row=>row.root_id!==root))throw new PublishingStoreError('missing');
   // Match moderation lock order: root before reply. Recheck after acquiring locks.
   if(!(await client.query(`SELECT a.id FROM comments a JOIN "user" u ON u.id=a.author_id AND NOT COALESCE(u.banned,false) WHERE a.id=$1 AND a.status='visible' AND NOT a.thread_hidden FOR SHARE OF a`,[root])).rowCount)throw new PublishingStoreError('missing');
   const locked=await client.query(`SELECT a.id FROM comments a JOIN "user" u ON u.id=a.author_id AND NOT COALESCE(u.banned,false) WHERE a.id=ANY($1::bigint[]) AND a.status='visible' AND NOT a.thread_hidden ORDER BY a.id FOR SHARE OF a`,[candidates.map(row=>row.id)]);
   if(locked.rowCount!==candidates.length)throw new PublishingStoreError('missing');
  }
  id=(await client.query('INSERT INTO comments(content_id,author_id,root_id,reply_to_id,body) VALUES($1,$2,$3,$4,$5) RETURNING id::text',[parent.id,actor,root,reply,input.body])).rows[0].id;
  await attach(client,actor,id,input.media,input.links,'comment');
  await client.query('INSERT INTO public_comment_ids(comment_id,short_id) VALUES($1,$2)',[id,publicId]);
 }
 await audit(client,actor,input.kind,id,'created');
 await client.query('INSERT INTO member_publications(user_id,request_id,fingerprint,kind,public_id) VALUES($1,$2,$3,$4,$5)',[actor,requestId,fingerprint,input.kind,publicId]);
 return {publicId,type:input.kind};
});}

function ownAttachments(owner:'content_id'|'comment_id'){return ` COALESCE((SELECT jsonb_agg(jsonb_build_object('url',k.url,'title',k.title,'image',k.image_url,'icon',k.icon_url,'position',k.position,'coverMediaId',mm.public_id,'coverUrl',CASE WHEN mm.public_id IS NOT NULL THEN '/api/v1/account/media/'||mm.public_id||'?variant=thumbnail' ELSE NULL END) ORDER BY k.position) FROM content_links k LEFT JOIN member_media mm ON mm.media_id=k.cover_media_id AND mm.user_id=$1 WHERE k.${owner}=c.id),'[]'::jsonb) AS links,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',mm.public_id,'file',jsonb_build_object('name',m.original_name,'type',m.mime_type,'size',m.byte_size),'url','/api/v1/account/media/'||mm.public_id,'width',m.width,'height',m.height) ORDER BY l.position) FROM content_media l JOIN member_media mm ON mm.media_id=l.media_id AND mm.user_id=$1 JOIN media_assets m ON m.id=l.media_id AND m.status='ready' WHERE l.${owner}=c.id AND l.role='gallery'),'[]'::jsonb) AS media`;}

export async function readOwnPublication(actor:string,kind:'post'|'comment',publicId:string){
 if(kind==='post')return (await getPool().query(`SELECT c.body,c.version,g.slug AS category,
 ${ownAttachments('content_id')}
 FROM public_route_ids r JOIN contents c ON c.id=r.content_id JOIN content_categories g ON g.id=c.category_id WHERE r.short_id=$2 AND r.kind='content' AND c.author_id=$1 AND c.type='post' AND c.status='published' AND NOT EXISTS(SELECT 1 FROM content_media old_media WHERE old_media.content_id=c.id AND old_media.role='gallery' AND NOT EXISTS(SELECT 1 FROM member_media owned WHERE owned.media_id=old_media.media_id AND owned.user_id=$1))`,[actor,publicId])).rows[0];
 return (await getPool().query(`SELECT c.body,c.version,${ownAttachments('comment_id')} FROM public_comment_ids r JOIN comments c ON c.id=r.comment_id JOIN contents p ON p.id=c.content_id AND p.status='published' JOIN "user" owner ON owner.id=p.author_id AND NOT COALESCE(owner.banned,false) WHERE r.short_id=$2 AND c.author_id=$1 AND c.status='visible' AND NOT c.thread_hidden AND (c.root_id IS NULL OR EXISTS(SELECT 1 FROM comments root JOIN "user" ru ON ru.id=root.author_id AND NOT COALESCE(ru.banned,false) WHERE root.id=c.root_id AND root.status='visible' AND NOT root.thread_hidden))`,[actor,publicId])).rows[0];
}
export async function changeOwnPublication(actor:string,kind:'post'|'comment',publicId:string,version:number,value:{body:string;category?:string;media:string[];links?:PublicationLink[]}|null){return transaction(actor,async client=>{
 let id:string;
 if(kind==='post'){
  const row=(await client.query(`SELECT c.id::text,c.version FROM public_route_ids r JOIN contents c ON c.id=r.content_id WHERE r.short_id=$1 AND r.kind='content' AND c.author_id=$2 AND c.type='post' AND c.status='published' FOR UPDATE OF c`,[publicId,actor])).rows[0];
  if(!row)throw new PublishingStoreError('missing');if(row.version!==version)throw new PublishingStoreError('conflict');id=row.id;
  if(value){if((await client.query("SELECT 1 FROM content_media l WHERE l.content_id=$1 AND l.role='gallery' AND NOT EXISTS(SELECT 1 FROM member_media mm WHERE mm.media_id=l.media_id AND mm.user_id=$2) LIMIT 1",[id,actor])).rowCount)throw new PublishingStoreError('media');const categoryId=await category(client,value.category);await attach(client,actor,id,value.media,value.links);await client.query('UPDATE contents SET body=$2,category_id=$3,excerpt=\'\',updated_at=now(),version=version+1 WHERE id=$1',[id,value.body,categoryId]);}
  else await client.query("UPDATE contents SET status='archived',updated_at=now(),version=version+1 WHERE id=$1",[id]);
 }else{
  const relation=(await client.query(`SELECT c.id::text,COALESCE(c.root_id,c.id)::text AS root_id,c.content_id::text FROM public_comment_ids r JOIN comments c ON c.id=r.comment_id WHERE r.short_id=$1 AND c.author_id=$2`,[publicId,actor])).rows[0];
  if(!relation)throw new PublishingStoreError('missing');
  if(!(await client.query(`SELECT p.id FROM contents p JOIN "user" u ON u.id=p.author_id AND NOT COALESCE(u.banned,false) WHERE p.id=$1 AND p.status='published' FOR SHARE OF p`,[relation.content_id])).rowCount)throw new PublishingStoreError('missing');
  if(!(await client.query(`SELECT c.id FROM comments c JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false) WHERE c.id=$1 AND c.status='visible' AND NOT c.thread_hidden FOR UPDATE OF c`,[relation.root_id])).rowCount)throw new PublishingStoreError('missing');
  const row=(await client.query("SELECT id::text,version FROM comments WHERE id=$1 AND author_id=$2 AND status='visible' AND NOT thread_hidden FOR UPDATE",[relation.id,actor])).rows[0];
  if(!row)throw new PublishingStoreError('missing');if(row.version!==version)throw new PublishingStoreError('conflict');id=row.id;
  if(value){await attach(client,actor,id,value.media,value.links,'comment');await client.query('UPDATE comments SET body=$2,updated_at=now(),version=version+1 WHERE id=$1',[id,value.body]);}
  else await client.query("UPDATE comments SET body='',status='deleted',deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1",[id]);
 }
 await audit(client,actor,kind,id,value?'updated':'deleted');return {version:version+1};
});}
