import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {setTimeout as delay} from "node:timers/promises";
import {getPool,writeInteraction,readInteractionBatch,savePublicRouteIds,InteractionStoreError} from "@sohoin/database";
import {createShortPublicId} from "../src/server/public-id";
import {getSiteDiscussion} from "../src/server/public-discussion";
import {setBookmark,getSiteInteractions} from "../src/server/interactions";
import {ServiceError} from "../src/server/security";
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function interactionCases(t:TestContext,request:Requester,adminToken:string,userToken:string,actor:string,user:string){
 const pool=getPool(),contents:string[]=[];
 const category=(await pool.query("INSERT INTO content_categories(name,slug) VALUES('互动测试分类','interaction-test') RETURNING id::text")).rows[0].id;
 async function create(status="published"){const id=(await pool.query("INSERT INTO contents(type,title,body,author_id,category_id,status,published_at) VALUES('article','互动测试','正文',$1,$3,$2,CASE WHEN $2='published' THEN now() END) RETURNING id::text",[actor,status,category])).rows[0].id as string;contents.push(id);return id;}
 const content=await create(),draft=await create("draft"),archived=await create("archived");
 async function comment(body:string,root?:string){return (await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,$3,$4,$4) RETURNING id::text",[content,actor,body,root??null])).rows[0].id as string;}
 const root=await comment("一级评论"),reply=await comment("二级回复",root);
 const path=(kind:string,id:string,action:string)=>`/api/v1/interactions/${kind}/${id}/${action}`;
 const put=(kind:string,id:string,action:string,value:unknown,token=userToken)=>request(path(kind,id,action),"PUT",value,token);
 const batch=async(kind:string,ids:string[],token=userToken)=>(await (await request(`/api/v1/interactions/${kind}/summary`,"POST",{ids},token)).json()).items;
 try{
  await t.test("interaction APIs enforce login, origin, bounded input and reject caller-supplied identity",async()=>{
   assert.equal((await request(path("content",content,"reaction"),"PUT",{code:"like"})).status,401);
   assert.equal((await request("/api/v1/account/bookmarks/content")).status,401);
   await assert.rejects(()=>setBookmark(new Headers(),"content",content,{active:true}),e=>e instanceof ServiceError&&e.status===401);
   assert.equal((await request(path("content",content,"bookmark"),"PUT",{active:true},userToken,"https://attacker.example")).status,403);
   for(const value of [{active:"yes"},{active:true,userId:actor}])assert.equal((await put("content",content,"bookmark",value)).status,400);
   for(const value of [{code:"unknown"},{code:"<script>"},{code:"like",userId:actor}])assert.equal((await put("content",content,"reaction",value)).status,400);
   assert.equal((await put("bad",content,"reaction",{code:"like"})).status,400);
   assert.equal((await put("content","0","reaction",{code:"like"})).status,400);
   assert.equal((await put("content",content,"reaction",{code:"x".repeat(20000)})).status,413);
   for(const input of [{ids:[content,content]},{ids:[]},{ids:Array.from({length:31},(_,i)=>String(i+1))},{ids:[content],userId:actor}])assert.equal((await request("/api/v1/interactions/content/summary","POST",input,userToken)).status,400);
   assert.equal((await request("/api/v1/account/bookmarks/content?userId="+actor,"GET",undefined,userToken)).status,400);
  });
  await t.test("one reaction per person switches atomically; retries and concurrent bookmarks remain idempotent",async()=>{
   for(const [kind,id] of [["content",content],["comments",reply]]){
    for(const code of ["like","like","love"])assert.equal((await put(kind,id,"reaction",{code})).status,200);
    assert.equal((await put(kind,id,"reaction",{code:"like"},adminToken)).status,200);
    const first=(await batch(kind,[id]))[0];assert.equal(first.myReaction,"love");assert.deepEqual(first.reactions,[{code:"like",count:1},{code:"love",count:1}]);assert.ok(!("userId" in first));assert.ok(!("bookmarkCount" in first));
    const responses=await Promise.all(Array.from({length:8},()=>put(kind,id,"bookmark",{active:true})));assert.ok(responses.every(r=>r.status===200));
    const table=kind==="content"?"content_bookmarks":"comment_bookmarks",key=kind==="content"?"content_id":"comment_id";
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${key}=$1 AND user_id=$2`,[id,user])).rows[0].n,1);
    const own=(await batch(kind,[id]))[0],other=(await batch(kind,[id],adminToken))[0];assert.equal(own.bookmarked,true);assert.equal(other.bookmarked,false);
    assert.equal((await put(kind,id,"reaction",{code:null})).status,200);assert.equal((await put(kind,id,"reaction",{code:null})).status,200);
    const remaining=(await batch(kind,[id]))[0];assert.equal(remaining.myReaction,null);assert.deepEqual(remaining.reactions,[{code:"like",count:1}]);
    const race=await Promise.all([put(kind,id,"reaction",{code:"laugh"}),put(kind,id,"reaction",{code:"wow"})]);assert.ok(race.every(r=>r.status===200));assert.ok(["laugh","wow"].includes((await batch(kind,[id]))[0].myReaction));
   }
  });
  await t.test("unpublished content and hidden/deleted comments cannot receive or expose interactions",async()=>{
   for(const id of [draft,archived,"999999999"]){for(const [action,value] of [["reaction",{code:"like"}],["bookmark",{active:true}]] as const)assert.equal((await put("content",id,action,value)).status,404);assert.deepEqual(await batch("content",[id]),[]);}
   await pool.query("UPDATE comments SET status='hidden' WHERE id=$1",[root]);assert.equal((await put("comments",root,"reaction",{code:"like"})).status,404);
   assert.equal((await put("comments",reply,"reaction",{code:"like"})).status,200);
   await pool.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[root]);
   assert.equal((await put("comments",reply,"bookmark",{active:true})).status,404);assert.deepEqual(await batch("comments",[reply]),[]);
   assert.equal((await put("comments",reply,"bookmark",{active:false})).status,200);assert.equal((await put("comments",reply,"reaction",{code:null})).status,200);
   const hiddenBookmarks=await (await request("/api/v1/account/bookmarks/comments","GET",undefined,userToken)).json();assert.equal(hiddenBookmarks.items.length,0);
   await pool.query("UPDATE comments SET thread_hidden=false,status='deleted',body='',deleted_at=now() WHERE id=$1",[root]);
   assert.equal((await put("comments",root,"bookmark",{active:true})).status,404);assert.equal((await put("comments",reply,"bookmark",{active:true})).status,200);
   await pool.query("UPDATE contents SET status='archived' WHERE id=$1",[content]);assert.equal((await put("comments",reply,"reaction",{code:"like"})).status,404);assert.deepEqual(await batch("content",[content]),[]);
   assert.equal((await put("content",content,"bookmark",{active:false})).status,200);
   await pool.query("UPDATE contents SET status='published' WHERE id=$1",[content]);
  });
  await t.test("visibility changes serialize with in-flight interaction writes",async()=>{
   const client=await pool.connect();const pid=(await client.query("SELECT pg_backend_pid() AS id")).rows[0].id;
   async function waitForBlocked(){for(let i=0;i<100;i++){if((await pool.query("SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid)) LIMIT 1",[pid])).rowCount)return;await delay(10);}throw new Error("Interaction did not wait for the visibility lock");}
   try{
    await client.query("BEGIN");await client.query("SELECT id FROM contents WHERE id=$1 FOR UPDATE",[content]);
    const pending=assert.rejects(()=>writeInteraction(user,"content",content,{code:"like"}),e=>e instanceof InteractionStoreError&&e.code==="missing");
    await waitForBlocked();await client.query("UPDATE contents SET status='archived' WHERE id=$1",[content]);await client.query("COMMIT");await pending;
    await pool.query("UPDATE contents SET status='published' WHERE id=$1",[content]);
    await client.query("BEGIN");await client.query("SELECT id FROM comments WHERE id=$1 FOR UPDATE",[root]);
    const pendingReply=assert.rejects(()=>writeInteraction(user,"comments",reply,{active:true}),e=>e instanceof InteractionStoreError&&e.code==="missing");
    await waitForBlocked();await client.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[root]);await client.query("COMMIT");await pendingReply;
   }finally{await client.query("ROLLBACK");client.release();await pool.query("UPDATE contents SET status='published' WHERE id=$1",[content]);await pool.query("UPDATE comments SET thread_hidden=false WHERE id=$1",[root]);}
  });
  await t.test("reaction configuration is versioned, admin-only and disabling preserves historical counts",async()=>{
   const url="/api/v1/admin/reaction-types";
   assert.equal((await request(url)).status,401);assert.equal((await request(url,"GET",undefined,userToken)).status,403);
   assert.equal((await request(url+"/like","PATCH",{version:0,enabled:false,position:2},userToken)).status,403);
   const config=await (await request(url,"GET",undefined,adminToken)).json(),type=config.items.find(t=>t.code==="like");
   assert.equal((await request(url+"/like","PATCH",{version:type.version,enabled:false,position:2},adminToken)).status,200);
   assert.equal((await request(url+"/like","PATCH",{version:type.version,enabled:true,position:2},adminToken)).status,409);
   assert.equal((await put("content",content,"reaction",{code:"like"})).status,400);
   assert.ok((await batch("content",[content]))[0].reactions.some(r=>r.code==="like"&&r.count===1));
   const catalog=await (await request("/api/v1/reaction-types")).json();assert.equal(catalog.items.find(t=>t.code==="like").enabled,false);assert.ok(!("version" in catalog.items[0]));
   assert.ok((await pool.query("SELECT 1 FROM settings_audit WHERE before_value ? 'reactionTypes' AND after_value ? 'reactionTypes'")).rowCount);
   assert.equal((await request(url+"/like","PATCH",{version:type.version+1,enabled:true,position:0},adminToken)).status,200);
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/interactions/{kind}/{id}/bookmark"].put);assert.ok(spec.paths["/api/v1/account/bookmarks/{kind}"].get);
  });
  await t.test("own bookmarks use bounded private pagination and never return full body",async()=>{
   const ids:string[]=[];for(let i=0;i<35;i++)ids.push(await create());
   await pool.query("INSERT INTO content_bookmarks(content_id,user_id) SELECT unnest($1::bigint[]),$2",[ids,user]);
   const firstResponse=await request("/api/v1/account/bookmarks/content","GET",undefined,userToken);assert.match(firstResponse.headers.get("cache-control")??"",/no-store/);const first=await firstResponse.json();assert.equal(first.items.length,30);assert.ok(first.nextCursor);assert.ok(!("body" in first.items[0]));assert.ok(first.items.every(item=>item.preview.length<=160));
   const second=await (await request("/api/v1/account/bookmarks/content?before="+first.nextCursor,"GET",undefined,userToken)).json();assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(item=>item.bookmarkId)).size,35);
   const foreign=await (await request("/api/v1/account/bookmarks/content","GET",undefined,adminToken)).json();assert.equal(foreign.items.length,0);
   assert.equal((await request("/api/v1/account/bookmarks/content?before=0","GET",undefined,userToken)).status,400);
  });
  await t.test("foreign keys prevent orphan interactions and content deletion cleans associated rows",async()=>{
   await assert.rejects(()=>pool.query("UPDATE content_reactions SET code='nonexistent' WHERE content_id=$1 AND user_id=$2",[content,user]),e=>(e as {code:string}).code==="23503");
   await assert.rejects(()=>pool.query("INSERT INTO comment_bookmarks(comment_id,user_id) VALUES(999999999,$1)",[user]),e=>(e as {code:string}).code==="23503");
   await pool.query("DELETE FROM contents WHERE id=$1",[content]);
   for(const table of ["content_reactions","content_bookmarks"])assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE content_id=$1`,[content])).rowCount,0);
   for(const table of ["comment_reactions","comment_bookmarks"])assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE comment_id=$1`,[reply])).rowCount,0);
   const disposable="interaction-delete-user";
   await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,'Cascade user','interaction-delete@example.test',false,'user')`,[disposable]);
   try{await pool.query("INSERT INTO content_reactions(content_id,user_id,code) VALUES($1,$2,'like')",[draft,disposable]);await pool.query("INSERT INTO content_bookmarks(content_id,user_id) VALUES($1,$2)",[draft,disposable]);await pool.query('DELETE FROM "user" WHERE id=$1',[disposable]);for(const table of ["content_reactions","content_bookmarks"])assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE user_id=$1`,[disposable])).rowCount,0);}finally{await pool.query('DELETE FROM "user" WHERE id=$1',[disposable]);}
   assert.equal((await put("content",content,"bookmark",{active:false})).status,200);
   await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[user]);try{await assert.rejects(()=>writeInteraction(user,"content",draft,{active:false}),e=>e instanceof InteractionStoreError&&e.code==="forbidden");}finally{await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[user]);}
  });
  await t.test("public interactions preserve multiple selections, cap concurrent writes at five and isolate viewer state",async()=>{
   const id=await create(),token=createShortPublicId(),draftToken=createShortPublicId();
   const codes=["limit_a","limit_b","limit_c","limit_d","limit_e","limit_f"];
   await savePublicRouteIds([{kind:"content",content_id:id,user_id:null,token},{kind:"content",content_id:draft,user_id:null,token:draftToken}]);
   await pool.query("INSERT INTO reaction_types(code,label,emoji) SELECT code,'测试','👍' FROM unnest($1::text[]) code",[codes]);
   const url=`/api/site/interactions/${token}/reaction`;
   const select=(code:string,active=true)=>request(url,"PUT",{code,active},userToken);
   const ownHeaders=new Headers({Authorization:"Bearer "+userToken});
   try{
    assert.equal((await request(url,"PUT",{code:codes[0],active:true})).status,401);
    assert.equal((await request(url,"PUT",{code:codes[0],active:true},userToken,"https://attacker.example")).status,403);
    assert.equal((await request(url,"PUT",{code:codes[0],active:true,userId:actor},userToken)).status,400);
    assert.equal((await request(url,"PUT",{code:"x".repeat(2000),active:true},userToken)).status,413);
    assert.equal((await request(`/api/site/interactions/${id}/reaction`,"PUT",{code:codes[0],active:true},userToken)).status,400);
    assert.equal((await request(`/api/site/interactions/${draftToken}/reaction`,"PUT",{code:codes[0],active:true},userToken)).status,404);
    const responses=await Promise.all(codes.map(code=>select(code)));
    assert.deepEqual(responses.map(response=>response.status).sort(),[200,200,200,200,200,409]);
    const row=(await readInteractionBatch(user,"content",[id]))[0];assert.equal(row.my_reactions.length,5);
    const retry=await select(row.my_reactions[0]);assert.equal(retry.status,200);
    assert.match(retry.headers.get("cache-control")??"",/no-store/);assert.equal(retry.headers.get("x-robots-tag"),"noindex");
    const result=await retry.json();assert.equal(result.publicId,token);assert.equal(result.myReactions.length,5);
    assert.ok(!("id" in result)&&!("userId" in result)&&!("bookmarkCount" in result));
    const sixth=codes.find(code=>!row.my_reactions.includes(code))!;
    await assert.rejects(()=>pool.query("INSERT INTO content_reactions(content_id,user_id,code) VALUES($1,$2,$3)",[id,user,sixth]),e=>(e as {constraint:string}).constraint==="reaction_selection_limit");
    const bookmark=await request(`/api/site/interactions/${token}/bookmark`,"PUT",{active:true},userToken);
    assert.equal(bookmark.status,200);assert.equal((await bookmark.json()).bookmarked,true);
    assert.equal((await select(row.my_reactions[0],false)).status,200);
    assert.equal((await pool.query("SELECT active FROM user_activities WHERE actor_id=$1 AND content_id=$2 AND kind='content_reacted'",[user,id])).rows[0].active,true);
    assert.equal((await select(sixth)).status,200);
    const mine=await getSiteInteractions(ownHeaders,{ids:[token,draftToken]});assert.equal(mine.items.length,1);assert.equal(mine.items[0].myReactions.length,5);assert.equal(mine.items[0].bookmarked,true);
    const other=await getSiteInteractions(new Headers({Authorization:"Bearer "+adminToken}),{ids:[token]});assert.deepEqual(other.items[0].myReactions,[]);assert.equal(other.items[0].bookmarked,false);
    assert.deepEqual(await getSiteInteractions(new Headers(),{ids:[token]}),{authenticated:false,items:[]});
    for(const code of mine.items[0].myReactions)assert.equal((await select(code,false)).status,200);
    assert.equal((await pool.query("SELECT active FROM user_activities WHERE actor_id=$1 AND content_id=$2 AND kind='content_reacted'",[user,id])).rows[0].active,false);
    await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[actor]);
    try{assert.equal((await select(codes[0])).status,404);assert.deepEqual((await getSiteInteractions(ownHeaders,{ids:[token]})).items,[]);}
    finally{await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[actor]);}
    await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[user]);
    try{assert.equal((await select(codes[0])).status,403);}
    finally{await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[user]);}
   }finally{await pool.query("DELETE FROM contents WHERE id=$1",[id]);await pool.query("DELETE FROM reaction_types WHERE code=ANY($1::text[])",[codes]);}
  });
  await t.test("public comment cards bind actions to the parent and preserve visibility and viewer privacy",async()=>{
   const content=await create();
   const root=(await pool.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,$2,'一级评论') RETURNING id::text",[content,actor])).rows[0].id as string;
   const reply=(await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,'二级回复',$3,$3) RETURNING id::text",[content,actor,root])).rows[0].id as string;
   const token=createShortPublicId(),otherToken=createShortPublicId();
   await savePublicRouteIds([{kind:"content",content_id:content,user_id:null,token},{kind:"content",content_id:archived,user_id:null,token:otherToken}]);
   const ownHeaders=new Headers({Authorization:"Bearer "+userToken});
   const page=await getSiteDiscussion(token,"article");
   const thread=page.threads.find(thread=>thread.comment.body==="一级评论")!;
   const commentToken=thread.replies[0].actionToken;
   const url=`/api/site/interactions/${token}/comments/reaction`;
   const payload={commentToken,value:{code:"like",active:true}};
   assert.equal((await request(url,"PUT",payload)).status,401);
   assert.equal((await request(url,"PUT",payload,userToken,"https://attacker.example")).status,403);
   assert.equal((await request(url,"PUT",{...payload,userId:actor},userToken)).status,400);
   assert.equal((await request(url,"PUT",{...payload,commentToken:thread.token},userToken)).status,400);
   assert.equal((await request(`/api/site/interactions/${otherToken}/comments/reaction`,"PUT",payload,userToken)).status,400);
   const result=await request(url,"PUT",payload,userToken);
   assert.equal(result.status,200);assert.match(result.headers.get("cache-control")??"",/no-store/);
   assert.ok((await result.json()).myReactions.includes("like"));
   assert.equal((await request(`/api/site/interactions/${token}/comments/bookmark`,"PUT",{commentToken,value:{active:true}},userToken)).status,200);
   const mine=await getSiteDiscussion(token,"article",{},ownHeaders);
   const own=mine.threads.find(thread=>thread.comment.body==="一级评论")!.replies[0].interaction;
   assert.ok(own.myReactions.includes("like"));assert.equal(own.bookmarked,true);
   const guest=(await getSiteDiscussion(token,"article")).threads.find(thread=>thread.comment.body==="一级评论")!.replies[0].interaction;
   assert.deepEqual(guest.myReactions,[]);assert.equal(guest.bookmarked,false);
   await pool.query("UPDATE comments SET status='hidden' WHERE id=$1",[root]);
   try{
    assert.equal((await request(url,"PUT",payload,userToken)).status,404);
    assert.equal((await readInteractionBatch(user,"comments",[reply],true)).length,0);
   }finally{await pool.query("UPDATE comments SET status='visible' WHERE id=$1",[root]);}
   await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[actor]);
   try{assert.equal((await request(url,"PUT",payload,userToken)).status,404);}
   finally{await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[actor]);}
  });
  await t.test("interaction write rate limits are shared across target types",async()=>{
   let limited=false;for(let i=0;i<62;i++){const response=await put(i%2?"content":"comments","999999999","reaction",{code:null});if(response.status===429){assert.ok(response.headers.get("retry-after"));limited=true;break;}assert.equal(response.status,200);}assert.ok(limited);
  });
 }finally{await pool.query("DELETE FROM contents WHERE id=ANY($1::bigint[])",[contents]);await pool.query("UPDATE reaction_types SET enabled=true,position=0 WHERE code='like'");await pool.query("DELETE FROM content_categories WHERE id=$1",[category]);}
}
