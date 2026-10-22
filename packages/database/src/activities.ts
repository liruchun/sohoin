import "server-only";
import {getPool} from "./index";
export type ActivityRow={id:string;kind:"content_published"|"comment_created"|"content_reacted"|"comment_reacted";actor_id:string;actor_name:string;content_id:string;content_type:string;content_title:string;content_excerpt:string;comment_id:string|null;comment_excerpt:string|null;reply_to_id:string|null;reaction_code:string|null;reaction_label:string|null;reaction_emoji:string|null;created_at:Date};
// Visibility is evaluated before LIMIT, so hidden activity cannot consume a page
// or cause an early end while older visible activity still exists.
export async function readFollowingActivities(viewer:string,before?:string){
 return (await getPool().query(`SELECT a.id::text,a.kind,a.actor_id,left(u.name,100) AS actor_name,p.id::text AS content_id,p.type AS content_type,p.title AS content_title,left(p.feed_text,280) AS content_excerpt,c.id::text AS comment_id,left(c.body,120) AS comment_excerpt,c.reply_to_id::text,rt.code AS reaction_code,rt.label AS reaction_label,rt.emoji AS reaction_emoji,a.created_at
 FROM user_activities a JOIN user_follows f ON f.follower_id=$1 AND f.following_id=a.actor_id
 JOIN "user" u ON u.id=a.actor_id AND NOT COALESCE(u.banned,false)
 JOIN contents p ON p.id=a.content_id AND p.status='published'
 LEFT JOIN comments c ON c.id=a.comment_id AND c.content_id=p.id
 LEFT JOIN comments root ON root.id=c.root_id
 LEFT JOIN LATERAL (SELECT user_id,code FROM content_reactions WHERE content_id=a.content_id AND user_id=a.actor_id ORDER BY updated_at DESC,code LIMIT 1) cr ON a.kind='content_reacted'
 LEFT JOIN LATERAL (SELECT user_id,code FROM comment_reactions WHERE comment_id=a.comment_id AND user_id=a.actor_id ORDER BY updated_at DESC,code LIMIT 1) mr ON a.kind='comment_reacted'
 LEFT JOIN reaction_types rt ON rt.code=COALESCE(cr.code,mr.code)
 WHERE a.active AND ($2::bigint IS NULL OR a.id<$2::bigint)
 AND (a.comment_id IS NULL OR (c.status='visible' AND NOT c.thread_hidden AND NOT COALESCE(root.thread_hidden,false)))
 AND CASE a.kind WHEN 'content_published' THEN p.author_id=a.actor_id WHEN 'comment_created' THEN c.author_id=a.actor_id WHEN 'content_reacted' THEN cr.user_id IS NOT NULL WHEN 'comment_reacted' THEN mr.user_id IS NOT NULL ELSE false END
 ORDER BY a.id DESC LIMIT 31`,[viewer,before??null])).rows as ActivityRow[];
}
