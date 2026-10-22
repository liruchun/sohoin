import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {setTimeout as delay} from "node:timers/promises";
import {getPool,writeFollow,FollowStoreError,ADMIN_PERMISSIONS_LOCK} from "@sohoin/database";
import {setFollow,getOwnFollows,getFollowStates} from "../src/server/follows";
import {ServiceError} from "../src/server/security";
import {followPageSchema,followBatchResultSchema} from "@sohoin/extension-api/follows";
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function followCases(t:TestContext,request:Requester,adminToken:string,userToken:string,adminId:string,userId:string){
 const pool=getPool(),ids=Array.from({length:45},(_,i)=>"follow-fixture-"+String(i).padStart(3,"0"));
 await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) SELECT id,repeat('长用户名',30),id||'@example.test',false,'user' FROM unnest($1::text[]) id`,[ids]);
 const url=(id:string)=>"/api/v1/users/"+id+"/follow";
 const set=(id:string,active:boolean,token=userToken)=>request(url(id),"PUT",{active},token);
 const batch=async(ids:string[],token=userToken)=>{const response=await request("/api/v1/follows/summary","POST",{ids},token);assert.equal(response.status,200);const value=await response.json();assert.ok(followBatchResultSchema.safeParse(value).success);return value.items;};
 const list=async(direction:string,token=userToken,before?:string)=>{const response=await request("/api/v1/account/follows/"+direction+(before?"?before="+before:""),"GET",undefined,token);assert.equal(response.status,200);assert.match(response.headers.get("cache-control")??"",/no-store/);const value=await response.json();assert.ok(followPageSchema.safeParse(value).success);return value;};
 try{
  await t.test("follow services and HTTP authorize, validate origin and reject caller-selected owner",async()=>{
   assert.equal((await request(url(adminId),"PUT",{active:true})).status,401);
   assert.equal((await request("/api/v1/account/follows/followers")).status,401);
   assert.equal((await request("/api/v1/follows/summary","POST",{ids:[adminId]})).status,401);
   for(const call of [()=>setFollow(new Headers(),adminId,{active:true}),()=>getOwnFollows(new Headers(),"following",{}),()=>getFollowStates(new Headers(),{ids:[adminId]})])await assert.rejects(call,e=>e instanceof ServiceError&&e.status===401);
   assert.equal((await request(url(adminId),"PUT",{active:true},userToken,"https://attacker.example")).status,403);
   for(const input of [{active:1},{active:true,followerId:adminId},{active:true,userId:adminId},{active:true,followingId:ids[0]}])assert.equal((await request(url(adminId),"PUT",input,userToken)).status,400);
   assert.equal((await request(url(adminId),"PUT",{active:true,padding:"x".repeat(20000)},userToken)).status,413);
   assert.equal((await set("bad.id",true)).status,400);
   assert.equal((await set(userId,true)).status,400);assert.equal((await set(userId,false)).status,400);
   for(const query of ["?before=0","?userId="+adminId])assert.equal((await request("/api/v1/account/follows/following"+query,"GET",undefined,userToken)).status,400);
   assert.equal((await request("/api/v1/account/follows/all","GET",undefined,userToken)).status,400);
   for(const input of [{ids:[]},{ids:[adminId,adminId]},{ids:ids.slice(0,31)},{ids:[adminId],viewerId:adminId}])assert.equal((await request("/api/v1/follows/summary","POST",input,userToken)).status,400);
  });
  await t.test("concurrent repeated follows stay unique; reciprocal links and cancellations remain independent",async()=>{
   const results=await Promise.all(Array.from({length:12},()=>set(adminId,true)));assert.ok(results.every(response=>response.status===200));
   const stored=await pool.query("SELECT id::text,created_at FROM user_follows WHERE follower_id=$1 AND following_id=$2",[userId,adminId]);assert.equal(stored.rowCount,1);
   assert.deepEqual((await batch([adminId]))[0],{id:adminId,following:true,followsMe:false,mutual:false});
   assert.equal((await set(adminId,true)).status,200);const unchanged=(await pool.query("SELECT id::text,created_at FROM user_follows WHERE follower_id=$1 AND following_id=$2",[userId,adminId])).rows[0];assert.deepEqual(unchanged,stored.rows[0]);
   assert.equal((await set(userId,true,adminToken)).status,200);assert.equal((await batch([adminId]))[0].mutual,true);assert.equal((await batch([userId],adminToken))[0].mutual,true);
   const followers=await list("followers");assert.equal(followers.items.length,1);assert.equal(followers.items[0].following,true);assert.equal(followers.items[0].followsMe,true);
   for(let i=0;i<2;i++)assert.equal((await set(adminId,false)).status,200);
   assert.deepEqual((await batch([adminId]))[0],{id:adminId,following:false,followsMe:true,mutual:false});
   assert.equal((await list("following")).items.length,0);assert.equal((await list("followers")).items.length,1);
   assert.equal((await set(userId,false,adminToken)).status,200);assert.equal((await list("followers")).items.length,0);
   assert.equal((await set("nonexistent-user",false)).status,200);assert.equal((await set("nonexistent-user",true)).status,404);
  });
  await t.test("following and follower pages are private, bounded and carry batched mutual state without sensitive fields",async()=>{
   await pool.query("INSERT INTO user_follows(follower_id,following_id) SELECT $1,unnest($2::text[])",[userId,ids.slice(0,35)]);
   await pool.query("INSERT INTO user_follows(follower_id,following_id) SELECT unnest($1::text[]),$2",[ids.slice(15).concat(ids.slice(5,10)),userId]);
   const first=await list("following"),second=await list("following",userToken,first.nextCursor);assert.equal(first.items.length,30);assert.ok(first.nextCursor);assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,35);
   assert.ok(first.items.every(item=>item.name.length<=100));assert.ok(!JSON.stringify(first).includes("@example.test"));for(const key of ["email","role","banned","banReason","emailVerified"])assert.ok(!(key in first.items[0]));
   const incoming=await list("followers");assert.equal(incoming.items.length,30);assert.ok(incoming.nextCursor);const olderFollowers=await list("followers",userToken,incoming.nextCursor);assert.equal(olderFollowers.items.length,5);assert.equal(olderFollowers.nextCursor,null);assert.equal(new Set([...incoming.items,...olderFollowers.items].map(item=>item.id)).size,35);assert.equal(incoming.items.filter(item=>item.mutual).length,20);
   assert.equal((await list("following",adminToken)).items.length,0);assert.equal((await list("followers",adminToken)).items.length,0);
   const states=await batch([ids[0],ids[15],ids[40]]);assert.equal(states.find(item=>item.id===ids[0]).followsMe,false);assert.equal(states.find(item=>item.id===ids[15]).mutual,true);assert.equal(states.find(item=>item.id===ids[40]).following,false);
   assert.deepEqual((await batch([userId]))[0],{id:userId,following:false,followsMe:false,mutual:false});
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/users/{id}/follow"].put);assert.ok(spec.paths["/api/v1/account/follows/{direction}"].get);
  });
  await t.test("banned targets are hidden while relationships persist, and may still be unfollowed",async()=>{
   const target=ids[34];await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[target]);
   assert.equal((await set(target,true)).status,404);assert.deepEqual(await batch([target,"missing-user"]),[]);assert.ok(!(await list("following")).items.some(item=>item.id===target));assert.ok(!(await list("followers")).items.some(item=>item.id===target));
   assert.equal((await pool.query("SELECT 1 FROM user_follows WHERE follower_id=$1 AND following_id=$2",[userId,target])).rowCount,1);
   await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[target]);assert.equal((await batch([target]))[0].mutual,true);
   await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[target]);assert.equal((await set(target,false)).status,200);
   await assert.rejects(()=>writeFollow(target,userId,false),e=>e instanceof FollowStoreError&&e.code==="forbidden");
   await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[target]);assert.equal((await batch([target]))[0].following,false);assert.equal((await batch([target]))[0].followsMe,true);
  });
  await t.test("permission changes and follows use a consistent shared gate and reject a newly banned target",async()=>{
   const client=await pool.connect(),target=ids[44];const pid=(await client.query("SELECT pg_backend_pid() AS id")).rows[0].id;
   try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock($1)",[ADMIN_PERMISSIONS_LOCK]);await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE',[target]);
    const pending=assert.rejects(()=>writeFollow(userId,target,true),e=>e instanceof FollowStoreError&&e.code==="missing");let blocked=false;
    for(let i=0;i<100;i++){if((await pool.query("SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid)) LIMIT 1",[pid])).rowCount){blocked=true;break;}await delay(10);}assert.ok(blocked);
    await client.query('UPDATE "user" SET banned=true WHERE id=$1',[target]);await client.query("COMMIT");await pending;
    assert.equal((await pool.query("SELECT 1 FROM user_follows WHERE follower_id=$1 AND following_id=$2",[userId,target])).rowCount,0);
   }finally{await client.query("ROLLBACK");client.release();await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[target]);}
  });
  await t.test("database rejects self/orphan links and user deletion removes both directions",async()=>{
   await assert.rejects(()=>pool.query("INSERT INTO user_follows(follower_id,following_id) VALUES($1,$1)",[userId]),e=>(e as {code:string}).code==="23514");
   await assert.rejects(()=>pool.query("INSERT INTO user_follows(follower_id,following_id) VALUES($1,'missing-user')",[userId]),e=>(e as {code:string}).code==="23503");
   await assert.rejects(()=>pool.query("INSERT INTO user_follows(follower_id,following_id) VALUES($1,$2)",[userId,ids[15]]),e=>(e as {code:string}).code==="23505");
   const target=ids[15];await pool.query('DELETE FROM "user" WHERE id=$1',[target]);assert.equal((await pool.query("SELECT 1 FROM user_follows WHERE follower_id=$1 OR following_id=$1",[target])).rowCount,0);assert.deepEqual(await batch([target]),[]);assert.equal((await set(target,false)).status,200);
  });
  await t.test("follow write limits are shared across targets",async()=>{
   let limited=false;for(let i=0;i<62;i++){const response=await set(ids[i%ids.length],false);if(response.status===429){assert.ok(response.headers.get("retry-after"));limited=true;break;}assert.equal(response.status,200);}assert.ok(limited);
  });
 }finally{await pool.query("DELETE FROM user_follows WHERE follower_id=ANY($1::text[]) OR following_id=ANY($1::text[])",[[...ids,adminId,userId]]);await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])',[ids]);}
}
