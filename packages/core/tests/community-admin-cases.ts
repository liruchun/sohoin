import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {getPool} from "@sohoin/database";
import {createContentService,createProfileService,listNotifications,sendNotification,ServiceError} from "../src/server";
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function communityAdminCases(t:TestContext,request:Requester,adminToken:string,userToken:string,adminId:string,userId:string){
 const pool=getPool(),contents:string[]=[];
 const category=(await pool.query("INSERT INTO content_categories(name,slug) VALUES('运营测试','community-admin-test') RETURNING id::text")).rows[0].id;
 const userHeaders=new Headers({Authorization:"Bearer "+userToken});let editorial="",post="",root="",reply="",systemId="";
 const value={type:"article",title:"运营内容",excerpt:"摘要",body:"正文",categoryId:category,tagIds:[],status:"published"};
 const inbox="/api/v1/account/notifications",profile="/api/v1/account/profile";
 const notifications=async(query="",token=userToken)=>{const response=await request(inbox+query,"GET",undefined,token);assert.equal(response.status,200);return response.json();};
 const count=async()=>{const response=await request(inbox+"/unread-count","GET",undefined,userToken);assert.equal(response.status,200);return (await response.json()).count;};
 const send=(key:string,title="系统测试",recipientId=userId)=>request("/api/v1/admin/notifications","POST",{recipientId,key,title,body:"系统正文 <script>plain text</script>"},adminToken);
 try{
  await t.test("editorial flags are independent, versioned and preserved for older clients",async()=>{
   const created=await request("/api/v1/admin/content","POST",{...value,featured:true,pinLevel:2},adminToken);assert.equal(created.status,201);const a=await created.json();editorial=a.id;contents.push(a.id);assert.equal(a.featured,true);assert.equal(a.pinLevel,2);assert.ok(a.featuredAt);
   const url="/api/v1/admin/content/"+a.id;assert.equal((await request(url,"PATCH",{version:0,value:{...value,featured:false,pinLevel:0}},userToken)).status,403);
   const preserved=await request(url,"PATCH",{version:0,value},adminToken);assert.equal(preserved.status,200);const b=await preserved.json();assert.equal(b.featured,true);assert.equal(b.pinLevel,2);assert.equal(b.featuredAt,a.featuredAt);
   assert.equal((await request(url,"PATCH",{version:0,value},adminToken)).status,409);
   const cleared=await request(url,"PATCH",{version:1,value:{...value,featured:false}},adminToken);assert.equal(cleared.status,200);const c=await cleared.json();assert.equal(c.featured,false);assert.equal(c.featuredAt,null);assert.equal(c.pinLevel,2);
   for(const input of [{featured:"yes"},{pinLevel:4},{pinLevel:-1},{featuredAt:new Date().toISOString()}])assert.equal((await request(url,"PATCH",{version:2,value:{...value,...input}},adminToken)).status,400);
   const audit=(await pool.query("SELECT 1 FROM content_audit WHERE object_id=$1 AND action='updated'",[a.id])).rowCount;assert.equal(audit,2);
  });
  await t.test("sorting and compound cursors retain microsecond order without missing or duplicate rows",async()=>{
   await pool.query("DELETE FROM contents WHERE id=$1",[editorial]);
   const rows=(await pool.query(`INSERT INTO contents(type,title,body,category_id,status,author_id,published_at,updated_at,featured,featured_at,pin_level) SELECT 'article','排序'||i,'正文',$1,'published',$2,'2026-01-01Z'::timestamptz+i*interval '1 microsecond','2026-01-01Z'::timestamptz+(40-i)*interval '1 microsecond',i%3=0,CASE WHEN i%3=0 THEN now() END,i%4 FROM generate_series(1,35) i RETURNING id::text,pin_level`,[category,adminId])).rows;contents.push(...rows.map(row=>row.id));
   for(const sort of ["latest","published","updated","priority"]){const base="/api/v1/content?categoryId="+category+"&sort="+sort;const firstResponse=await request(base);assert.equal(firstResponse.status,200,sort);const first=await firstResponse.json();assert.equal(first.items.length,30);assert.ok(first.nextCursor);await createContentService().listPublic({categoryId:category,sort,before:first.nextCursor});const secondResponse=await request(base+"&before="+first.nextCursor);const second=await secondResponse.json();assert.equal(secondResponse.status,200,JSON.stringify({sort,next:first.nextCursor,response:second}));assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);const ids=[...first.items,...second.items].map(row=>row.id);assert.equal(new Set(ids).size,35);
    const expected=[...rows].sort((a,b)=>sort==="priority"?(b.pin_level-a.pin_level)||Number(BigInt(b.id)-BigInt(a.id)):sort==="updated"?Number(BigInt(a.id)-BigInt(b.id)):Number(BigInt(b.id)-BigInt(a.id))).map(row=>row.id);assert.deepEqual(ids,expected);
    if(sort==="priority")assert.equal((await request("/api/v1/content?sort=updated&before="+first.nextCursor)).status,400);
   }
   const featured=await (await request("/api/v1/content?categoryId="+category+"&featured=yes")).json();assert.equal(featured.items.length,11);assert.ok(featured.items.every(row=>row.featured));
   const pinned=await (await request("/api/v1/content?categoryId="+category+"&pinned=yes")).json();assert.equal(pinned.items.length,27);assert.ok(pinned.items.every(row=>row.pinLevel>0));
   assert.equal((await request("/api/v1/content?sort=priority&before=10")).status,400);
   await pool.query("DELETE FROM contents WHERE id=ANY($1::bigint[])",[rows.map(row=>row.id)]);
  });
  await t.test("profiles authorize separately from roles, validate URLs and reject stale/concurrent updates",async()=>{
   assert.equal((await request(profile)).status,401);assert.equal((await request("/api/v1/admin/users/"+userId+"/profile","GET",undefined,userToken)).status,403);
   const initial=await (await request(profile,"GET",undefined,userToken)).json();assert.equal(initial.version,0);assert.equal(initial.bio,"");
   for(const input of [{bio:"x",homepage:"javascript:alert(1)"},{bio:"x",homepage:"https://user:pass@example.test"},{bio:"x".repeat(501),homepage:""},{bio:"x",homepage:"",role:"admin"},{bio:"x",homepage:"",userId:adminId}])assert.equal((await request(profile,"PATCH",{version:0,...input},userToken)).status,400);
   assert.equal((await request(profile,"PATCH",{version:0,bio:"x",homepage:""},userToken,"https://attacker.example")).status,403);
   assert.equal((await request(profile,"PATCH",{version:0,bio:"x".repeat(20000),homepage:""},userToken)).status,413);
   const results=await Promise.all(["甲","乙"].map(bio=>request(profile,"PATCH",{version:0,bio,homepage:"https://example.test/me"},userToken)));assert.deepEqual(results.map(response=>response.status).sort(),[200,409]);
  });
  await t.test("typed profile extensions stay private by default, preserve omitted data and guard schema versions",async()=>{
   const custom=createProfileService({schemaVersion:1,fields:{city:{kind:"text",maxLength:40,public:true},secret:{kind:"text",maxLength:80},score:{kind:"number",min:0,max:100,integer:true,public:true},verified:{kind:"boolean",public:true},tier:{kind:"enum",options:["basic","pro"],public:true}}});
   await assert.rejects(()=>custom.updateOwn(userHeaders,{version:1,bio:"x",homepage:"",data:{unknown:"x"}}),e=>e instanceof ServiceError&&e.status===400);
   const saved=await custom.updateOwn(userHeaders,{version:1,bio:"介绍 <script>plain</script>",homepage:"https://example.test",data:{city:"杭州",secret:"private-profile-marker",score:0,verified:false,tier:"basic"}});assert.equal(saved.version,2);
   const publicData=await custom.readPublic(userId);assert.deepEqual(publicData.data,{city:"杭州",score:0,verified:false,tier:"basic"});
   const anonymous=await (await request("/api/v1/users/"+userId+"/profile")).json();assert.deepEqual(anonymous.data,{});assert.ok(!JSON.stringify(anonymous).includes("private-profile-marker"));assert.ok(!("email" in anonymous)&&!("version" in anonymous));
   const edited=await request("/api/v1/admin/users/"+userId+"/profile","PATCH",{version:2,bio:"管理员调整介绍",homepage:""},adminToken);assert.equal(edited.status,200);assert.equal((await edited.json()).data.secret,"private-profile-marker");
   const newer=createProfileService({schemaVersion:2,fields:{city:{kind:"text",maxLength:40,public:true}}});assert.deepEqual((await newer.readPublic(userId)).data,{});await assert.rejects(()=>newer.updateOwn(userHeaders,{version:3,bio:"x",homepage:"",data:{city:"北京"}}),e=>e instanceof ServiceError&&e.status===409);
   const audits=(await pool.query("SELECT changed_fields FROM user_profile_audit WHERE target_id=$1",[userId])).rows;assert.ok(audits.some(row=>row.changed_fields.includes("data")));assert.ok(!JSON.stringify(audits).includes("private-profile-marker"));
  });
  await t.test("notification creation is atomic, targeted and skips self; retries do not multiply messages",async()=>{
   post=(await pool.query("INSERT INTO contents(type,title,body,category_id,status,author_id,published_at) VALUES('article','通知关联','正文',$1,'published',$2,now()) RETURNING id::text",[category,userId])).rows[0].id;contents.push(post);
   root=(await pool.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,$2,'作者自己评论') RETURNING id::text",[post,userId])).rows[0].id;
   reply=(await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,'回复作者',$3,$3) RETURNING id::text",[post,adminId,root])).rows[0].id;
   for(const [kind,id] of [["content",post],["comments",root]]){for(let i=0;i<2;i++)assert.equal((await request(`/api/v1/interactions/${kind}/${id}/reaction`,"PUT",{code:"like"},adminToken)).status,200);}
   assert.equal((await request("/api/v1/users/"+userId+"/follow","PUT",{active:true},adminToken)).status,200);
   let page=await notifications();assert.equal(page.items.length,4);assert.ok(page.items.every(item=>item.actor.id===adminId));assert.ok(!JSON.stringify(page).includes("@example.test"));
   const before=await count();assert.equal((await request(`/api/v1/interactions/content/${post}/reaction`,"PUT",{code:"love"},userToken)).status,200);assert.equal(await count(),before);
   const client=await pool.connect();let id="";try{await client.query("BEGIN");id=(await client.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,$2,'回滚通知') RETURNING id::text",[post,adminId])).rows[0].id;await client.query("ROLLBACK");}finally{client.release();}assert.equal((await pool.query("SELECT 1 FROM notifications n JOIN user_activities a ON a.id=n.activity_id WHERE a.comment_id=$1",[id])).rowCount,0);
   assert.equal((await request(`/api/v1/interactions/content/${post}/reaction`,"PUT",{code:null},adminToken)).status,200);assert.equal(await count(),before-1);assert.equal((await request(`/api/v1/interactions/content/${post}/reaction`,"PUT",{code:"love"},adminToken)).status,200);assert.equal(await count(),before);
  });
  await t.test("system messages require admin, validate origin and body bounds, and use idempotency keys",async()=>{
   assert.equal((await request("/api/v1/admin/notifications","POST",{recipientId:userId,key:"system-test",title:"x",body:""},userToken)).status,403);await assert.rejects(()=>sendNotification(new Headers(),{}),e=>e instanceof ServiceError&&e.status===401);
   const value={recipientId:userId,key:"system-test",title:"系统测试",body:"系统正文 <script>plain text</script>"};assert.equal((await request("/api/v1/admin/notifications","POST",value,adminToken,"https://attacker.example")).status,403);assert.equal((await request("/api/v1/admin/notifications","POST",{...value,body:"x".repeat(20000)},adminToken)).status,413);
   for(const extra of [{href:"javascript:alert(1)"},{senderId:userId}])assert.equal((await request("/api/v1/admin/notifications","POST",{...value,...extra},adminToken)).status,400);
   const response=await send("system-test");assert.equal(response.status,200);systemId=(await response.json()).id;assert.equal((await (await send("system-test")).json()).id,systemId);assert.equal((await send("system-test","不同正文")).status,409);
   assert.equal((await request(inbox+"/"+systemId,"GET",undefined,adminToken)).status,404);const own=await (await request(inbox+"/"+systemId,"GET",undefined,userToken)).json();assert.equal(own.readAt,null);assert.ok(own.body.includes("<script>"));
  });
  await t.test("notification ownership, read status and bulk boundary protect other users and new arrivals",async()=>{
   assert.equal((await request(inbox)).status,401);await assert.rejects(()=>listNotifications(new Headers(),{}),e=>e instanceof ServiceError&&e.status===401);assert.equal((await request(inbox+"?recipientId="+adminId,"GET",undefined,userToken)).status,400);
   const foreign=(await (await send("admin-only","管理员消息",adminId)).json()).id;
   assert.equal((await (await request(inbox+"/read","PATCH",{ids:[foreign]},userToken)).json()).updated,0);
   assert.equal((await request(inbox+"/read","PATCH",{ids:[systemId]},userToken,"https://attacker.example")).status,403);
   const mark=await request(inbox+"/read","PATCH",{ids:[systemId]},userToken);assert.equal((await mark.json()).updated,1);assert.equal((await (await request(inbox+"/read","PATCH",{ids:[systemId]},userToken)).json()).updated,0);
   const first=await notifications(),through=first.items[0].id,newId=(await (await send("new-arrival")).json()).id;
   assert.equal((await request(inbox+"/read","PATCH",{through},userToken)).status,200);assert.equal(await count(),1);assert.equal((await notifications("?status=unread")).items[0].id,newId);
  });
  await t.test("notification lists/counts/detail filter current target visibility before pagination",async()=>{
   const current=await notifications(),replyNotice=current.items.find(item=>item.kind==="reply").id;
   await pool.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[root]);assert.equal((await request(inbox+"/"+replyNotice,"GET",undefined,userToken)).status,404);await pool.query("UPDATE comments SET thread_hidden=false WHERE id=$1",[root]);
   await pool.query("UPDATE contents SET status='archived' WHERE id=$1",[post]);assert.ok((await notifications()).items.every(item=>item.target.contentId!==post));await pool.query("UPDATE contents SET status='published' WHERE id=$1",[post]);
   await pool.query("INSERT INTO notifications(recipient_id,actor_id,kind,system_key,title) SELECT $1,$2,'system','page-'||i,'分页通知'||i FROM generate_series(1,35) i",[userId,adminId]);
   await pool.query("INSERT INTO comments(content_id,author_id,body,status) SELECT $1,$2,'hidden-notification-secret','hidden' FROM generate_series(1,45)",[post,adminId]);
   const first=await notifications("?status=unread");assert.equal(first.items.length,30);assert.ok(first.nextCursor);assert.ok(!JSON.stringify(first).includes("hidden-notification-secret"));const second=await notifications("?status=unread&before="+first.nextCursor);assert.equal(second.items.length,6);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,36);assert.equal(await count(),36);
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths[profile].patch);assert.ok(spec.paths[inbox+"/read"].patch);
  });
 }finally{await pool.query("DELETE FROM contents WHERE id=ANY($1::bigint[])",[contents]);await pool.query("DELETE FROM content_categories WHERE id=$1",[category]);await pool.query("DELETE FROM notifications WHERE recipient_id=ANY($1::text[])",[[adminId,userId]]);await pool.query("DELETE FROM user_follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)",[adminId,userId]);}
}
