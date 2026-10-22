import "server-only";
import type {PoolClient} from "pg";
import {getPool} from "./index";
import {ADMIN_PERMISSIONS_LOCK} from "./advisory-locks";

export type BadgeActor={kind:"system"|"admin";id:string};
export type BadgeDefinition={key:string;name:string;description:string;enabled:boolean;revision:number;createdAt:string;updatedAt:string;iconMediaId:string|null};
export type UserBadgeState={userId:string;badgeKey:string;active:boolean;revision:number;awardedAt:string;revokedAt:string|null};
type DefinitionRow={key:string;name:string;description:string;enabled:boolean;revision:number;created_at:Date;updated_at:Date;icon_media_id:string|null};
type StateRow={user_id:string;badge_key:string;active:boolean;revision:number;awarded_at:Date;revoked_at:Date|null};
type DefinitionInput={key:string;name:string;description:string;enabled:boolean;reason:string;revision?:number;iconMediaId?:string|null};
type MutationInput={userId:string;badgeKey:string;idempotencyKey:string;sourceType:string;sourceId:string;reason:string}
  & ({operation:"grant"}|{operation:"revoke";revision:number});
export class BadgeStoreError extends Error{
  constructor(public code:"forbidden"|"missing"|"user_missing"|"disabled"|"exists"|"conflict"|"idempotency_conflict"|"award_missing"|"invalid_icon"){super(code);}
}
const definitionColumns="key,name,description,enabled,revision,created_at,updated_at,icon_media_id::text";
const stateColumns="user_id,badge_key,active,revision,awarded_at,revoked_at";
const definition=(row:DefinitionRow):BadgeDefinition=>({
  key:row.key,name:row.name,description:row.description,enabled:row.enabled,revision:row.revision,
  createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),iconMediaId:row.icon_media_id,
});
const state=(row:StateRow):UserBadgeState=>({
  userId:row.user_id,badgeKey:row.badge_key,active:row.active,revision:row.revision,
  awardedAt:row.awarded_at.toISOString(),revokedAt:row.revoked_at?.toISOString()??null,
});

/** Permission gate precedes user and badge locks, matching existing admin services. */
async function authorized<T>(actor:BadgeActor,work:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await getPool().connect();
  try{
    await client.query("BEGIN");
    if(actor.kind==="admin"){
      await client.query("SELECT pg_advisory_xact_lock_shared($1)",[ADMIN_PERMISSIONS_LOCK]);
      const user=await client.query(`SELECT 1 FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false)
        AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),','))`,[actor.id]);
      if(!user.rowCount)throw new BadgeStoreError("forbidden");
    }
    const result=await work(client);
    await client.query("COMMIT");
    return result;
  }catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
}

export async function writeBadgeDefinition(actor:BadgeActor,input:DefinitionInput){
  if(actor.kind!=="admin")throw new BadgeStoreError("forbidden");
  return authorized(actor,async client=>{
    if(input.iconMediaId){
      const asset=await client.query("SELECT 1 FROM media_assets WHERE id=$1 AND status='ready' AND kind='image' AND mime_type IN ('image/webp','image/svg+xml') AND storage_provider='local' AND storage_namespace='images-v1' FOR SHARE",[input.iconMediaId]);
      if(!asset.rowCount)throw new BadgeStoreError("invalid_icon");
    }
    let before:BadgeDefinition|null=null,row:DefinitionRow;
    if(input.revision===undefined){
      const inserted=await client.query(`INSERT INTO badges(key,name,description,enabled,icon_media_id) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(key) DO NOTHING RETURNING ${definitionColumns}`,[input.key,input.name,input.description,input.enabled,input.iconMediaId??null]);
      if(!inserted.rowCount)throw new BadgeStoreError("exists");
      row=inserted.rows[0];
    }else{
      const current=(await client.query(`SELECT ${definitionColumns} FROM badges WHERE key=$1 FOR UPDATE`,[input.key])).rows[0] as DefinitionRow|undefined;
      if(!current)throw new BadgeStoreError("missing");
      if(current.revision!==input.revision||current.revision===2147483647)throw new BadgeStoreError("conflict");
      before=definition(current);
      row=(await client.query(`UPDATE badges SET name=$2,description=$3,enabled=$4,revision=revision+1,updated_at=clock_timestamp(),icon_media_id=$5
        WHERE key=$1 RETURNING ${definitionColumns}`,[input.key,input.name,input.description,input.enabled,input.iconMediaId===undefined?current.icon_media_id:input.iconMediaId])).rows[0];
    }
    const after=definition(row);
    await client.query(`INSERT INTO badge_audit(badge_key,operation,actor_kind,actor_id,reason,request,before_value,after_value,changed)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,true)`,
      [input.key,before?"update":"create",actor.kind,actor.id,input.reason,JSON.stringify(input),before?JSON.stringify(before):null,JSON.stringify(after)]);
    return after;
  });
}

export async function writeUserBadge(actor:BadgeActor,input:MutationInput){
  return authorized(actor,async client=>{
    // Serializes even the first award and idempotency keys shared across badge types.
    const owner=await client.query('SELECT 1 FROM "user" WHERE id=$1 FOR NO KEY UPDATE',[input.userId]);
    if(!owner.rowCount)throw new BadgeStoreError("user_missing");
    const request=JSON.stringify({actor,...input});
    const previous=(await client.query(`SELECT id::text,after_value,changed,request=$3::jsonb AS matches
      FROM badge_audit WHERE user_id=$1 AND idempotency_key=$2`,[input.userId,input.idempotencyKey,request])).rows[0] as
      {id:string;after_value:UserBadgeState;changed:boolean;matches:boolean}|undefined;
    if(previous){
      if(!previous.matches)throw new BadgeStoreError("idempotency_conflict");
      return {state:previous.after_value,auditId:previous.id,changed:previous.changed,replayed:true};
    }
    const badge=(await client.query("SELECT enabled FROM badges WHERE key=$1 FOR SHARE",[input.badgeKey])).rows[0];
    if(!badge)throw new BadgeStoreError("missing");
    const current=(await client.query(`SELECT ${stateColumns} FROM user_badges WHERE user_id=$1 AND badge_key=$2 FOR UPDATE`,
      [input.userId,input.badgeKey])).rows[0] as StateRow|undefined;
    if(input.operation==="grant"&&!badge.enabled)throw new BadgeStoreError("disabled");
    if(input.operation==="revoke"){
      if(!current)throw new BadgeStoreError("award_missing");
      if(current.revision!==input.revision)throw new BadgeStoreError("conflict");
    }
    const active=input.operation==="grant",changed=!current||current.active!==active;
    if(changed&&current?.revision===2147483647)throw new BadgeStoreError("conflict");
    let next=current;
    if(changed){
      next=(await client.query(`INSERT INTO user_badges(user_id,badge_key,active,awarded_at)
        VALUES($1,$2,true,clock_timestamp())
        ON CONFLICT(user_id,badge_key) DO UPDATE SET active=$3,revision=user_badges.revision+1,
          awarded_at=CASE WHEN $3 THEN clock_timestamp() ELSE user_badges.awarded_at END,
          revoked_at=CASE WHEN $3 THEN NULL ELSE clock_timestamp() END
        RETURNING ${stateColumns}`,[input.userId,input.badgeKey,active])).rows[0] as StateRow;
    }
    const after=state(next!);
    const audit=await client.query(`INSERT INTO badge_audit
      (badge_key,user_id,operation,actor_kind,actor_id,reason,idempotency_key,request,before_value,after_value,changed)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11) RETURNING id::text`,
      [input.badgeKey,input.userId,input.operation,actor.kind,actor.id,input.reason,input.idempotencyKey,request,
        current?JSON.stringify(state(current)):null,JSON.stringify(after),changed]);
    return {state:after,auditId:audit.rows[0].id as string,changed,replayed:false};
  });
}

export async function readBadgeDefinitions(actor:BadgeActor,before?:string){
  return authorized(actor,async client=>(await client.query(`SELECT ${definitionColumns} FROM badges
    WHERE ($1::text IS NULL OR key>$1) ORDER BY key LIMIT 31`,[before??null])).rows.map(row=>definition(row)));
}
export async function readBadgeDefinition(actor:BadgeActor,key:string){
  return authorized(actor,async client=>{
    const row=(await client.query(`SELECT ${definitionColumns} FROM badges WHERE key=$1`,[key])).rows[0] as DefinitionRow|undefined;
    if(!row)throw new BadgeStoreError("missing");
    return definition(row);
  });
}
export async function readBadgeOptions(actor:BadgeActor,userId:string,before?:string,key?:string){
  return authorized(actor,async client=>{
    return (await client.query(`SELECT b.key,b.name,b.enabled,b.icon_media_id::text,
      EXISTS(SELECT 1 FROM user_badges u WHERE u.user_id=$1 AND u.badge_key=b.key AND u.active) AS owned
      FROM badges b WHERE ($2::text IS NULL OR b.key>$2) AND ($3::text IS NULL OR b.key=$3) ORDER BY b.key LIMIT 31`,[userId,before??null,key??null])).rows as
      {key:string;name:string;enabled:boolean;icon_media_id:string|null;owned:boolean}[];
  });
}
export async function readBadgeRecipients(actor:BadgeActor,key:string,before?:string){
  return authorized(actor,async client=>{
    const rows=await client.query(`SELECT u.user_id,u.badge_key,u.active,u.revision,u.awarded_at,u.revoked_at,
      left(p.name,100) AS name,p.email,a.actor_kind
      FROM user_badges u JOIN "user" p ON p.id=u.user_id
      LEFT JOIN LATERAL (SELECT actor_kind FROM badge_audit WHERE user_id=u.user_id AND badge_key=u.badge_key
        AND operation='grant' AND changed ORDER BY id DESC LIMIT 1) a ON true
      WHERE u.badge_key=$1 AND u.active AND ($2::text IS NULL OR u.user_id>$2)
      ORDER BY u.user_id LIMIT 31`,[key,before??null]);
    return rows.rows.map(row=>({...state(row),name:row.name as string,email:row.email as string,actorKind:row.actor_kind as BadgeActor["kind"]}));
  });
}
export async function readUserBadgeDetails(actor:BadgeActor,userId:string,before?:string){
  return authorized(actor,async client=>{
    const rows=await client.query(`SELECT u.user_id,u.badge_key,u.active,u.revision,u.awarded_at,u.revoked_at,
      b.name,b.icon_media_id::text,a.actor_kind
      FROM user_badges u JOIN badges b ON b.key=u.badge_key
      LEFT JOIN LATERAL (SELECT actor_kind FROM badge_audit WHERE user_id=u.user_id AND badge_key=u.badge_key
        AND operation='grant' AND changed ORDER BY id DESC LIMIT 1) a ON true
      WHERE u.user_id=$1 AND ($2::text IS NULL OR u.badge_key>$2) ORDER BY u.badge_key LIMIT 31`,[userId,before??null]);
    return rows.rows.map(row=>({...state(row),name:row.name as string,iconMediaId:row.icon_media_id as string|null,actorKind:row.actor_kind as BadgeActor["kind"]}));
  });
}
export async function readUserBadges(userId:string,before?:string){
  const rows=await getPool().query(`SELECT b.key,b.name,b.description,u.revision,u.awarded_at
    FROM user_badges u JOIN badges b ON b.key=u.badge_key
    WHERE u.user_id=$1 AND u.active AND ($2::text IS NULL OR u.badge_key>$2) ORDER BY u.badge_key LIMIT 31`,
    [userId,before??null]);
  return rows.rows.map(row=>({key:row.key as string,name:row.name as string,description:row.description as string,
    revision:row.revision as number,awardedAt:(row.awarded_at as Date).toISOString()}));
}
export async function readManagedUserBadges(actor:BadgeActor,userId:string,before?:string){
  return authorized(actor,async client=>(await client.query(`SELECT ${stateColumns} FROM user_badges
    WHERE user_id=$1 AND ($2::text IS NULL OR badge_key>$2) ORDER BY badge_key LIMIT 31`,
    [userId,before??null])).rows.map(row=>state(row)));
}
export async function readBadgeAudit(actor:BadgeActor,badgeKey:string|null,before?:string,userId?:string){
  return authorized(actor,async client=>{
    const rows=await client.query(`SELECT a.id::text,a.badge_key,a.user_id,a.operation,a.actor_kind,a.actor_id,a.reason,
      a.idempotency_key,a.request,a.before_value,a.after_value,a.changed,a.created_at,
      left(actor.name,100) AS actor_name,left(target.name,100) AS user_name,b.name AS badge_name
      FROM badge_audit a JOIN badges b ON b.key=a.badge_key
      LEFT JOIN "user" actor ON a.actor_kind='admin' AND actor.id=a.actor_id
      LEFT JOIN "user" target ON target.id=a.user_id
      WHERE ($1::text IS NULL OR a.badge_key=$1) AND ($2::bigint IS NULL OR a.id<$2::bigint)
      AND ($3::text IS NULL OR a.user_id=$3)
      ORDER BY a.id DESC LIMIT 31`,[badgeKey,before??null,userId??null]);
    return rows.rows.map(row=>({
      id:row.id as string,badgeKey:row.badge_key as string,userId:row.user_id as string|null,
      actorName:row.actor_name as string|null,userName:row.user_name as string|null,badgeName:row.badge_name as string,
      operation:row.operation as "create"|"update"|"grant"|"revoke",
      actor:{kind:row.actor_kind as BadgeActor["kind"],id:row.actor_id as string},
      reason:row.reason as string,idempotencyKey:row.idempotency_key as string|null,
      request:row.request as Record<string,unknown>,
      before:row.before_value as BadgeDefinition|UserBadgeState|null,
      after:row.after_value as BadgeDefinition|UserBadgeState,changed:row.changed as boolean,
      createdAt:(row.created_at as Date).toISOString(),
    }));
  });
}
