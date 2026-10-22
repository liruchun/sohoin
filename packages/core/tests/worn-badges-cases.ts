import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {randomUUID} from "node:crypto";
import {getPool,readWornBadges,reconcileAchievements} from "@sohoin/database";
import {createAdminBadgeService,createSystemBadgeService,getSiteProfile} from "../src/server";

type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function wornBadgeCases(t:TestContext,request:Requester,adminToken:string,userToken:string,userId:string){
 const api="/api/v1/account/medals",prefix="wear-"+randomUUID().replaceAll("-","");
 const admin=createAdminBadgeService(new Headers({authorization:"Bearer "+adminToken}));
 const system=createSystemBadgeService("worn-badge-tests");
 const keys=[prefix+"-a",prefix+"-b",prefix+"-locked"];
 const definition=(key:string)=>({key,name:"佩戴测试",description:"勋章条件",enabled:true,reason:"安全测试"});
 for(const key of keys)await admin.createDefinition(definition(key));
 const grant=(key:string,operation:string)=>({userId,badgeKey:key,idempotencyKey:prefix+operation,sourceType:"test",sourceId:prefix,reason:"安全测试"});
 const award=await system.grant(grant(keys[0],"first"));
 await system.grant(grant(keys[1],"second"));
 const get=async()=>{const response=await request(api,"GET",undefined,userToken);assert.equal(response.status,200);return response.json();};
 await t.test("achievement check rejects unauthenticated, cross-origin and forged counts",async()=>{
  assert.equal((await request(api+"/check","POST",{})).status,401);
  assert.equal((await request(api+"/check","POST",{},userToken,"https://attacker.example")).status,403);
  assert.equal((await request(api+"/check","POST",{posts:100},userToken)).status,400);
  assert.equal((await request(api+"/check","POST",{data:"x".repeat(200)},userToken)).status,413);
 });
 await t.test("achievement metrics exclude drafts; concurrent awards are once-only and respect revocation",async()=>{
  const pool=getPool(),owner="ach-"+randomUUID(),key=prefix+"-achievement";
  await pool.query('INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,$2,$3,true,\'user\')',[owner,"成就测试",owner+"@example.test"]);
  await admin.createDefinition(definition(key));
  const category=(await pool.query("INSERT INTO content_categories(name,slug) VALUES('成就测试',$1) RETURNING id",[owner])).rows[0].id;
  const post=(await pool.query("INSERT INTO contents(type,title,body,status,author_id,category_id) VALUES('post','成就测试','正文','draft',$1,$2) RETURNING id",[owner,category])).rows[0].id;
  const check=()=>reconcileAchievements(owner,[key],metrics=>metrics.posts>=1?[key]:[]);
  assert.deepEqual(await check(),[]);
  await pool.query("UPDATE contents SET status='published',published_at=now() WHERE id=$1",[post]);
  assert.deepEqual((await Promise.all([check(),check()])).flat(),[key]);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM badge_audit WHERE user_id=$1 AND operation='grant'",[owner])).rows[0].count,1);
  await system.revoke({userId:owner,badgeKey:key,revision:1,idempotencyKey:prefix+"-achievement-revoke",sourceType:"test",sourceId:prefix,reason:"测试手动撤销"});
  assert.deepEqual(await check(),[]);
 });
 await t.test("wear endpoint authenticates, checks origin/body and rejects forged ownership",async()=>{
  assert.equal((await request(api)).status,401);
  assert.equal((await request(api,"PATCH",{badgeKey:null,revision:0})).status,401);
  assert.equal((await request(api,"PATCH",{badgeKey:null,revision:0},userToken,"https://attacker.example")).status,403);
  assert.equal((await request(api,"PATCH",{badgeKey:"a".repeat(1100),revision:0},userToken)).status,413);
  const current=await get();
  assert.equal((await request(api,"PATCH",{badgeKey:keys[0],revision:current.revision,userId:"someone-else"},userToken)).status,400);
  assert.equal((await request(api+"?userId=someone-else","GET",undefined,userToken)).status,400);
  assert.equal((await request(api,"PATCH",{badgeKey:keys[2],revision:current.revision},userToken)).status,404);
  assert.equal((await get()).revision,current.revision);
 });
 await t.test("one competing selection wins; public avatars expose only the valid selection; cancellation persists",async()=>{
  const current=await get();
  const results=await Promise.all(keys.slice(0,2).map(badgeKey=>request(api,"PATCH",{badgeKey,revision:current.revision},userToken)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const selected=await get();
  assert.ok(keys.includes(selected.worn.key));
  assert.match(selected.user.publicId,/^[a-z0-9]{10}$/);
  const profile=await getSiteProfile(selected.user.publicId);
  assert.equal(profile.wornBadge?.key,selected.worn.key);
  assert.deepEqual(Object.keys(profile.wornBadge!).sort(),["iconUrl","key","name"]);
  assert.equal((await request(api,"PATCH",{badgeKey:null,revision:selected.revision},userToken)).status,200);
  const removed=await get();assert.equal(removed.worn,null);
  assert.equal((await readWornBadges([userId])).size,0);
  const audit=await getPool().query("SELECT * FROM worn_badge_audit WHERE user_id=$1 ORDER BY id DESC LIMIT 2",[userId]);
  assert.equal(audit.rowCount,2);assert.equal(audit.rows[0].after_key,null);
  await assert.rejects(()=>getPool().query("DELETE FROM worn_badge_audit WHERE user_id=$1",[userId]),/append-only/);
 });
 await t.test("revocations and disabled definitions cannot be worn; re-awarding does not restore an old choice",async()=>{
  let current=await get();
  assert.equal((await request(api,"PATCH",{badgeKey:keys[0],revision:current.revision},userToken)).status,200);
  await system.revoke({...grant(keys[0],"revoke"),revision:award.state.revision});
  assert.equal((await get()).worn,null);assert.equal((await readWornBadges([userId])).size,0);
  await system.grant(grant(keys[0],"regrant"));
  assert.equal((await get()).worn,null);
  current=await get();
  assert.equal((await request(api,"PATCH",{badgeKey:keys[0],revision:current.revision},userToken)).status,200);
  await admin.updateDefinition({...definition(keys[0]),enabled:false,revision:1});
  current=await get();assert.equal(current.worn,null);
  assert.equal((await readWornBadges([userId])).size,0);
  assert.equal((await request(api,"PATCH",{badgeKey:keys[0],revision:current.revision},userToken)).status,409);
  assert.equal((await request(api,"PATCH",{badgeKey:null,revision:current.revision},userToken)).status,200);
 });
 await t.test("collection pages stay bounded and contain no private audit or database identity",async()=>{
  let page=await get();const seen=new Set<string>();
  for(let n=0;n<10;n++){
   assert.ok(page.items.length<=30);
   for(const item of page.items){assert.ok(!seen.has(item.key));seen.add(item.key);assert.ok(!("userId" in item));assert.ok(!("iconMediaId" in item));assert.ok(!("reason" in item));}
   if(!page.nextCursor)break;
   const response=await request(api+"?before="+page.nextCursor,"GET",undefined,userToken);assert.equal(response.status,200);page=await response.json();
  }
  assert.ok(seen.has(keys[1]));assert.ok(seen.has(keys[2]));assert.ok(!seen.has(keys[0]));
 });
}
