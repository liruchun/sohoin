import "server-only";
import type {PoolClient} from "pg";
import {getPool} from "./index";
type Kind="categories"|"tags";
const tables={categories:"content_categories",tags:"content_tags"} as const;
export class ContentStoreError extends Error {constructor(public code:"forbidden"|"missing"|"conflict"|"in_use"|"published"|"invalid_reference"){super(code);}}
type TermInput={name:string;slug:string;description:string;iconMediaId?:string|null};
export type TermRow=Omit<TermInput,"iconMediaId">&{id:string;version:number;iconMediaId:string|null};
type MediaLink={mediaId:string;role:"cover"|"gallery"|"attachment";altText:string;caption:string};
type ContentInput={type:string;title:string;excerpt:string;body:string;categoryId:string|null;tagIds:string[];status:"draft"|"published"|"archived";media?:MediaLink[];featured?:boolean;pinLevel?:number};
export type ContentRow={id:string;type:string;title:string;excerpt:string;body?:string;data?:Record<string,string|number|boolean>;data_schema_version?:number;media?: (MediaLink&{name:string;mimeType:string;width:number|null;height:number|null})[];category:{id:string;name:string;slug:string}|null;tags:{id:string;name:string;slug:string}[];status:ContentInput["status"];version:number;updated_at:Date;published_at:Date|null;featured:boolean;featured_at:Date|null;pin_level:number;sort_at:string};
const pattern=(value:string)=>value.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%";
async function mutate<T>(actorId:string,run:(client:PoolClient)=>Promise<T>):Promise<T>{
 const client=await getPool().connect();
 try{await client.query("BEGIN");
  const actor=await client.query(`SELECT id FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) FOR SHARE`,[actorId]);
  if(!actor.rowCount)throw new ContentStoreError("forbidden");
  const result=await run(client);await client.query("COMMIT");return result;
 }catch(error){await client.query("ROLLBACK");
  if(error&&typeof error==="object"&&"code" in error){if(error.code==="23505")throw new ContentStoreError("conflict");if(error.code==="23503")throw new ContentStoreError("in_use");}
  throw error;
 }finally{client.release();}
}
async function audit(client:PoolClient,actor:string,kind:string,id:string,label:string,action:string){await client.query("INSERT INTO content_audit(actor_id,kind,object_id,label,action) VALUES($1,$2,$3,$4,$5)",[actor,kind,id,label,action]);}
const iconProjection=(kind:Kind)=>kind==="categories"?'icon_media_id::text AS "iconMediaId"':'NULL::text AS "iconMediaId"';
export async function readTerms(kind:Kind,q:string,before?:string){
 const result=await getPool().query(`SELECT id::text,name,slug,description,version,${iconProjection(kind)} FROM ${tables[kind]} WHERE ($1='' OR lower(name) LIKE $2) AND ($3::bigint IS NULL OR id<$3::bigint) ORDER BY id DESC LIMIT 31`,[q,pattern(q),before??null]);return result.rows as TermRow[];
}
export async function readTerm(kind:Kind,id:string){const result=await getPool().query(`SELECT id::text,name,slug,description,version,${iconProjection(kind)} FROM ${tables[kind]} WHERE id=$1`,[id]);return result.rows[0] as TermRow|undefined;}
export async function writeTerm(actor:string,kind:Kind,value:TermInput,id?:string,version?:number){return mutate(actor,async client=>{
 let result;
 if(id){const current=await client.query(`SELECT version FROM ${tables[kind]} WHERE id=$1 FOR UPDATE`,[id]);if(!current.rowCount)throw new ContentStoreError("missing");if(current.rows[0].version!==version)throw new ContentStoreError("conflict");}
 if(kind==="categories"){
  const iconMediaId=value.iconMediaId??null;
  if(iconMediaId){const asset=await client.query("SELECT 1 FROM media_assets WHERE id=$1 AND status='ready' AND kind='image' AND mime_type='image/webp' AND storage_provider='local' AND storage_namespace='images-v1' FOR SHARE",[iconMediaId]);if(!asset.rowCount)throw new ContentStoreError("invalid_reference");}
  result=id
   ?await client.query(`UPDATE content_categories SET name=$2,slug=$3,description=$4,icon_media_id=$5,version=version+1 WHERE id=$1 RETURNING id::text,name,slug,description,version,icon_media_id::text AS "iconMediaId"`,[id,value.name,value.slug,value.description,iconMediaId])
   :await client.query(`INSERT INTO content_categories(name,slug,description,icon_media_id) VALUES($1,$2,$3,$4) RETURNING id::text,name,slug,description,version,icon_media_id::text AS "iconMediaId"`,[value.name,value.slug,value.description,iconMediaId]);
 }else{
  result=id
   ?await client.query(`UPDATE content_tags SET name=$2,slug=$3,description=$4,version=version+1 WHERE id=$1 RETURNING id::text,name,slug,description,version,NULL::text AS "iconMediaId"`,[id,value.name,value.slug,value.description])
   :await client.query(`INSERT INTO content_tags(name,slug,description) VALUES($1,$2,$3) RETURNING id::text,name,slug,description,version,NULL::text AS "iconMediaId"`,[value.name,value.slug,value.description]);
 }
 const row=result.rows[0] as TermRow;await audit(client,actor,kind,row.id,row.name,id?"updated":"created");return row;
});}
export async function deleteTerm(actor:string,kind:Kind,id:string,version:number){return mutate(actor,async client=>{
 const row=(await client.query(`SELECT name,version FROM ${tables[kind]} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
 if(!row)throw new ContentStoreError("missing");if(row.version!==version)throw new ContentStoreError("conflict");
 await client.query(`DELETE FROM ${tables[kind]} WHERE id=$1`,[id]);await audit(client,actor,kind,id,row.name,"deleted");return {deleted:true as const};
});}
const projection=(list=false)=>`c.id::text,c.type,c.title,c.featured,c.featured_at,c.pin_level,${list?"c.feed_text":"c.excerpt"} AS excerpt,c.status,c.version,c.updated_at,c.published_at,
 CASE WHEN g.id IS NULL THEN NULL ELSE jsonb_build_object('id',g.id::text,'name',g.name,'slug',g.slug) END AS category,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id::text,'name',t.name,'slug',t.slug) ORDER BY t.id) FROM content_tag_links l JOIN content_tags t ON t.id=l.tag_id WHERE l.content_id=c.id),'[]'::jsonb) AS tags`;
const mediaProjection=`COALESCE((SELECT jsonb_agg(jsonb_build_object('mediaId',m.id::text,'role',l.role,'altText',l.alt_text,'caption',l.caption,'name',m.original_name,'mimeType',m.mime_type,'width',m.width,'height',m.height) ORDER BY l.role,l.position) FROM content_media l JOIN media_assets m ON m.id=l.media_id WHERE l.content_id=c.id),'[]'::jsonb) AS media`;
export async function readContentList(query:{q:string;status?:string;before?:string;type?:string;categoryId?:string;tagId?:string;limit?:number;sort?:"latest"|"published"|"updated"|"priority";featured?:string;pinned?:string;cursor?:{id:string;at:string;pin:number}}){
 const sort=query.sort??"latest",at=sort==="updated"?"c.updated_at":"COALESCE(c.published_at,'epoch'::timestamptz)";
 const order=sort==="latest"?"c.id DESC":(sort==="priority"?"c.pin_level DESC,":"")+at+" DESC,c.id DESC";
 const after=sort==="latest"?"($2::bigint IS NULL OR c.id<$2::bigint)":sort==="priority"?`($10::bigint IS NULL OR (c.pin_level,${at},c.id)<($11::smallint,$9::timestamptz,$10::bigint))`:`($10::bigint IS NULL OR (${at},c.id)<($9::timestamptz,$10::bigint))`;
 // Select only this page's identifiers before computing JSON/tag projections.
 const result=await getPool().query(`WITH cursor_types AS (SELECT $2::bigint,$9::timestamptz,$10::bigint,$11::smallint), selected AS MATERIALIZED (SELECT c.id FROM contents c
 WHERE ($1='all' OR c.status=$1) AND ${after} AND ($3='' OR lower(c.title) LIKE $4)
 AND ($5::text IS NULL OR c.type=$5) AND ($6::bigint IS NULL OR c.category_id=$6::bigint)
 AND ($7::bigint IS NULL OR EXISTS(SELECT 1 FROM content_tag_links l WHERE l.content_id=c.id AND l.tag_id=$7::bigint))
 AND ($12='all' OR c.featured=($12='yes')) AND ($13='all' OR (c.pin_level>0)=($13='yes'))
 ORDER BY ${order} LIMIT $8) SELECT ${projection(true)},to_char(${at} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_at FROM selected s JOIN contents c ON c.id=s.id LEFT JOIN content_categories g ON g.id=c.category_id ORDER BY ${order}`,[query.status??"published",query.before??null,query.q,pattern(query.q),query.type??null,query.categoryId??null,query.tagId??null,query.limit??31,query.cursor?.at??null,query.cursor?.id??null,query.cursor?.pin??null,query.featured??"all",query.pinned??"all"]);
 return result.rows as ContentRow[];
}
export async function readContent(id:string,publishedOnly=false){const result=await getPool().query(`SELECT ${projection()},c.body,${publishedOnly?"'[]'::jsonb AS media":mediaProjection},COALESCE(e.data,'{}'::jsonb) AS data,COALESCE(e.schema_version,0) AS data_schema_version FROM contents c LEFT JOIN content_categories g ON g.id=c.category_id LEFT JOIN content_extensions e ON e.content_id=c.id WHERE c.id=$1 AND (NOT $2::boolean OR c.status='published')`,[id,publishedOnly]);return result.rows[0] as ContentRow|undefined;}
export async function writeContent(actor:string,value:ContentInput,id?:string,version?:number,extension?:{schemaVersion:number;data:Record<string,string|number|boolean>}){return mutate(actor,async client=>{
 if(id){const row=(await client.query("SELECT c.version,c.type,e.schema_version FROM contents c LEFT JOIN content_extensions e ON e.content_id=c.id WHERE c.id=$1 FOR UPDATE OF c",[id])).rows[0];if(!row)throw new ContentStoreError("missing");if(row.version!==version)throw new ContentStoreError("conflict");if(row.type===value.type&&row.schema_version!=null&&row.schema_version!==extension?.schemaVersion)throw new ContentStoreError("conflict");}
 if(value.categoryId){const category=await client.query("SELECT 1 FROM content_categories WHERE id=$1 FOR KEY SHARE",[value.categoryId]);if(!category.rowCount)throw new ContentStoreError("invalid_reference");}
 if(value.tagIds.length){const tags=await client.query("SELECT id FROM content_tags WHERE id=ANY($1::bigint[]) FOR KEY SHARE",[value.tagIds]);if(tags.rowCount!==value.tagIds.length)throw new ContentStoreError("invalid_reference");}
 if(value.media?.length){const ids=[...new Set(value.media.map(item=>item.mediaId))];const assets=await client.query("SELECT id FROM media_assets WHERE id=ANY($1::bigint[]) AND status='ready' AND kind='image' ORDER BY id FOR UPDATE",[ids]);if(assets.rowCount!==ids.length)throw new ContentStoreError("invalid_reference");}
 const values=[value.type,value.title,value.excerpt,value.body,value.categoryId,value.status];
 const result=id?await client.query(`UPDATE contents SET type=$1,title=$2,excerpt=$3,body=$4,category_id=$5,status=$6,updated_at=NOW(),version=version+1,published_at=CASE WHEN $6='published' THEN COALESCE(published_at,NOW()) ELSE published_at END,featured=COALESCE($8,featured),featured_at=CASE WHEN $8=false THEN NULL WHEN $8=true THEN COALESCE(featured_at,now()) ELSE featured_at END,pin_level=COALESCE($9,pin_level) WHERE id=$7 RETURNING id::text`,[...values,id,value.featured??null,value.pinLevel??null])
  :await client.query(`INSERT INTO contents(type,title,excerpt,body,category_id,status,author_id,published_at,featured,featured_at,pin_level) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $6='published' THEN NOW() ELSE NULL END,$8,CASE WHEN $8 THEN now() END,$9) RETURNING id::text`,[...values,actor,value.featured??false,value.pinLevel??0]);
 const savedId=result.rows[0].id as string;
 if(value.media!==undefined){await client.query("DELETE FROM content_media WHERE content_id=$1",[savedId]);if(value.media.length){const positions={cover:0,gallery:0,attachment:0};const links=value.media.map(item=>({media_id:item.mediaId,role:item.role,position:positions[item.role]++,alt_text:item.altText,caption:item.caption}));await client.query("INSERT INTO content_media(content_id,media_id,role,position,alt_text,caption) SELECT $1,x.media_id,x.role,x.position,x.alt_text,x.caption FROM jsonb_to_recordset($2::jsonb) AS x(media_id bigint,role text,position integer,alt_text text,caption text)",[savedId,JSON.stringify(links)]);}}
 await client.query("DELETE FROM content_tag_links WHERE content_id=$1",[savedId]);
 if(value.tagIds.length)await client.query("INSERT INTO content_tag_links(content_id,tag_id) SELECT $1,unnest($2::bigint[])",[savedId,value.tagIds]);
 if(extension)await client.query("INSERT INTO content_extensions(content_id,schema_version,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(content_id) DO UPDATE SET schema_version=EXCLUDED.schema_version,data=EXCLUDED.data",[savedId,extension.schemaVersion,JSON.stringify(extension.data)]);
 else await client.query("DELETE FROM content_extensions WHERE content_id=$1",[savedId]);
 await audit(client,actor,"content",savedId,value.title||value.body.slice(0,80),id?"updated":"created");
 return (await client.query(`SELECT ${projection()},c.body,${mediaProjection},COALESCE(e.data,'{}'::jsonb) AS data,COALESCE(e.schema_version,0) AS data_schema_version FROM contents c LEFT JOIN content_categories g ON g.id=c.category_id LEFT JOIN content_extensions e ON e.content_id=c.id WHERE c.id=$1`,[savedId])).rows[0] as ContentRow;
});}
export async function deleteContent(actor:string,id:string,version:number){return mutate(actor,async client=>{
 const row=(await client.query("SELECT COALESCE(NULLIF(title,''),left(feed_text,80)) AS title,version,status FROM contents WHERE id=$1 FOR UPDATE",[id])).rows[0];
 if(!row)throw new ContentStoreError("missing");if(row.version!==version)throw new ContentStoreError("conflict");if(row.status==="published")throw new ContentStoreError("published");
 await client.query("DELETE FROM contents WHERE id=$1",[id]);await audit(client,actor,"content",id,row.title,"deleted");return {deleted:true as const};
});}
export async function readContentAudit(before?:string){const result=await getPool().query(`SELECT a.id::text,a.kind,a.object_id,a.label,a.action,a.created_at,u.name AS actor_name,u.email AS actor_email FROM content_audit a LEFT JOIN "user" u ON u.id=a.actor_id WHERE ($1::bigint IS NULL OR a.id<$1::bigint) ORDER BY a.id DESC LIMIT 31`,[before??null]);return result.rows as {id:string;kind:"content"|Kind;object_id:string;label:string;action:"created"|"updated"|"deleted";created_at:Date;actor_name:string|null;actor_email:string|null}[];}
