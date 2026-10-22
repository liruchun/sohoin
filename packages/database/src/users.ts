import "server-only";
import {getPool} from "./index";
import {ADMIN_PERMISSIONS_LOCK} from "./advisory-locks";

export type UserRecord={id:string;name:string;email:string;emailVerified:boolean;role:string|null;banned:boolean|null;banReason:string|null;createdAt:Date;updatedAt:Date;admin_version:number};
const columns='id,name,email,"emailVerified",role,banned,"banReason","createdAt","updatedAt",admin_version';
const isAdmin=(row:UserRecord)=>row.role?.split(",").includes("admin")??false;

/** Prefix search, at most 31 rows, stable primary-key cursor; no COUNT or N+1. */
export async function readManagedUsers(query:{q:string;role:string;status:string;before?:string}) {
  const pattern=query.q.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%";
  const result=await getPool().query(`SELECT ${columns} FROM "user"
    WHERE ($1='' OR lower(name) LIKE $2 OR lower(email) LIKE $2)
      AND ($3='all' OR ($3='admin') = ('admin'=ANY(string_to_array(COALESCE(role,'user'),','))))
      AND ($4='all' OR ($4='banned')=COALESCE(banned,false))
      AND ($5::text IS NULL OR id < $5)
    ORDER BY id DESC LIMIT 31`,[query.q,pattern,query.role,query.status,query.before??null]);
  return result.rows as UserRecord[];
}
export async function readManagedUser(id:string) {
  const result=await getPool().query(`SELECT ${columns} FROM "user" WHERE id=$1`,[id]);
  return result.rows[0] as UserRecord|undefined;
}

export type UserMutationResult={error:"forbidden"|"missing"|"conflict"|"self"|"last_admin"}|{user:UserRecord};
export async function persistManagedUser(actorId:string,id:string,version:number,patch:{role?:"admin"|"user";banned?:boolean;banReason?:string}):Promise<UserMutationResult> {
  const client=await getPool().connect();
  try {
    await client.query("BEGIN");
    // All admin role/status changes serialize, protecting the last-admin invariant.
    await client.query("SELECT pg_advisory_xact_lock($1)",[ADMIN_PERMISSIONS_LOCK]);
    const actor=(await client.query(`SELECT ${columns} FROM "user" WHERE id=$1 FOR UPDATE`,[actorId])).rows[0] as UserRecord|undefined;
    let error:Extract<UserMutationResult,{error:string}>["error"]|undefined;
    if(!actor||actor.banned||!isAdmin(actor))error="forbidden";
    const current=(await client.query(`SELECT ${columns} FROM "user" WHERE id=$1 FOR UPDATE`,[id])).rows[0] as UserRecord|undefined;
    if(!error&&!current)error="missing";
    if(!error&&current!.admin_version!==version)error="conflict";
    const nextRole=patch.role??(current&&isAdmin(current)?"admin":"user");
    const nextBanned=patch.banned??current?.banned??false;
    if(!error&&actorId===id&&(nextBanned||nextRole!=="admin"))error="self";
    if(!error&&isAdmin(current!)&&!current!.banned&&(nextBanned||nextRole!=="admin")) {
      const other=await client.query(`SELECT 1 FROM "user" WHERE id<>$1 AND NOT COALESCE(banned,false) AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) LIMIT 1`,[id]);
      if(!other.rowCount)error="last_admin";
    }
    if(error){await client.query("ROLLBACK");return {error};}
    const result=await client.query(`UPDATE "user" SET role=$2,banned=$3,"banReason"=$4,"banExpires"=NULL,"updatedAt"=NOW(),admin_version=admin_version+1 WHERE id=$1 RETURNING ${columns}`,
      [id,nextRole,nextBanned,nextBanned?(patch.banReason??current!.banReason):null]);
    // Revoke on any role/status update, including promotion and re-enabling.
    await client.query('DELETE FROM "session" WHERE "userId"=$1',[id]);
    const before={role:current!.role,banned:current!.banned??false,banReason:current!.banReason};
    const after={role:nextRole,banned:nextBanned,banReason:result.rows[0].banReason};
    await client.query("INSERT INTO user_admin_audit(actor_id,target_id,before_value,after_value) VALUES($1,$2,$3::jsonb,$4::jsonb)",[actorId,id,JSON.stringify(before),JSON.stringify(after)]);
    await client.query("COMMIT");return {user:result.rows[0] as UserRecord};
  } catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
