import "server-only";
import {getPool} from "./index";

export async function readOwnSessions(userId:string,before?:string) {
  const result=await getPool().query('SELECT id,"createdAt","expiresAt","userAgent","ipAddress" FROM "session" WHERE "userId"=$1 AND "expiresAt">NOW() AND ($2::text IS NULL OR id<$2) ORDER BY id DESC LIMIT 21',[userId,before??null]);
  return result.rows as {id:string;createdAt:Date;expiresAt:Date;userAgent:string|null;ipAddress:string|null}[];
}
/** Ownership is in DELETE itself; neither a cursor nor a guessed id grants access. */
export async function revokeOwnSessions(userId:string,currentId:string,scope:"session"|"others"|"password",id?:string) {
  const client=await getPool().connect();
  try {
    await client.query("BEGIN");
    const result=scope==="session"
      ?await client.query('DELETE FROM "session" WHERE "userId"=$1 AND id=$2 AND id<>$3',[userId,id,currentId])
      :scope==="others"
        ?await client.query('DELETE FROM "session" WHERE "userId"=$1 AND id<>$2',[userId,currentId])
        :await client.query('DELETE FROM "session" WHERE "userId"=$1',[userId]);
    if(scope!=="session"||result.rowCount){
      const action=scope==="password"?"password_changed":scope==="others"?"other_sessions_revoked":"session_revoked";
      await client.query("INSERT INTO account_security_audit(actor_id,action,affected_sessions) VALUES($1,$2,$3)",[userId,action,result.rowCount??0]);
    }
    await client.query("COMMIT");return result.rowCount??0;
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function readUserAudit(before?:string) {
  const result=await getPool().query(`SELECT a.id::text,a.actor_id,a.target_id,a.created_at,u.name AS actor_name,u.email AS actor_email,t.name AS target_name,t.email AS target_email,
    ARRAY(SELECT key FROM jsonb_object_keys(a.before_value||a.after_value) AS key WHERE a.before_value->key IS DISTINCT FROM a.after_value->key) AS changed_fields
    FROM user_admin_audit a LEFT JOIN "user" u ON u.id=a.actor_id LEFT JOIN "user" t ON t.id=a.target_id
    WHERE ($1::bigint IS NULL OR a.id<$1::bigint) ORDER BY a.id DESC LIMIT 31`,[before??null]);
  return result.rows as {id:string;actor_id:string;target_id:string;created_at:Date;actor_name:string|null;actor_email:string|null;target_name:string|null;target_email:string|null;changed_fields:string[]}[];
}
export async function readAccountAudit(before?:string) {
  const result=await getPool().query(`SELECT a.id::text,a.created_at,a.action,a.affected_sessions,u.name AS actor_name,u.email AS actor_email
    FROM account_security_audit a LEFT JOIN "user" u ON u.id=a.actor_id WHERE ($1::bigint IS NULL OR a.id<$1::bigint) ORDER BY a.id DESC LIMIT 31`,[before??null]);
  return result.rows as {id:string;created_at:Date;action:"password_changed"|"session_revoked"|"other_sessions_revoked";affected_sessions:number;actor_name:string|null;actor_email:string|null}[];
}
