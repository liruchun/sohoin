import "server-only";
import {getPool} from "./index";

export type SitePresentation={id:string;media:{url:string;width:number;height:number;alt:string;kind?:string;image?:string;icon?:string;mime?:string;durationMs?:number;hasAudio?:boolean|null;poster?:string;sources?:{variant:string;width:number}[]}[];reactions:{code:string;label:string;emoji:string;count:number}[];comments:number};
// Identifiers come only from this closed owner mapping, never from a request.
function attachmentProjection(kind:'content'|'comment'){
 const owner=kind==='comment'?'comment_id':'content_id',id=kind==='comment'?'a.id':'c.id';
 return ` COALESCE((SELECT jsonb_agg(x.item ORDER BY x.position) FROM (
  SELECT l.position,jsonb_build_object('url','/api/site-media/'||m.storage_key,'width',m.width,'height',m.height,'alt',l.alt_text,'kind',m.kind,'mime',m.mime_type,'durationMs',m.duration_ms,'hasAudio',m.has_audio,'poster',CASE WHEN m.kind='video' THEN '/api/site-media/'||m.storage_key||'?variant=thumbnail' ELSE NULL END,'sources',COALESCE((SELECT jsonb_agg(jsonb_build_object('variant',v.variant_key,'width',v.width) ORDER BY v.width) FROM media_variants v WHERE v.media_id=m.id AND v.status='ready' AND v.variant_key IN ('w480','w960','w1440') AND v.mime_type='image/webp' AND v.storage_namespace='images-v1' AND v.storage_provider='local'),'[]'::jsonb)) AS item
  FROM content_media l JOIN media_assets m ON m.id=l.media_id AND m.status='ready' AND m.mime_type IN ('image/webp','video/mp4','video/webm') AND m.storage_provider='local' AND m.storage_namespace='images-v1'
  WHERE l.${owner}=${id} AND l.role='gallery'
  UNION ALL
  SELECT k.position,jsonb_build_object('kind','link','url',k.url,'alt',k.title,'width',16,'height',10,'icon',k.icon_url,'image',CASE WHEN m.status='ready' THEN '/api/site-media/'||m.storage_key||'?variant=thumbnail' ELSE k.image_url END)
  FROM content_links k LEFT JOIN media_assets m ON m.id=k.cover_media_id WHERE k.${owner}=${id}
  ORDER BY position LIMIT 9
 ) x),'[]'::jsonb) AS media`;
}

/** One bounded batch for a page, using the existing target indexes. No per-card requests. */
export async function readSitePresentation(ids:string[]):Promise<SitePresentation[]>{
 if(ids.length>20)throw new Error("Presentation batch exceeded");
 return (await getPool().query(`SELECT c.id::text,
 ${attachmentProjection('content')},
 COALESCE((SELECT jsonb_agg(jsonb_build_object('code',r.code,'label',t.label,'emoji',t.emoji,'count',r.n) ORDER BY t.position,t.code)
  FROM (SELECT code,sum(n)::int AS n FROM (
   SELECT code,count(*)::int AS n FROM content_reactions WHERE content_id=c.id GROUP BY code
   UNION ALL SELECT code,count AS n FROM demo_reaction_counts WHERE content_id=c.id
  ) counts GROUP BY code) r JOIN reaction_types t ON t.code=r.code AND t.enabled),'[]'::jsonb) AS reactions,
 (SELECT count(*)::int FROM comments a LEFT JOIN comments root ON root.id=a.root_id LEFT JOIN "user" root_user ON root_user.id=root.author_id JOIN "user" au ON au.id=a.author_id AND NOT COALESCE(au.banned,false)
  WHERE a.content_id=c.id AND a.status='visible' AND NOT a.thread_hidden AND NOT COALESCE(root.thread_hidden,false)
  AND (a.root_id IS NULL OR (root.status='visible' AND root_user.id IS NOT NULL AND NOT COALESCE(root_user.banned,false)))) AS comments
 FROM contents c JOIN "user" u ON u.id=c.author_id AND NOT COALESCE(u.banned,false)
 WHERE c.id=ANY($1::bigint[]) AND c.status='published' AND c.type IN ('post','article')`,[ids])).rows;
}

const visibleComment=`a.status='visible' AND NOT a.thread_hidden AND au.id IS NOT NULL AND NOT COALESCE(au.banned,false)
 AND (a.root_id IS NULL OR (root.status='visible' AND NOT root.thread_hidden AND ru.id IS NOT NULL AND NOT COALESCE(ru.banned,false)))`;

/** A discussion page contains at most 50 displayed roots and replies. */
export async function readCommentPresentation(ids:string[]):Promise<Pick<SitePresentation,'id'|'media'>[]>{
 if(ids.length>50)throw new Error('Comment presentation batch exceeded');
 if(!ids.length)return [];
 return (await getPool().query(`SELECT a.id::text,${attachmentProjection('comment')}
 FROM comments a JOIN contents c ON c.id=a.content_id AND c.status='published' AND c.type IN ('post','article')
 JOIN "user" owner ON owner.id=c.author_id AND NOT COALESCE(owner.banned,false)
 JOIN "user" au ON au.id=a.author_id
 LEFT JOIN comments root ON root.id=a.root_id LEFT JOIN "user" ru ON ru.id=root.author_id
 WHERE a.id=ANY($1::bigint[]) AND ${visibleComment}`,[ids])).rows;
}

function publicAttachmentReference(indexable=false){return `EXISTS(
 SELECT 1 FROM (
  SELECT content_id,comment_id,media_id FROM content_media
  UNION ALL SELECT content_id,comment_id,cover_media_id AS media_id FROM content_links WHERE cover_media_id IS NOT NULL
 ) l
 LEFT JOIN comments a ON a.id=l.comment_id
 JOIN contents c ON c.id=COALESCE(l.content_id,a.content_id) AND c.status='published' AND c.type IN ('post','article')
 JOIN "user" owner ON owner.id=c.author_id AND NOT COALESCE(owner.banned,false)
 LEFT JOIN "user" au ON au.id=a.author_id
 LEFT JOIN comments root ON root.id=a.root_id LEFT JOIN "user" ru ON ru.id=root.author_id
 WHERE l.media_id=m.id AND (l.comment_id IS NULL OR (${visibleComment}))
 ${indexable?"AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='content' AND d.local_id=c.id::text)":''}
)`;}

/** Re-evaluate visibility on every request; random storage keys never grant access on their own. */
export async function readPublicMediaFile(key:string,thumbnail:boolean|string){
 return (await getPool().query(`SELECT ${thumbnail?"v":"m"}.storage_provider,${thumbnail?"v":"m"}.storage_namespace,${thumbnail?"v":"m"}.storage_key,${thumbnail?"v":"m"}.mime_type,${thumbnail?"v":"m"}.byte_size::text,
 ${publicAttachmentReference(true)} AS indexable
 FROM media_assets m ${thumbnail?"JOIN media_variants v ON v.media_id=m.id AND v.variant_key=$2 AND v.status='ready'":""}
 WHERE m.storage_provider='local' AND m.storage_namespace='images-v1' AND m.storage_key=$1 AND m.status='ready' AND (m.mime_type IN ('image/webp','video/mp4','video/webm') OR (m.mime_type='image/svg+xml' AND EXISTS(SELECT 1 FROM badges b WHERE b.icon_media_id=m.id AND b.enabled)))
 AND (${publicAttachmentReference()}
 OR EXISTS(SELECT 1 FROM "user" u WHERE u.image LIKE '/api/site-media/%' AND u.image='/api/site-media/'||m.storage_key AND NOT COALESCE(u.banned,false))
 OR EXISTS(SELECT 1 FROM content_categories g WHERE g.icon_media_id=m.id)
 OR EXISTS(SELECT 1 FROM badges b WHERE b.icon_media_id=m.id AND b.enabled))`,[key,...(thumbnail?[thumbnail===true?"thumbnail":thumbnail]:[])])).rows[0] as {storage_provider:string;storage_namespace:string;storage_key:string;mime_type:string;byte_size:string;indexable:boolean}|undefined;
}
