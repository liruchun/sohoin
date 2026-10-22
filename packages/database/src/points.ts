import "server-only";
import type {PoolClient} from "pg";
import {getPool} from "./index";
import {ADMIN_PERMISSIONS_LOCK} from "./advisory-locks";

// Storage contracts remain independent of Core and extension-api.
export type PointsActor={kind:"system"|"admin";id:string};
export type PointsWrite={
  accountId:string;idempotencyKey:string;sourceType:string;sourceId:string;reason:string;
} & ({kind:"credit"|"debit";amount:number}|{kind:"reverse";entryId:string});
export type PointsRow={
  id:string;account_id:string;kind:"credit"|"debit"|"reverse";amount:string;balance_after:string;
  idempotency_key:string;source_type:string;source_id:string;reason:string;
  actor_kind:"system"|"admin";actor_id:string;reversal_of:string|null;created_at:Date;
};
export class PointsStoreError extends Error {
  constructor(public code:"forbidden"|"missing"|"entry_missing"|"insufficient"|"overflow"|"conflict"|"already_reversed"|"invalid_reversal"){
    super(code);
  }
}
const columns="id::text,account_id,kind,amount::text,balance_after::text,idempotency_key,source_type,source_id,reason,actor_kind,actor_id,reversal_of::text,created_at";
export type PointsClient=PoolClient;

/** The callback owns one connection; all business SQL must use this client. */
export async function runPointsTransaction<T>(work:(client:PointsClient)=>Promise<T>):Promise<T>{
  const client=await getPool().connect();
  try{
    await client.query("BEGIN");
    const result=await work(client);
    await client.query("COMMIT");
    return result;
  }catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
}

export async function checkPointsActor(client:PointsClient,actor:PointsActor){
  if(actor.kind==="system")return;
  // Take this before user/account locks, as existing admin mutations do.
  await client.query("SELECT pg_advisory_xact_lock_shared($1)",[ADMIN_PERMISSIONS_LOCK]);
  const user=await client.query(`SELECT 1 FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false)
    AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) FOR SHARE`,[actor.id]);
  if(!user.rowCount)throw new PointsStoreError("forbidden");
}

/** Call within runPointsTransaction, serially, after checking the actor. */
export async function writePoints(client:PointsClient,actor:PointsActor,input:PointsWrite):Promise<{entry:PointsRow;replayed:boolean}>{
  // A caught operation failure must not leave a balance change in the outer transaction.
  await client.query("SAVEPOINT points_write");
  try{
    const owner=await client.query('SELECT 1 FROM "user" WHERE id=$1 FOR KEY SHARE',[input.accountId]);
    if(!owner.rowCount)throw new PointsStoreError("missing");
    await client.query("INSERT INTO points_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING",[input.accountId]);
    const account=await client.query("SELECT balance::text FROM points_accounts WHERE user_id=$1 FOR UPDATE",[input.accountId]);
    const existing=(await client.query(`SELECT ${columns} FROM points_entries WHERE account_id=$1 AND idempotency_key=$2`,[input.accountId,input.idempotencyKey])).rows[0] as PointsRow|undefined;
    if(existing){
      const matches=existing.kind===input.kind&&existing.source_type===input.sourceType&&existing.source_id===input.sourceId
        &&existing.reason===input.reason&&existing.actor_kind===actor.kind&&existing.actor_id===actor.id
        &&(input.kind==="reverse"?existing.reversal_of===input.entryId:
          BigInt(existing.amount)===BigInt(input.amount)*(input.kind==="credit"?1n:-1n));
      if(!matches)throw new PointsStoreError("conflict");
      await client.query("RELEASE SAVEPOINT points_write");
      return {entry:existing,replayed:true};
    }
    let amount:bigint;
    if(input.kind==="reverse"){
      const original=(await client.query(`SELECT ${columns} FROM points_entries WHERE account_id=$1 AND id=$2`,[input.accountId,input.entryId])).rows[0] as PointsRow|undefined;
      if(!original)throw new PointsStoreError("entry_missing");
      if(original.kind==="reverse")throw new PointsStoreError("invalid_reversal");
      if((await client.query("SELECT 1 FROM points_entries WHERE reversal_of=$1",[input.entryId])).rowCount)throw new PointsStoreError("already_reversed");
      amount=-BigInt(original.amount);
    }else amount=BigInt(input.amount)*(input.kind==="credit"?1n:-1n);
    const balance=BigInt(account.rows[0].balance)+amount;
    if(balance<0n)throw new PointsStoreError("insufficient");
    if(balance>9007199254740991n)throw new PointsStoreError("overflow");
    await client.query("UPDATE points_accounts SET balance=$2,updated_at=clock_timestamp() WHERE user_id=$1",[input.accountId,balance.toString()]);
    const entry=(await client.query(`INSERT INTO points_entries
      (account_id,kind,amount,balance_after,idempotency_key,source_type,source_id,reason,actor_kind,actor_id,reversal_of)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${columns}`,
      [input.accountId,input.kind,amount.toString(),balance.toString(),input.idempotencyKey,input.sourceType,input.sourceId,input.reason,actor.kind,actor.id,input.kind==="reverse"?input.entryId:null])).rows[0] as PointsRow;
    await client.query("RELEASE SAVEPOINT points_write");
    return {entry,replayed:false};
  }catch(error){
    await client.query("ROLLBACK TO SAVEPOINT points_write");
    await client.query("RELEASE SAVEPOINT points_write");
    throw error;
  }
}

export async function readPointsBalance(accountId:string,client:Pick<PointsClient,"query">=getPool()){
  const result=await client.query(`SELECT COALESCE(a.balance,0)::text AS balance FROM "user" u
    LEFT JOIN points_accounts a ON a.user_id=u.id WHERE u.id=$1`,[accountId]);
  if(!result.rowCount)throw new PointsStoreError("missing");
  return Number(result.rows[0].balance);
}
export async function readPointsEntries(accountId:string,before?:string,client:Pick<PointsClient,"query">=getPool()){
  return (await client.query(`SELECT ${columns} FROM points_entries
    WHERE account_id=$1 AND ($2::bigint IS NULL OR id<$2::bigint) ORDER BY points_entries.id DESC LIMIT 31`,
    [accountId,before??null])).rows as PointsRow[];
}
