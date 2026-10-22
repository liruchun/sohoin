import "server-only";
import {getPool} from "./index";
import {ADMIN_PERMISSIONS_LOCK} from "./advisory-locks";
type Direction="following"|"followers";
export class FollowStoreError extends Error{constructor(public code:"forbidden"|"missing"|"self"){super(code);}}
export async function writeFollow(actor:string,target:string,active:boolean){
 if(actor===target)throw new FollowStoreError("self");
 const client=await getPool().connect();try{await client.query("BEGIN");
  // Share the permission gate before user locks, matching admin ban/role writes.
  // Other follow writers can proceed concurrently; permission changes wait.
  await client.query("SELECT pg_advisory_xact_lock_shared($1)",[ADMIN_PERMISSIONS_LOCK]);
  const ids=active?[actor,target]:[actor];
  const users=(await client.query('SELECT id,COALESCE(banned,false) AS banned FROM "user" WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',[ids])).rows as {id:string;banned:boolean}[];
  const user=users.find(row=>row.id===actor);if(!user||user.banned)throw new FollowStoreError("forbidden");
  if(active){const other=users.find(row=>row.id===target);if(!other||other.banned)throw new FollowStoreError("missing");await client.query("INSERT INTO user_follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT(follower_id,following_id) DO NOTHING",[actor,target]);}
  else await client.query("DELETE FROM user_follows WHERE follower_id=$1 AND following_id=$2",[actor,target]);
  await client.query("COMMIT");return {active};
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
export type FollowStateRow={id:string;following:boolean;follows_me:boolean};
export async function readFollowStates(actor:string,ids:string[]){return (await getPool().query(`SELECT u.id,(f.following_id IS NOT NULL) AS following,(r.follower_id IS NOT NULL) AS follows_me FROM "user" u LEFT JOIN user_follows f ON f.follower_id=$1 AND f.following_id=u.id LEFT JOIN user_follows r ON r.following_id=$1 AND r.follower_id=u.id WHERE u.id=ANY($2::text[]) AND NOT COALESCE(u.banned,false) ORDER BY u.id`,[actor,ids])).rows as FollowStateRow[];}
export type FollowListRow=FollowStateRow&{name:string;relationship_id:string;created_at:Date};
export async function readOwnFollows(actor:string,direction:Direction,before?:string){
 if(direction!=="following"&&direction!=="followers")throw new Error("Invalid follow direction");
 // Column identifiers come only from the direction allowlist above.
 const owner=direction==="following"?"follower_id":"following_id",other=direction==="following"?"following_id":"follower_id";
 return (await getPool().query(`SELECT u.id,left(u.name,100) AS name,f.id::text AS relationship_id,f.created_at,${direction==="following"?"true AS following,(r.follower_id IS NOT NULL) AS follows_me":"(r.following_id IS NOT NULL) AS following,true AS follows_me"} FROM user_follows f JOIN "user" u ON u.id=f.${other} LEFT JOIN user_follows r ON r.follower_id=f.following_id AND r.following_id=f.follower_id WHERE f.${owner}=$1 AND ($2::bigint IS NULL OR f.id<$2::bigint) AND NOT COALESCE(u.banned,false) ORDER BY f.id DESC LIMIT 31`,[actor,before??null])).rows as FollowListRow[];
}
