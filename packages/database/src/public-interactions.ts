import "server-only";
import {getPool} from "./index";

/** Bounded public IDs only; keep the numeric IDs inside server services. */
export async function readSiteInteractionTargets(tokens:string[]){
 if(tokens.length>20)throw new Error("Public interaction batch exceeded");
 return (await getPool().query(`SELECT c.id::text,r.short_id AS token FROM public_route_ids r JOIN contents c ON c.id=r.content_id JOIN "user" u ON u.id=c.author_id WHERE r.kind='content' AND r.short_id=ANY($1::text[]) AND c.status='published' AND c.type IN ('post','article') AND NOT COALESCE(u.banned,false)`,[tokens])).rows as {id:string;token:string}[];
}

export async function readSiteCommentTarget(token:string,id:string){
 return (await getPool().query(`SELECT c.id::text FROM public_route_ids r JOIN comments c ON c.content_id=r.content_id
 WHERE r.kind='content' AND r.short_id=$1 AND c.id=$2`,[token,id])).rows[0] as {id:string}|undefined;
}
