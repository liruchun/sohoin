import "server-only";
import {getPool} from "./index";
type Kind="content"|"comments";
const publicComments=`SELECT c.id,c.content_id,left(c.body,120) AS preview FROM comments c
 JOIN contents p ON p.id=c.content_id AND p.status='published' AND p.type IN ('post','article')
 JOIN "user" owner ON owner.id=p.author_id AND NOT COALESCE(owner.banned,false)
 JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false)
 JOIN comments r ON r.id=COALESCE(c.root_id,c.id) AND r.content_id=c.content_id AND r.root_id IS NULL
 JOIN "user" ru ON ru.id=r.author_id AND NOT COALESCE(ru.banned,false)
 WHERE c.status='visible' AND NOT c.thread_hidden AND r.status='visible' AND NOT r.thread_hidden`;
// Only these fixed identifiers can enter SQL; request values are parameters.
function tables(kind:Kind){if(kind!=="content"&&kind!=="comments")throw new Error("Invalid interaction kind");return kind==="content"?{reactions:"content_reactions",bookmarks:"content_bookmarks",key:"content_id"}:{reactions:"comment_reactions",bookmarks:"comment_bookmarks",key:"comment_id"};}
function visible(kind:Kind,publicOnly=false){if(publicOnly&&kind==="comments")return publicComments;if(publicOnly&&kind==="content")return `SELECT p.id,p.id AS content_id,COALESCE(NULLIF(p.title,''),left(p.feed_text,120)) AS preview FROM contents p JOIN "user" u ON u.id=p.author_id WHERE p.status='published' AND p.type IN ('post','article') AND NOT COALESCE(u.banned,false)`;return kind==="content"?`SELECT p.id,p.id AS content_id,COALESCE(NULLIF(p.title,''),left(p.feed_text,120)) AS preview FROM contents p WHERE p.status='published'`:`SELECT c.id,c.content_id,left(c.body,120) AS preview FROM comments c JOIN contents p ON p.id=c.content_id LEFT JOIN comments r ON r.id=c.root_id WHERE p.status='published' AND c.status='visible' AND NOT c.thread_hidden AND NOT COALESCE(r.thread_hidden,false)`;}
export class InteractionStoreError extends Error{constructor(public code:"forbidden"|"missing"|"invalid_reaction"|"conflict"|"reaction_limit"){super(code);}}
export async function readReactionTypes(admin=false){return (await getPool().query("SELECT code,label,emoji,enabled,position,version FROM reaction_types WHERE ($1 OR enabled) ORDER BY position,code",[admin])).rows as {code:string;label:string;emoji:string;enabled:boolean;position:number;version:number}[];}
export async function updateStoredReactionType(actor:string,code:string,input:{version:number;enabled:boolean;position:number}){
 const client=await getPool().connect();try{await client.query("BEGIN");if(!(await client.query(`SELECT id FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) FOR SHARE`,[actor])).rowCount)throw new InteractionStoreError("forbidden");
 const old=(await client.query("SELECT code,enabled,position,version FROM reaction_types WHERE code=$1 FOR UPDATE",[code])).rows[0];if(!old)throw new InteractionStoreError("missing");if(old.version!==input.version)throw new InteractionStoreError("conflict");
 const result=(await client.query("UPDATE reaction_types SET enabled=$2,position=$3,version=version+1 WHERE code=$1 RETURNING code,label,emoji,enabled,position,version",[code,input.enabled,input.position])).rows[0];
 await client.query("INSERT INTO settings_audit(actor_id,before_value,after_value) VALUES($1,jsonb_build_object('reactionTypes',$2::jsonb),jsonb_build_object('reactionTypes',$3::jsonb))",[actor,JSON.stringify(old),JSON.stringify({code,enabled:input.enabled,position:input.position,version:input.version+1})]);await client.query("COMMIT");return result;
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
export async function writeInteraction(actor:string,kind:Kind,id:string,value:{code:string|null;active?:boolean}|{active:boolean},publicOnly=false){
 const tab=tables(kind),client=await getPool().connect();try{await client.query("BEGIN");
 if(!(await client.query('SELECT id FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) FOR SHARE',[actor])).rowCount)throw new InteractionStoreError("forbidden");
 // Public adapters must enforce the same author/type visibility as the site,
 // inside the transaction even for removals; serialize against moderation.
 if(publicOnly&&kind==="content"&&!(await client.query(`SELECT c.id FROM contents c JOIN "user" u ON u.id=c.author_id WHERE c.id=$1 AND c.status='published' AND c.type IN ('post','article') AND NOT COALESCE(u.banned,false) FOR SHARE OF c,u`,[id])).rowCount)throw new InteractionStoreError("missing");
 if(publicOnly&&kind==="comments"&&!(await client.query(publicComments+" AND c.id=$1 FOR SHARE OF p,owner,u,r,ru,c",[id])).rowCount)throw new InteractionStoreError("missing");
 if("code" in value)await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[tab.reactions+":"+id+":"+actor]);
 const adding="code" in value?value.code!==null&&value.active!==false:value.active;
 if(adding){
  if("code" in value&&!(await client.query("SELECT code FROM reaction_types WHERE code=$1 AND enabled FOR SHARE",[value.code])).rowCount)throw new InteractionStoreError("invalid_reaction");
  if(kind==="content"){if(!(await client.query("SELECT id FROM contents WHERE id=$1 AND status='published' FOR SHARE",[id])).rowCount)throw new InteractionStoreError("missing");}
  else{
   const row=(await client.query("SELECT content_id::text,COALESCE(root_id,id)::text AS root_id FROM comments WHERE id=$1",[id])).rows[0];if(!row)throw new InteractionStoreError("missing");
   if(!(await client.query("SELECT id FROM contents WHERE id=$1 AND status='published' FOR SHARE",[row.content_id])).rowCount)throw new InteractionStoreError("missing");
   await client.query("SELECT id FROM comments WHERE id=$1 FOR SHARE",[row.root_id]);await client.query("SELECT id FROM comments WHERE id=$1 FOR SHARE",[id]);
   if(!(await client.query(`SELECT id FROM (${visible(kind)}) v WHERE id=$1`,[id])).rowCount)throw new InteractionStoreError("missing");
  }
 }
 if("code" in value){
  if(value.code===null)await client.query(`DELETE FROM ${tab.reactions} WHERE ${tab.key}=$1 AND user_id=$2`,[id,actor]);
  else if(value.active===false)await client.query(`DELETE FROM ${tab.reactions} WHERE ${tab.key}=$1 AND user_id=$2 AND code=$3`,[id,actor,value.code]);
  else{
   // The existing v1 API retains replacement semantics; public UI uses explicit active.
   if(value.active===undefined)await client.query(`DELETE FROM ${tab.reactions} WHERE ${tab.key}=$1 AND user_id=$2 AND code<>$3`,[id,actor,value.code]);
   await client.query(`INSERT INTO ${tab.reactions}(${tab.key},user_id,code) VALUES($1,$2,$3) ON CONFLICT(${tab.key},user_id,code) DO NOTHING`,[id,actor,value.code]);
  }
 }
 else if(value.active)await client.query(`INSERT INTO ${tab.bookmarks}(${tab.key},user_id) VALUES($1,$2) ON CONFLICT(user_id,${tab.key}) DO NOTHING`,[id,actor]);
 else await client.query(`DELETE FROM ${tab.bookmarks} WHERE ${tab.key}=$1 AND user_id=$2`,[id,actor]);
 await client.query("COMMIT");return value;
 }catch(error){await client.query("ROLLBACK");if((error as {constraint?:string}).constraint==="reaction_selection_limit")throw new InteractionStoreError("reaction_limit");throw error;}finally{client.release();}
}
export async function readInteractionBatch(actor:string,kind:Kind,ids:string[],publicOnly=false){const tab=tables(kind);return (await getPool().query(`WITH targets AS MATERIALIZED (SELECT * FROM (${visible(kind,publicOnly)}) v WHERE id=ANY($1::bigint[])), local_counts AS (SELECT x.${tab.key} AS id,x.code,count(*)::int AS n FROM ${tab.reactions} x JOIN targets v ON v.id=x.${tab.key} GROUP BY x.${tab.key},x.code), counts AS (SELECT id,code,sum(n)::int AS n FROM (SELECT * FROM local_counts UNION ALL SELECT d.${kind==="content"?"content_id":"comment_id"} AS id,d.code,d.count AS n FROM demo_reaction_counts d JOIN targets v ON v.id=d.${kind==="content"?"content_id":"comment_id"}) totals GROUP BY id,code), grouped AS (SELECT id,jsonb_agg(jsonb_build_object('code',code,'count',n) ORDER BY code) AS reactions FROM counts GROUP BY id) SELECT v.id::text,COALESCE(g.reactions,'[]'::jsonb) AS reactions,m.codes[1] AS my_reaction,COALESCE(m.codes,ARRAY[]::text[]) AS my_reactions,(b.id IS NOT NULL) AS bookmarked FROM targets v LEFT JOIN grouped g ON g.id=v.id LEFT JOIN LATERAL (SELECT array_agg(code ORDER BY updated_at DESC,code) AS codes FROM ${tab.reactions} WHERE ${tab.key}=v.id AND user_id=$2) m ON true LEFT JOIN ${tab.bookmarks} b ON b.${tab.key}=v.id AND b.user_id=$2 ORDER BY v.id DESC`,[ids,actor])).rows as {id:string;reactions:{code:string;count:number}[];my_reaction:string|null;my_reactions:string[];bookmarked:boolean}[];}
export async function readOwnBookmarks(actor:string,kind:Kind,before?:string){const tab=tables(kind);return (await getPool().query(`SELECT b.id::text AS bookmark_id,v.id::text,v.content_id::text,v.preview,b.created_at FROM ${tab.bookmarks} b JOIN (${visible(kind)}) v ON v.id=b.${tab.key} WHERE b.user_id=$1 AND ($2::bigint IS NULL OR b.id<$2::bigint) ORDER BY b.id DESC LIMIT 31`,[actor,before??null])).rows as {bookmark_id:string;id:string;content_id:string;preview:string;created_at:Date}[];}
