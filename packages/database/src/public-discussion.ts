import "server-only";
import {getPool} from "./index";

/** Metadata/visibility projection: never loads the full post or its media again. */
export async function readSiteContentHead(token:string,type:"post"|"article"){
 return (await getPool().query(`SELECT c.id::text,c.title,left(c.body,160) AS excerpt,c.updated_at,c.published_at,u.name AS author_name,
 EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='content' AND d.local_id=c.id::text) AS demo,
 c.slug AS slug,g.slug AS category_slug
 FROM public_route_ids p JOIN contents c ON c.id=p.content_id
 JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false)
 LEFT JOIN content_categories g ON g.id=c.category_id
 WHERE p.short_id=$1 AND p.kind='content' AND c.type=$2 AND c.status='published'`,[token,type])).rows[0] as {id:string;title:string;excerpt:string;updated_at:Date;published_at:Date;author_name:string;demo:boolean;slug:string|null;category_slug:string|null}|undefined;
}

export type PublicCommentRow={id:string;content_id:string;author_id:string;updated_at:Date;body:string;author_name:string;author_image:string|null;created_at:Date;reply_to_name:string|null;reply_count:number};
// Every query rechecks the parent and author. Hidden/deleted roots never expose their replies.
const joins=`FROM comments a JOIN contents c ON c.id=a.content_id AND c.status='published'
 JOIN "user" owner ON owner.id=c.author_id AND NOT COALESCE(owner.banned,false)
 JOIN "user" u ON u.id=a.author_id AND NOT COALESCE(u.banned,false)
 LEFT JOIN comments target ON target.id=a.reply_to_id AND target.status='visible' AND NOT target.thread_hidden
 LEFT JOIN "user" target_user ON target_user.id=target.author_id AND NOT COALESCE(target_user.banned,false)`;
// Root lists include all visible replies; nested branches follow visible parents.
const replyCount=`CASE WHEN a.root_id IS NULL THEN
 (SELECT count(*)::int FROM comments reply JOIN "user" au ON au.id=reply.author_id AND NOT COALESCE(au.banned,false)
 WHERE reply.content_id=a.content_id AND reply.root_id=COALESCE(a.root_id,a.id)
 AND reply.status='visible' AND NOT reply.thread_hidden)
 ELSE (WITH RECURSIVE descendants(id) AS (
 SELECT a.id
 UNION
 SELECT child.id FROM comments child JOIN descendants parent ON child.reply_to_id=parent.id
 JOIN "user" author ON author.id=child.author_id AND NOT COALESCE(author.banned,false)
 WHERE child.content_id=a.content_id AND child.root_id=a.root_id AND child.status='visible' AND NOT child.thread_hidden
 ) SELECT count(*)::int FROM descendants WHERE id<>a.id) END`;
const projection=`a.id::text,a.content_id::text,a.author_id,a.updated_at,a.body,u.name AS author_name,u.image AS author_image,a.created_at,target_user.name AS reply_to_name,
 ${replyCount} AS reply_count`;
export async function readSiteCommentRoots(contentId:string,before:string|null,root:string|null){
 return (await getPool().query(`SELECT ${projection} ${joins}
 WHERE a.content_id=$1 AND a.root_id IS NULL AND a.status='visible' AND NOT a.thread_hidden
 AND ($2::bigint IS NULL OR a.id<$2) AND ($3::bigint IS NULL OR a.id=$3)
 ORDER BY a.id DESC LIMIT 11`,[contentId,before,root])).rows as PublicCommentRow[];
}
/** One bounded batch: three initial replies or five after a cursor, plus a lookahead. */
export async function readSiteCommentReplies(contentId:string,roots:string[],before:string|null){
 if(roots.length>10)throw new Error("Comment batch exceeded");
 return (await getPool().query(`SELECT root.id::text AS root_id,replies.* FROM comments root
 JOIN "user" ru ON ru.id=root.author_id AND NOT COALESCE(ru.banned,false)
 CROSS JOIN LATERAL (SELECT ${projection} ${joins}
 WHERE a.content_id=$1 AND a.root_id=root.id AND a.status='visible' AND NOT a.thread_hidden
 AND ($3::bigint IS NULL OR a.id>$3) ORDER BY a.id ASC LIMIT CASE WHEN $3::bigint IS NULL THEN 4 ELSE 6 END) replies
 WHERE root.content_id=$1 AND root.id=ANY($2::bigint[]) AND root.root_id IS NULL
 AND root.status='visible' AND NOT root.thread_hidden ORDER BY root.id DESC,replies.id::bigint ASC`,[contentId,roots,before])).rows as (PublicCommentRow&{root_id:string})[];
}

export async function readPublicCommentIds(ids:string[]){
 return (await getPool().query("SELECT comment_id::text AS id,short_id AS token FROM public_comment_ids WHERE comment_id=ANY($1::bigint[])",[ids])).rows as {id:string;token:string}[];
}
export async function savePublicCommentIds(rows:{id:string;token:string}[]){
 await getPool().query(`INSERT INTO public_comment_ids(comment_id,short_id)
 SELECT id::bigint,token FROM jsonb_to_recordset($1::jsonb) AS r(id text,token text)
 ON CONFLICT(comment_id) DO NOTHING`,[JSON.stringify(rows)]);
}
// A reply is public only while its original root and the root's author remain public.
const visibleRoot=`(a.root_id IS NULL OR EXISTS(SELECT 1 FROM comments root JOIN "user" ru ON ru.id=root.author_id
 WHERE root.id=a.root_id AND root.content_id=a.content_id AND root.status='visible' AND NOT root.thread_hidden AND NOT COALESCE(ru.banned,false)))`;
/** One query refreshes every public ancestor after insertion, including covered views. */
export async function readSiteAncestorReplyCounts(token:string){
 return (await getPool().query(`WITH RECURSIVE ancestors(id,content_id,reply_to_id,root_id) AS (
 SELECT a.id,a.content_id,a.reply_to_id,a.root_id ${joins}
 JOIN public_comment_ids route ON route.comment_id=a.id
 WHERE route.short_id=$1 AND a.status='visible' AND NOT a.thread_hidden AND ${visibleRoot}
 UNION
 SELECT parent.id,parent.content_id,parent.reply_to_id,parent.root_id
 FROM comments parent JOIN ancestors child ON parent.id=child.reply_to_id AND parent.content_id=child.content_id
 ) SELECT route.short_id AS "publicId",${replyCount} AS count ${joins}
 JOIN public_comment_ids route ON route.comment_id=a.id
 WHERE a.id IN (SELECT id FROM ancestors UNION SELECT root_id FROM ancestors WHERE root_id IS NOT NULL)
 AND route.short_id<>$1 AND a.status='visible' AND NOT a.thread_hidden AND ${visibleRoot}`,[token])).rows as {publicId:string;count:number}[];
}
export async function readSiteSelectedComment(contentId:string,token:string){
 return (await getPool().query(`SELECT ${projection} ${joins}
 JOIN public_comment_ids route ON route.comment_id=a.id
 WHERE a.content_id=$1 AND route.short_id=$2 AND a.status='visible' AND NOT a.thread_hidden AND ${visibleRoot}`,[contentId,token])).rows[0] as PublicCommentRow|undefined;
}
export async function readSiteDirectReplies(contentId:string,parentId:string,before:string|null,limit:3|5|10=10){
 return (await getPool().query(`SELECT ${projection} ${joins}
 WHERE a.content_id=$1 AND a.reply_to_id=$2 AND a.status='visible' AND NOT a.thread_hidden
 AND EXISTS(SELECT 1 FROM comments parent JOIN "user" pu ON pu.id=parent.author_id
 WHERE parent.id=$2 AND parent.content_id=$1 AND parent.status='visible' AND NOT parent.thread_hidden AND NOT COALESCE(pu.banned,false))
 AND ${visibleRoot} AND ($3::bigint IS NULL OR a.id<$3) ORDER BY a.id DESC LIMIT $4`,[contentId,parentId,before,limit+1])).rows as PublicCommentRow[];
}

/** Page the entire visible branch, including replies to replies, without per-item queries. */
export async function readSiteDescendantReplies(contentId:string,parentId:string,before:string|null){
 return (await getPool().query(`WITH RECURSIVE branch(id) AS (
 SELECT a.id ${joins}
 WHERE a.content_id=$1 AND a.id=$2 AND a.status='visible' AND NOT a.thread_hidden AND ${visibleRoot}
 UNION
 SELECT child.id FROM comments child JOIN branch parent ON child.reply_to_id=parent.id
 JOIN "user" author ON author.id=child.author_id AND NOT COALESCE(author.banned,false)
 WHERE child.content_id=$1 AND child.status='visible' AND NOT child.thread_hidden
 ) SELECT ${projection} ${joins}
 JOIN branch ON branch.id=a.id
 WHERE a.id<>$2 AND ${visibleRoot} AND ($3::bigint IS NULL OR a.id>$3)
 ORDER BY a.id ASC LIMIT 6`,[contentId,parentId,before])).rows as PublicCommentRow[];
}


/** Resolve the parent by comment token without exposing internal IDs to routes. */
export async function readSiteCommentParent(token:string){
 return (await getPool().query(`SELECT p.short_id AS token,c.type
 ${joins} JOIN public_comment_ids route ON route.comment_id=a.id
 JOIN public_route_ids p ON p.content_id=c.id AND p.kind='content'
 WHERE route.short_id=$1 AND a.status='visible' AND NOT a.thread_hidden AND ${visibleRoot}
 AND c.type IN ('post','article')`,[token])).rows[0] as {token:string;type:"post"|"article"}|undefined;
}
