import 'server-only';
import {getPool} from './index';

/** Public profile fields only; never search by private email or return auth IDs. */
export async function searchMentionMembers(query:string){
 const pattern=query.replace(/[\\%_]/g,'\\$&')+'%';
 return (await getPool().query(`SELECT u.id,u.name,u.image FROM "user" u
 WHERE NOT COALESCE(u.banned,false)
 AND u.name ILIKE $1 ESCAPE '\\'
 ORDER BY lower(u.name),u.id LIMIT 8`,[pattern])).rows as {id:string;name:string;image:string|null}[];
}

export async function readMentionMembers(ids:string[]){
 return (await getPool().query(`SELECT r.short_id AS id,u.name,u.image FROM public_route_ids r
 JOIN "user" u ON u.id=r.user_id AND NOT COALESCE(u.banned,false)
 WHERE r.kind='user' AND r.short_id=ANY($1::text[]) LIMIT 20`,[ids])).rows as {id:string;name:string;image:string|null}[];
}
