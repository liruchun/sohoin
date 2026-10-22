import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {getPool} from "@sohoin/database";
import {getFollowingActivities} from "../src/server/activities";
import {ServiceError} from "../src/server/security";
import {activityPageSchema} from "@sohoin/extension-api/activities";
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function activityCases(t:TestContext,request:Requester,adminToken:string,userToken:string,adminId:string,userId:string){
 const pool=getPool(),contents:string[]=[];
 const category=(await pool.query("INSERT INTO content_categories(name,slug) VALUES('动态测试','activity-test') RETURNING id::text")).rows[0].id;
 const outsider="activity-outsider";await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,'未关注用户','activity-outsider@example.test',false,'user')`,[outsider]);
 const endpoint="/api/v1/account/activities";
 const read=async(before?:string)=>{const response=await request(endpoint+(before?"?before="+before:""),"GET",undefined,userToken);assert.equal(response.status,200);assert.match(response.headers.get("cache-control")??"",/no-store/);const value=await response.json();assert.ok(activityPageSchema.safeParse(value).success);return value;};
 const reaction=(kind:string,id:string,code:string|null)=>request(`/api/v1/interactions/${kind}/${id}/reaction`,"PUT",{code},adminToken);
 const follow=(active:boolean)=>request(`/api/v1/users/${adminId}/follow`,"PUT",{active},userToken);
 async function create(status="published",author=adminId){const id=(await pool.query("INSERT INTO contents(type,title,excerpt,body,author_id,category_id,status,published_at) VALUES('post','动态测试','公开摘要',repeat('很长的正文',1000),$1,$2,$3,CASE WHEN $3='published' THEN now() END) RETURNING id::text",[author,category,status])).rows[0].id as string;contents.push(id);return id;}
 let content="",root="",reply="",reactionActivity="";
 try{
  await t.test("following activity authenticates, validates cursors and rejects a forged feed owner",async()=>{
   assert.equal((await request(endpoint)).status,401);await assert.rejects(()=>getFollowingActivities(new Headers(),{}),e=>e instanceof ServiceError&&e.status===401);
   for(const query of ["?before=0","?before=9223372036854775808","?userId="+adminId,"?actorId="+adminId,"?limit=1000"])assert.equal((await request(endpoint+query,"GET",undefined,userToken)).status,400);
   assert.equal((await read()).items.length,0);assert.equal((await follow(true)).status,200);
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths[endpoint].get);
  });
  await t.test("first publication records once through Core; edits and republishing do not create duplicate activity",async()=>{
   const value={type:"article",title:"首次发布",excerpt:"公开摘要",body:"正文",categoryId:category,tagIds:[],status:"draft"};
   const created=await request("/api/v1/admin/content","POST",value,adminToken);assert.equal(created.status,201);const initial=await created.json();content=initial.id;contents.push(content);
   assert.equal((await pool.query("SELECT 1 FROM user_activities WHERE content_id=$1",[content])).rowCount,0);
   let version=0;for(const status of ["published","published","archived","published"]){const response=await request("/api/v1/admin/content/"+content,"PATCH",{version,value:{...value,status}},adminToken);assert.equal(response.status,200);version++;}
   const rows=(await pool.query("SELECT id::text FROM user_activities WHERE content_id=$1 AND kind='content_published'",[content])).rows;assert.equal(rows.length,1);
   const page=await read();assert.ok(page.items.some(item=>item.id===rows[0].id&&item.actor.id===adminId&&item.content.type==="article"));
  });
  await t.test("comments and both reaction targets record atomically; private actions never enter the feed",async()=>{
   root=(await pool.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,$2,'一级评论') RETURNING id::text",[content,adminId])).rows[0].id;
   reply=(await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,'回复一级评论',$3,$3) RETURNING id::text",[content,adminId,root])).rows[0].id;
   assert.equal((await reaction("content",content,"like")).status,200);assert.equal((await reaction("comments",reply,"love")).status,200);
   const page=await read();assert.equal(page.items.length,5);assert.ok(page.items.some(item=>item.kind==="comment_created"&&item.comment?.replyToId===root));assert.ok(page.items.some(item=>item.kind==="comment_reacted"&&item.reaction?.code==="love"));
   const count=(await pool.query("SELECT count(*)::int AS n FROM user_activities WHERE actor_id=$1",[adminId])).rows[0].n;
   for(const kind of ["content","comments"]){const id=kind==="content"?content:reply;assert.equal((await request(`/api/v1/interactions/${kind}/${id}/bookmark`,"PUT",{active:true},adminToken)).status,200);}
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM user_activities WHERE actor_id=$1",[adminId])).rows[0].n,count);
   assert.ok(!JSON.stringify(page).includes("@example.test"));assert.ok(page.items.every(item=>!("body" in item.content)));
   const client=await pool.connect();let rolledBack="";try{await client.query("BEGIN");rolledBack=(await client.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,$2,'回滚评论') RETURNING id::text",[content,adminId])).rows[0].id;assert.equal((await client.query("SELECT 1 FROM user_activities WHERE comment_id=$1",[rolledBack])).rowCount,1);await client.query("ROLLBACK");}finally{client.release();}assert.equal((await pool.query("SELECT 1 FROM user_activities WHERE comment_id=$1",[rolledBack])).rowCount,0);
  });
  await t.test("reaction switching, cancellation and re-addition retain one original activity position",async()=>{
   const original=(await pool.query("SELECT id::text,created_at FROM user_activities WHERE actor_id=$1 AND content_id=$2 AND kind='content_reacted'",[adminId,content])).rows[0];reactionActivity=original.id;
   assert.equal((await reaction("content",content,"love")).status,200);assert.equal((await read()).items.find(item=>item.id===reactionActivity).reaction.code,"love");
   assert.equal((await reaction("content",content,null)).status,200);assert.ok(!(await read()).items.some(item=>item.id===reactionActivity));
   assert.equal((await reaction("content",content,"laugh")).status,200);assert.equal((await read()).items.find(item=>item.id===reactionActivity).reaction.code,"laugh");
   const retries=await Promise.all(Array.from({length:5},()=>reaction("content",content,"laugh")));assert.ok(retries.every(response=>response.status===200));
   const rows=(await pool.query("SELECT id::text,created_at FROM user_activities WHERE actor_id=$1 AND content_id=$2 AND kind='content_reacted'",[adminId,content])).rows;assert.equal(rows.length,1);assert.deepEqual(rows[0],original);
  });
  await t.test("current visibility hides archived content, single comments and whole threads without leaking snapshots",async()=>{
   await pool.query("UPDATE comments SET status='hidden' WHERE id=$1",[root]);let page=await read();assert.ok(!page.items.some(item=>item.comment?.id===root));assert.ok(page.items.some(item=>item.comment?.id===reply));
   await pool.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[root]);page=await read();assert.equal(page.items.filter(item=>item.comment!==null).length,0);assert.equal(page.items.length,2);
   await pool.query("UPDATE comments SET thread_hidden=false,status='deleted',body='',deleted_at=now() WHERE id=$1",[root]);assert.ok((await read()).items.some(item=>item.comment?.id===reply));
   await pool.query("UPDATE comments SET status='deleted',body='',deleted_at=now() WHERE id=$1",[reply]);assert.ok(!(await read()).items.some(item=>item.comment!==null));
   await pool.query("UPDATE contents SET status='archived' WHERE id=$1",[content]);assert.equal((await read()).items.length,0);await pool.query("UPDATE contents SET status='published' WHERE id=$1",[content]);assert.equal((await read()).items.length,2);
  });
  await t.test("follow changes and bans take effect on existing history and unrelated users stay out",async()=>{
   await create("published",outsider);await create("published",userId);await create("draft");assert.equal((await read()).items.length,2);
   assert.equal((await follow(false)).status,200);assert.equal((await read()).items.length,0);assert.equal((await follow(true)).status,200);assert.equal((await read()).items.length,2);
   await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[adminId]);try{assert.equal((await read()).items.length,0);}finally{await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[adminId]);}assert.equal((await read()).items.length,2);
  });
  await t.test("visibility filtering precedes pagination even when the newest 45 events are hidden",async()=>{
   const post=await create();await pool.query("INSERT INTO comments(content_id,author_id,body,status) SELECT $1,$2,CASE WHEN i<=35 THEN '可见活动'||i ELSE 'SECRET-hidden-activity' END,CASE WHEN i<=35 THEN 'visible' ELSE 'hidden' END FROM generate_series(1,80) i",[post,adminId]);
   const first=await read();assert.equal(first.items.length,30);assert.ok(first.nextCursor);assert.ok(!JSON.stringify(first).includes("SECRET-hidden-activity"));const second=await read(first.nextCursor);assert.equal(second.items.length,8);assert.equal(second.nextCursor,null);
   const all=[...first.items,...second.items];assert.equal(new Set(all.map(item=>item.id)).size,38);assert.ok(second.items.every(item=>BigInt(item.id)<BigInt(first.nextCursor)));assert.ok(all.every(item=>item.content.excerpt.length<=280&&(item.comment?.excerpt.length??0)<=120));assert.ok(!JSON.stringify(all).includes("很长的正文"));
  });
  await t.test("content deletion cascades source-linked activities, including reaction tombstones",async()=>{
   await pool.query("DELETE FROM contents WHERE id=$1",[content]);assert.equal((await pool.query("SELECT 1 FROM user_activities WHERE content_id=$1",[content])).rowCount,0);
   const orphan=(await pool.query("SELECT 1 FROM user_activities a LEFT JOIN contents c ON c.id=a.content_id WHERE c.id IS NULL LIMIT 1")).rowCount;assert.equal(orphan,0);
  });
 }finally{await pool.query("DELETE FROM user_follows WHERE follower_id=$1 AND following_id=$2",[userId,adminId]);await pool.query("DELETE FROM contents WHERE id=ANY($1::bigint[])",[contents]);await pool.query("DELETE FROM content_categories WHERE id=$1",[category]);await pool.query('DELETE FROM "user" WHERE id=$1',[outsider]);}
}
