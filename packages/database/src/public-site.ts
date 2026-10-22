import "server-only";
import {getPool} from "./index";
export type PublicFeedRow={id:string;type:string;title:string;body:string;body_truncated:boolean;published_at:Date;updated_at:Date;author_id:string;author_name:string;author_image:string|null;category:string|null;category_slug:string|null;slug:string|null;cursor_at:string;demo:boolean};
const demo="EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='content' AND d.local_id=c.id::text)";
const projection=`c.id::text,c.type,c.title,c.body,false AS body_truncated,c.published_at,to_char(c.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,c.updated_at,u.id AS author_id,u.name AS author_name,u.image AS author_image,g.name AS category,g.slug AS category_slug,c.slug AS slug,${demo} AS demo`;
export async function readSiteFeed(view:"featured"|"latest"|"articles",before:{id:string;at:string}|null,excludeDemo:boolean){return (await getPool().query(`SELECT ${projection.replace("c.body","left(c.body,1500) AS body").replace("false AS body_truncated","(length(c.body)>1500) AS body_truncated")} FROM contents c JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false) LEFT JOIN content_categories g ON g.id=c.category_id WHERE c.status='published' AND c.type IN ('post','article') AND ($1<>'featured' OR c.featured) AND ($1<>'articles' OR c.type='article') AND (NOT $2 OR NOT ${demo}) AND ($3::timestamptz IS NULL OR (c.published_at,c.id)<($3::timestamptz,$4::bigint)) ORDER BY c.published_at DESC,c.id DESC LIMIT 21`,[view,excludeDemo,before?.at??null,before?.id??null])).rows as PublicFeedRow[];}
export async function readSiteContent(id:string){return (await getPool().query(`SELECT ${projection} FROM contents c JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false) LEFT JOIN content_categories g ON g.id=c.category_id WHERE c.id=$1 AND c.status='published' AND c.type IN ('post','article')`,[id])).rows[0] as PublicFeedRow|undefined;}
export type CommunitySort="latest"|"hot"|"mine";
export type SiteTopicRow={id:string;name:string;slug:string;description:string;icon_url:string|null;posts:number};
export type SiteTopicRef={id:string;name:string;slug:string;description:string;icon_url:string|null};
const commentCount=`(SELECT count(*)::int FROM comments a LEFT JOIN comments root ON root.id=a.root_id LEFT JOIN "user" root_user ON root_user.id=root.author_id JOIN "user" au ON au.id=a.author_id AND NOT COALESCE(au.banned,false) WHERE a.content_id=c.id AND a.status='visible' AND NOT a.thread_hidden AND NOT COALESCE(root.thread_hidden,false) AND (a.root_id IS NULL OR (root.status='visible' AND root_user.id IS NOT NULL AND NOT COALESCE(root_user.banned,false))))`;
export async function readSiteTopics(excludeDemo:boolean){
 return (await getPool().query(`SELECT g.id::text,g.name,g.slug,g.description,
  CASE WHEN m.id IS NOT NULL THEN '/api/site-media/'||m.storage_key||'?variant=thumbnail' END AS icon_url,
  (SELECT count(*)::int FROM contents c JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false)
   WHERE c.category_id=g.id AND c.status='published' AND c.type IN ('post','article') AND (NOT $1 OR NOT ${demo})) AS posts
  FROM content_categories g
  LEFT JOIN media_assets m ON m.id=g.icon_media_id AND m.status='ready' AND m.kind='image' AND m.mime_type='image/webp' AND m.storage_provider='local' AND m.storage_namespace='images-v1'
   AND EXISTS(SELECT 1 FROM media_variants v WHERE v.media_id=m.id AND v.variant_key='thumbnail' AND v.status='ready' AND v.mime_type='image/webp')
  ORDER BY g.name`,[excludeDemo])).rows as SiteTopicRow[];
}
export async function readSiteTopic(slug:string){
 return (await getPool().query(`SELECT g.id::text,g.name,g.slug,g.description,
  CASE WHEN m.id IS NOT NULL THEN '/api/site-media/'||m.storage_key||'?variant=thumbnail' END AS icon_url
  FROM content_categories g
  LEFT JOIN media_assets m ON m.id=g.icon_media_id AND m.status='ready' AND m.kind='image' AND m.mime_type='image/webp' AND m.storage_provider='local' AND m.storage_namespace='images-v1'
   AND EXISTS(SELECT 1 FROM media_variants v WHERE v.media_id=m.id AND v.variant_key='thumbnail' AND v.status='ready' AND v.mime_type='image/webp')
  WHERE g.slug=$1`,[slug])).rows[0] as SiteTopicRef|undefined;
}
export async function readSiteCategoryMembership(slug:string,userId:string){
 const result=await getPool().query(`SELECT EXISTS(
  SELECT 1 FROM content_category_members m JOIN content_categories g ON g.id=m.category_id
  WHERE g.slug=$1 AND m.user_id=$2
 ) AS joined`,[slug,userId]);
 return Boolean(result.rows[0]?.joined);
}
/** One statement avoids a category/membership read-write gap. */
export async function writeSiteCategoryMembership(slug:string,userId:string,joined:boolean){
 const result=joined
  ?await getPool().query(`WITH category AS (SELECT id FROM content_categories WHERE slug=$1),
    changed AS (INSERT INTO content_category_members(category_id,user_id)
     SELECT id,$2 FROM category ON CONFLICT(category_id,user_id) DO NOTHING RETURNING 1)
    SELECT EXISTS(SELECT 1 FROM category) AS category_exists,EXISTS(SELECT 1 FROM changed) AS changed`,[slug,userId])
  :await getPool().query(`WITH category AS (SELECT id FROM content_categories WHERE slug=$1),
    changed AS (DELETE FROM content_category_members m USING category
     WHERE m.category_id=category.id AND m.user_id=$2 RETURNING 1)
    SELECT EXISTS(SELECT 1 FROM category) AS category_exists,EXISTS(SELECT 1 FROM changed) AS changed`,[slug,userId]);
 return {exists:Boolean(result.rows[0]?.category_exists),changed:Boolean(result.rows[0]?.changed)};
}

/** One bounded page of a topic feed. Hot ranks by interactions, mine keeps the
 *  viewer's own interactions, and both reuse the published-time cursor layout. */
export async function readSiteCommunityFeed(input:{sort:CommunitySort;topicId:string|null;before:{id:string;at:string;score?:number}|null;excludeDemo:boolean;viewer:string|null}){
 const {sort,topicId,before,excludeDemo,viewer}=input;
 const list=projection.replace("c.body","left(c.body,1500) AS body").replace("false AS body_truncated","(length(c.body)>1500) AS body_truncated");
 const score=`((SELECT count(*)::int FROM content_reactions r WHERE r.content_id=c.id)+(SELECT count(*)::int FROM content_bookmarks b WHERE b.content_id=c.id)+${commentCount})`;
 const order=sort==="hot"?"f.score DESC,f.published_at DESC,f.sort_id DESC":"f.published_at DESC,f.sort_id DESC";
 const cursor=sort==="hot"?"($4::int IS NULL OR (f.score,f.published_at,f.sort_id)<($4::int,$5::timestamptz,$6::bigint))":"($4::timestamptz IS NULL OR (f.published_at,f.sort_id)<($4::timestamptz,$5::bigint))";
 const params=sort==="hot"?[topicId,excludeDemo,viewer,before?.score??null,before?.at??null,before?.id??null]:[topicId,excludeDemo,viewer,before?.at??null,before?.id??null];
 return (await getPool().query(`SELECT f.* FROM (
  SELECT ${list},c.id AS sort_id,${sort==="hot"?`${score} AS score`:"NULL::int AS score"}
  FROM contents c JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false) LEFT JOIN content_categories g ON g.id=c.category_id
  WHERE c.status='published' AND c.type IN ('post','article') AND ($1::bigint IS NULL OR c.category_id=$1) AND (NOT $2 OR NOT ${demo})
   AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM content_reactions r WHERE r.content_id=c.id AND r.user_id=$3) OR EXISTS(SELECT 1 FROM content_bookmarks b WHERE b.content_id=c.id AND b.user_id=$3) OR EXISTS(SELECT 1 FROM comments a WHERE a.content_id=c.id AND a.author_id=$3 AND a.status='visible'))
 ) f WHERE ${cursor} ORDER BY ${order} LIMIT 21`,params)).rows as (PublicFeedRow&{sort_id:string;score:number})[];
}
export async function readSiteProfile(id:string){return (await getPool().query(`SELECT u.id,u.name,u.image,u."createdAt" AS joined_at,COALESCE(p.bio,'') AS bio,COALESCE(p.region,'') AS region,COALESCE(p.homepage,'') AS homepage,EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='user' AND d.local_id=u.id) AS demo FROM "user" u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1 AND NOT COALESCE(u.banned,false)`,[id])).rows[0] as {id:string;name:string;image:string|null;joined_at:Date;bio:string;region:string;homepage:string;demo:boolean}|undefined;}
export async function readPublicRouteIds(contentIds:string[],userIds:string[]){return (await getPool().query("SELECT kind,COALESCE(content_id::text,user_id) AS id,short_id AS token FROM public_route_ids WHERE short_id IS NOT NULL AND (content_id=ANY($1::bigint[]) OR user_id=ANY($2::text[]))",[contentIds,userIds])).rows as {kind:"content"|"user";id:string;token:string}[];}
export async function savePublicRouteIds(rows:{kind:"content"|"user";content_id:string|null;user_id:string|null;token:string}[]){await getPool().query(`INSERT INTO public_route_ids(kind,content_id,user_id,short_id) SELECT kind,content_id::bigint,user_id,token FROM jsonb_to_recordset($1::jsonb) AS r(kind text,content_id text,user_id text,token text) ON CONFLICT(kind,content_id,user_id) DO UPDATE SET short_id=EXCLUDED.short_id WHERE public_route_ids.short_id IS NULL`,[JSON.stringify(rows)]);}
export async function readSiteSitemap(after="0"){return (await getPool().query(`SELECT c.id::text,c.type,c.updated_at FROM contents c JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false) WHERE c.status='published' AND c.type IN ('post','article') AND NOT ${demo} AND c.id>$1::bigint ORDER BY c.id LIMIT 1000`,[after])).rows as {id:string;type:string;updated_at:Date}[];}

/** Unique index lookup; callers still enforce current entity visibility. */
export async function readPublicRouteTarget(token:string,kind:"content"|"user"){
 return (await getPool().query("SELECT COALESCE(content_id::text,user_id) AS id FROM public_route_ids WHERE short_id=$1 AND kind=$2",[token,kind])).rows[0]?.id as string|undefined;
}
