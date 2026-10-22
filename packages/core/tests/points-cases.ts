import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {randomBytes} from "node:crypto";
import {getPool} from "@sohoin/database";
import {
  createSystemPointsService,createAdminPointsService,getOwnPointsBalance,listOwnPointsEntries,
} from "../src/server/points";
import {ServiceError} from "../src/server/security";

const code=(expected:string)=>(error:unknown)=>error instanceof ServiceError&&error.code===expected;
export async function pointsCases(t:TestContext,adminToken:string,userToken:string,adminId:string,userId:string){
  const pool=getPool(),points=createSystemPointsService("points-tests");
  const suffix=randomBytes(6).toString("hex");
  const ids=Array.from({length:7},(_,i)=>`points-${suffix}-${i}`);
  await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role)
    SELECT id,'Points fixture',id||'@example.test',false,'user' FROM unnest($1::text[]) id`,[ids]);
  const mutation=(accountId:string,key:string,amount=10)=>({
    accountId,amount,idempotencyKey:key,sourceType:"test",sourceId:key,reason:"测试记账",
  });
  const reversal=(accountId:string,entryId:string,key:string)=>({
    accountId,entryId,idempotencyKey:key,sourceType:"test",sourceId:key,reason:"测试冲正",
  });
  const adminHeaders=new Headers({authorization:"Bearer "+adminToken});
  const userHeaders=new Headers({authorization:"Bearer "+userToken});

  await t.test("points reads are private and admin actors come from authenticated sessions",async()=>{
    await assert.rejects(()=>getOwnPointsBalance(new Headers()),code("UNAUTHENTICATED"));
    await assert.rejects(()=>listOwnPointsEntries(new Headers()),code("UNAUTHENTICATED"));
    await assert.rejects(()=>createAdminPointsService(userHeaders).credit(mutation(userId,"denied")),code("FORBIDDEN"));
    await assert.rejects(()=>listOwnPointsEntries(userHeaders,{accountId:adminId}),code("INVALID_POINTS_INPUT"));
    const result=await createAdminPointsService(adminHeaders).credit(mutation(userId,"admin-credit"));
    assert.deepEqual(result.entry.actor,{kind:"admin",id:adminId});
    assert.equal((await getOwnPointsBalance(userHeaders)).balance,10);
    const own=await listOwnPointsEntries(userHeaders);
    assert.equal(own.items.length,1);
    assert.ok(!("actor" in own.items[0]));
    assert.ok(!("sourceId" in own.items[0]));
    assert.ok(!("idempotencyKey" in own.items[0]));
  });
  await t.test("points reject unsafe values and caller-supplied actors before writing",async()=>{
    for(const amount of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
      await assert.rejects(()=>points.credit(mutation(ids[0],"bad",amount)),code("INVALID_POINTS_INPUT"));
    }
    for(const extra of [{actor:{kind:"admin",id:adminId}},{reason:" "},{sourceId:"x\0y"},{idempotencyKey:"x".repeat(201)}]){
      await assert.rejects(()=>points.credit({...mutation(ids[0],"bad"),...extra}),code("INVALID_POINTS_INPUT"));
    }
    for(const before of ["9223372036854775808","abc","0","-1","1.5"]){
      await assert.rejects(()=>points.listEntries(ids[0],{before}),code("INVALID_POINTS_INPUT"));
    }
    await assert.rejects(()=>points.credit(mutation("missing-points-user","missing")),code("POINTS_ACCOUNT_NOT_FOUND"));
    assert.equal((await points.getBalance(ids[0])).balance,0);
    assert.equal((await pool.query("SELECT 1 FROM points_accounts WHERE user_id=$1",[ids[0]])).rowCount,0);
  });
  await t.test("concurrent retries write once, while changed payloads conflict",async()=>{
    const input=mutation(ids[0],"once",100);
    const results=await Promise.all(Array.from({length:12},()=>points.credit(input)));
    assert.equal(results.filter(result=>!result.replayed).length,1);
    assert.equal(new Set(results.map(result=>result.entry.id)).size,1);
    assert.equal((await points.getBalance(ids[0])).balance,100);
    for(const patch of [{amount:99},{reason:"different"},{sourceId:"different"},{sourceType:"other"}]){
      await assert.rejects(()=>points.credit({...input,...patch}),code("POINTS_IDEMPOTENCY_CONFLICT"));
    }
    await assert.rejects(()=>points.debit(input),code("POINTS_IDEMPOTENCY_CONFLICT"));
    await assert.rejects(()=>createSystemPointsService("other").credit(input),code("POINTS_IDEMPOTENCY_CONFLICT"));
    const other=await points.credit({...input,accountId:ids[1]});
    assert.equal(other.replayed,false);
  });
  await t.test("concurrent deductions cannot overdraw and replays return the original result",async()=>{
    const results=await Promise.allSettled(Array.from({length:8},(_,i)=>points.debit(mutation(ids[0],"spend-"+i,30))));
    assert.equal(results.filter(result=>result.status==="fulfilled").length,3);
    for(const result of results)if(result.status==="rejected")assert.ok(code("POINTS_INSUFFICIENT")(result.reason));
    assert.equal((await points.getBalance(ids[0])).balance,10);
    const replay=await points.credit(mutation(ids[0],"once",100));
    assert.equal(replay.entry.balanceAfter,100);
    assert.equal(replay.replayed,true);
  });
  await t.test("reversals are full, linked, unique and cannot create a negative balance",async()=>{
    const original=await points.credit(mutation(ids[2],"grant",50));
    const input=reversal(ids[2],original.entry.id,"undo");
    const results=await Promise.all([points.reverse(input),points.reverse(input)]);
    assert.equal(results[0].entry.id,results[1].entry.id);
    assert.equal(results[0].entry.amount,-50);
    assert.equal((await points.getBalance(ids[2])).balance,0);
    await assert.rejects(()=>points.reverse({...input,idempotencyKey:"another"}),code("POINTS_ALREADY_REVERSED"));
    await assert.rejects(()=>points.reverse(reversal(ids[2],results[0].entry.id,"undo-undo")),code("POINTS_INVALID_REVERSAL"));
    await assert.rejects(()=>points.reverse(reversal(ids[3],original.entry.id,"wrong-owner")),code("POINTS_ENTRY_NOT_FOUND"));
    const grant=await points.credit(mutation(ids[2],"new",40));
    const spent=await points.debit(mutation(ids[2],"spent",30));
    await assert.rejects(()=>points.reverse(reversal(ids[2],grant.entry.id,"unavailable")),code("POINTS_INSUFFICIENT"));
    await points.reverse(reversal(ids[2],spent.entry.id,"refund"));
    await points.reverse(reversal(ids[2],grant.entry.id,"unavailable"));
    assert.equal((await points.getBalance(ids[2])).balance,0);
  });
  await t.test("business writes and points share rollback; failed operations do not leak changes",async()=>{
    let retained:{credit(input:unknown):Promise<unknown>}|undefined;
    await assert.rejects(()=>points.transaction(async({points:tx,client})=>{
      retained=tx;
      await client.query('UPDATE "user" SET name=$2 WHERE id=$1',[ids[3],"Should roll back"]);
      await tx.credit(mutation(ids[3],"rollback",20));
      throw new Error("abort");
    }),/abort/);
    assert.equal((await points.getBalance(ids[3])).balance,0);
    assert.equal((await pool.query('SELECT name FROM "user" WHERE id=$1',[ids[3]])).rows[0].name,"Points fixture");
    await assert.rejects(()=>retained!.credit(mutation(ids[3],"late")),code("POINTS_TRANSACTION_SCOPE"));
    await points.transaction(async({points:tx,client})=>{
      await assert.rejects(()=>tx.debit(mutation(ids[3],"failed",20)),code("POINTS_INSUFFICIENT"));
      await tx.credit(mutation(ids[3],"success",20));
      await client.query('UPDATE "user" SET name=$2 WHERE id=$1',[ids[3],"Committed"]);
    });
    assert.equal((await points.getBalance(ids[3])).balance,20);
    assert.equal((await points.listEntries(ids[3])).items.length,1);
    assert.equal((await pool.query('SELECT name FROM "user" WHERE id=$1',[ids[3]])).rows[0].name,"Committed");
  });
  await t.test("an insertion failure after balance update rolls the entire operation back",async()=>{
    await points.transaction(async({points:tx,client})=>{
      await client.query(`CREATE FUNCTION points_test_reject_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'test insertion failure'; END; $$`);
      await client.query(`CREATE TRIGGER points_test_reject_insert BEFORE INSERT ON points_entries
        FOR EACH ROW EXECUTE FUNCTION points_test_reject_insert()`);
      await assert.rejects(()=>tx.credit(mutation(ids[6],"insert-failure",20)),/test insertion failure/);
      assert.equal((await tx.getBalance(ids[6])).balance,0);
      assert.equal((await client.query("SELECT 1 FROM points_accounts WHERE user_id=$1",[ids[6]])).rowCount,0);
      await client.query("DROP TRIGGER points_test_reject_insert ON points_entries");
      await client.query("DROP FUNCTION points_test_reject_insert()");
      await tx.credit(mutation(ids[6],"insert-failure",20));
    });
    assert.equal((await points.getBalance(ids[6])).balance,20);
  });
  await t.test("pagination is bounded, amounts stay exact, and history is immutable",async()=>{
    for(let i=0;i<35;i++)await points.credit(mutation(ids[4],"page-"+i,1));
    const first=await points.listEntries(ids[4]),second=await points.listEntries(ids[4],{before:first.nextCursor});
    assert.equal(first.items.length,30);assert.equal(second.items.length,5);
    assert.equal(second.nextCursor,null);
    assert.equal(new Set([...first.items,...second.items].map(row=>row.id)).size,35);
    await points.credit(mutation(ids[5],"max",Number.MAX_SAFE_INTEGER));
    assert.equal((await points.getBalance(ids[5])).balance,Number.MAX_SAFE_INTEGER);
    await assert.rejects(()=>points.credit(mutation(ids[5],"overflow",1)),code("POINTS_BALANCE_LIMIT"));
    for(const sql of ["UPDATE points_entries SET reason='changed' WHERE account_id=$1","DELETE FROM points_entries WHERE account_id=$1"]){
      await assert.rejects(()=>pool.query(sql,[ids[4]]),/append-only/);
    }
    const drift=await pool.query(`SELECT a.user_id FROM points_accounts a LEFT JOIN points_entries e ON e.account_id=a.user_id
      GROUP BY a.user_id,a.balance HAVING a.balance<>COALESCE(sum(e.amount),0)`);
    assert.equal(drift.rowCount,0);
  });
  // Fixtures deliberately remain: the dedicated security database is dropped by the runner.
}
