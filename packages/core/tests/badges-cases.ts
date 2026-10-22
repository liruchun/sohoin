import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {randomBytes} from "node:crypto";
import {getPool,writeBadgeDefinition,BadgeStoreError} from "@sohoin/database";
import {createAdminBadgeService,createSystemBadgeService,listOwnBadges} from "../src/server/badges";
import {ServiceError} from "../src/server/security";

const code=(expected:string)=>(error:unknown)=>error instanceof ServiceError&&error.code===expected;
export async function badgeCases(t:TestContext,adminToken:string,userToken:string,adminId:string,userId:string){
  const pool=getPool(),suffix=randomBytes(6).toString("hex"),prefix="badge-"+suffix;
  const fixture=prefix+"-user";
  await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,'Badge fixture',$2,false,'user')`,[fixture,fixture+"@example.test"]);
  const userHeaders=new Headers({authorization:"Bearer "+userToken});
  const admin=createAdminBadgeService(new Headers({authorization:"Bearer "+adminToken}));
  const system=createSystemBadgeService("badge-tests");
  const definition=(key:string)=>({key,name:"贡献勋章",description:"真实贡献的记录",enabled:true,reason:"建立测试勋章"});
  const grant=(badgeKey:string,idempotencyKey:string,target=fixture)=>({
    userId:target,badgeKey,idempotencyKey,sourceType:"test",sourceId:idempotencyKey,reason:"测试授予",
  });
  const revoke=(badgeKey:string,idempotencyKey:string,revision:number,target=fixture)=>({
    ...grant(badgeKey,idempotencyKey,target),revision,reason:"测试撤销",
  });
  await t.test("badge definition management and private reads authorize and reject forged identity",async()=>{
    await assert.rejects(()=>listOwnBadges(new Headers()),code("UNAUTHENTICATED"));
    await assert.rejects(()=>createAdminBadgeService(userHeaders).createDefinition(definition(prefix)),code("FORBIDDEN"));
    await assert.rejects(()=>createAdminBadgeService(userHeaders).grant(grant(prefix,"denied")),code("FORBIDDEN"));
    await assert.rejects(()=>listOwnBadges(userHeaders,{userId:adminId}),code("INVALID_BADGE_INPUT"));
    await assert.rejects(()=>writeBadgeDefinition({kind:"admin",id:fixture},definition(prefix)),
      error=>error instanceof BadgeStoreError&&error.code==="forbidden");
    await assert.rejects(()=>writeBadgeDefinition({kind:"system",id:"test"},definition(prefix)),
      error=>error instanceof BadgeStoreError&&error.code==="forbidden");
    for(const input of [{...definition(prefix),actor:{kind:"admin",id:adminId}},
      {...definition(prefix),name:" "},{...definition(prefix),description:"x\0y"},{...definition(prefix),key:"../bad"}]){
      await assert.rejects(()=>admin.createDefinition(input),code("INVALID_BADGE_INPUT"));
    }
    await assert.rejects(()=>system.grant({...grant(prefix,"forged"),actor:{kind:"admin",id:adminId}}),code("INVALID_BADGE_INPUT"));
    for(const before of ["abc","0","-1","9223372036854775808"]){
      await assert.rejects(()=>admin.listAudit(prefix,{before}),code("INVALID_BADGE_INPUT"));
    }
    const created=await admin.createDefinition(definition(prefix));
    assert.equal(created.revision,1);
    await assert.rejects(()=>admin.createDefinition(definition(prefix)),code("BADGE_ALREADY_EXISTS"));
    const award=await admin.grant(grant(prefix,"own",userId));
    assert.equal(award.state.active,true);
    const audit=await admin.listAudit(prefix);
    assert.deepEqual(audit.items[0].actor,{kind:"admin",id:adminId});
    const own=await listOwnBadges(userHeaders);
    assert.equal(own.items.length,1);
    assert.equal(own.items[0].key,prefix);
    for(const field of ["actor","reason","sourceId","idempotencyKey","userId"]){
      assert.ok(!(field in own.items[0]));
    }
    await admin.revoke(revoke(prefix,"own-revoke",award.state.revision,userId));
    assert.equal((await listOwnBadges(userHeaders)).items.length,0);
  });
  await t.test("definition revisions serialize competing edits and disabling preserves awarded badges",async()=>{
    const key=prefix+"-edit",created=await admin.createDefinition(definition(key));
    const edits=await Promise.allSettled([
      admin.updateDefinition({...definition(key),revision:created.revision,name:"版本一"}),
      admin.updateDefinition({...definition(key),revision:created.revision,name:"版本二"}),
    ]);
    assert.equal(edits.filter(value=>value.status==="fulfilled").length,1);
    for(const result of edits)if(result.status==="rejected")assert.ok(code("BADGE_REVISION_CONFLICT")(result.reason));
    const input=grant(key,"before-disable",userId),awarded=await system.grant(input);
    const disabled=await admin.updateDefinition({...definition(key),revision:2,enabled:false});
    assert.equal(disabled.revision,3);
    assert.ok((await listOwnBadges(userHeaders)).items.some(row=>row.key===key));
    await assert.rejects(()=>system.grant(grant(key,"disabled")),code("BADGE_DISABLED"));
    assert.equal((await system.grant(input)).auditId,awarded.auditId);
    await system.revoke(revoke(key,"revoke-disabled",1,userId));
    assert.ok(!(await listOwnBadges(userHeaders)).items.some(row=>row.key===key));
  });
  await t.test("concurrent grants are unique and retries validate every original input",async()=>{
    const key=prefix+"-concurrent";
    await admin.createDefinition(definition(key));
    const input=grant(key,"once");
    const results=await Promise.all(Array.from({length:12},()=>system.grant(input)));
    assert.equal(results.filter(row=>!row.replayed).length,1);
    assert.equal(new Set(results.map(row=>row.auditId)).size,1);
    const others=await Promise.all(Array.from({length:8},(_,i)=>system.grant(grant(key,"other-"+i))));
    assert.ok(others.every(row=>!row.changed&&!row.replayed&&row.state.revision===1));
    assert.equal((await pool.query("SELECT 1 FROM user_badges WHERE user_id=$1 AND badge_key=$2",[fixture,key])).rowCount,1);
    for(const patch of [{sourceId:"changed"},{sourceType:"changed"},{reason:"changed"},{badgeKey:prefix}]){
      await assert.rejects(()=>system.grant({...input,...patch}),code("BADGE_IDEMPOTENCY_CONFLICT"));
    }
    await assert.rejects(()=>createSystemBadgeService("other-system").grant(input),code("BADGE_IDEMPOTENCY_CONFLICT"));
    await assert.rejects(()=>system.revoke({...input,revision:1}),code("BADGE_IDEMPOTENCY_CONFLICT"));
    await assert.rejects(()=>system.grant(grant(key,"missing-user","badge-no-such-user")),code("BADGE_USER_NOT_FOUND"));
    await assert.rejects(()=>system.grant(grant("badge-no-such-definition","missing-badge")),code("BADGE_NOT_FOUND"));
  });
  await t.test("revocation and re-award preserve history; stale operations cannot revoke a later award",async()=>{
    const key=prefix+"-cycle";
    await admin.createDefinition(definition(key));
    await assert.rejects(()=>system.revoke(revoke(key,"unowned",1)),code("BADGE_AWARD_NOT_FOUND"));
    const input=grant(key,"cycle-grant"),first=await system.grant(input);
    await assert.rejects(()=>system.revoke({...grant(key,"bad-revoke")}),code("INVALID_BADGE_INPUT"));
    const undo=revoke(key,"cycle-revoke",first.state.revision);
    const results=await Promise.all([system.revoke(undo),system.revoke(undo)]);
    assert.equal(results[0].auditId,results[1].auditId);
    assert.equal(results[0].state.active,false);
    assert.equal(results[0].state.revision,2);
    const replay=await system.grant(input);
    assert.equal(replay.replayed,true);
    assert.equal(replay.state.active,true); // Historical result only; must not reactivate.
    assert.equal((await system.listUserBadges(fixture)).items.find(row=>row.badgeKey===key)?.active,false);
    const second=await system.grant(grant(key,"cycle-reaward"));
    assert.equal(second.state.revision,3);
    assert.equal((await system.revoke(undo)).replayed,true);
    await assert.rejects(()=>system.revoke(revoke(key,"stale-revoke",1)),code("BADGE_REVISION_CONFLICT"));
    assert.equal((await system.listUserBadges(fixture)).items.find(row=>row.badgeKey===key)?.active,true);
    const history=await admin.listAudit(key);
    assert.deepEqual(history.items.map(row=>row.operation),["grant","revoke","grant","create"]);
  });
  await t.test("audit insertion failure rolls back the award and permits a retry with the same key",async()=>{
    const key=prefix+"-rollback";
    await admin.createDefinition(definition(key));
    await pool.query(`CREATE FUNCTION badge_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'badge test audit failure'; END; $$`);
    try{
      await pool.query(`CREATE TRIGGER badge_test_reject_audit BEFORE INSERT ON badge_audit
        FOR EACH ROW EXECUTE FUNCTION badge_test_reject_audit()`);
      await assert.rejects(()=>system.grant(grant(key,"rollback")),/badge test audit failure/);
      assert.equal((await pool.query("SELECT 1 FROM user_badges WHERE user_id=$1 AND badge_key=$2",[fixture,key])).rowCount,0);
    }finally{
      await pool.query("DROP TRIGGER IF EXISTS badge_test_reject_audit ON badge_audit");
      await pool.query("DROP FUNCTION badge_test_reject_audit()");
    }
    assert.equal((await system.grant(grant(key,"rollback"))).replayed,false);
  });
  await t.test("badge lists and audits use bounded cursors and audits reject mutation",async()=>{
    const target=prefix+"-pages";
    await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,'Badge pages',$2,false,'user')`,[target,target+"@example.test"]);
    for(let i=0;i<35;i++){
      const key=prefix+"-page-"+String(i).padStart(2,"0");
      await admin.createDefinition(definition(key));
      await system.grant(grant(key,"page-"+i,target));
    }
    const first=await system.listUserBadges(target),second=await system.listUserBadges(target,{before:first.nextCursor});
    assert.equal(first.items.length,30);assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
    assert.equal(new Set([...first.items,...second.items].map(row=>row.badgeKey)).size,35);
    const defs=await admin.listDefinitions(),next=await admin.listDefinitions({before:defs.nextCursor});
    assert.equal(defs.items.length,30);
    assert.ok(next.items.length>0&&next.items.length<=30);
    assert.equal(new Set([...defs.items,...next.items].map(row=>row.key)).size,defs.items.length+next.items.length);
    const key=prefix+"-page-00";
    for(let i=0;i<35;i++)await system.grant(grant(key,"audit-"+i,target));
    const a=await admin.listAudit(key),b=await admin.listAudit(key,{before:a.nextCursor});
    assert.equal(a.items.length,30);assert.equal(b.items.length,7);assert.equal(b.nextCursor,null);
    assert.equal(new Set([...a.items,...b.items].map(row=>row.id)).size,37);
    for(const sql of ["UPDATE badge_audit SET reason='changed' WHERE badge_key=$1","DELETE FROM badge_audit WHERE badge_key=$1"]){
      await assert.rejects(()=>pool.query(sql,[key]),/append-only/);
    }
  });
  // Immutable fixtures are retained until the runner drops the dedicated test database.
}
