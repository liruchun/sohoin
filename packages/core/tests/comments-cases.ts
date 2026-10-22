import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {getPool} from "@sohoin/database";
import {listComments} from "../src/server/comments";
import {ServiceError} from "../src/server/security";
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function commentCases(t:TestContext,request:Requester,adminToken:string,userToken:string,actor:string){
 const pool=getPool();const contents:string[]=[];
 const content=async()=>{const id=(await pool.query("INSERT INTO contents(type,title,author_id,status) VALUES('article','评论管理验证',$1,'draft') RETURNING id::text",[actor])).rows[0].id as string;contents.push(id);return id;};
 const postId=await content(),otherId=await content();
 const insert=async(body:string,root?:string,target?:string,p=postId)=>(await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,$3,$4,$5) RETURNING id::text",[p,actor,body,root??null,target??null])).rows[0].id as string;
 const a=await insert("一级评论 <script>alert(1)</script>"),b=await insert("回复一级",a,a),c=await insert("回复二级",a,b),d=await insert("继续互相回复",a,c),x=await insert("另一个评论串");
 const endpoint=(id:string)=>"/api/v1/admin/comments/"+id;
 const get=async(id:string)=>(await (await request(endpoint(id),"GET",undefined,adminToken)).json()).comment;
 const patch=async(id:string,version:number,action:string)=>request(endpoint(id),"PATCH",{version,action},adminToken);
 try{
  await t.test("comment relationships enforce two levels and same-thread reply targets",async()=>{
   for(const create of [()=>insert("不能把二级当根",b,b),()=>insert("不能跨串",a,x),()=>insert("不能跨内容",a,b,otherId),()=>insert("x".repeat(5001))])await assert.rejects(create,e=>(e as {code:string}).code==="23514");
   await assert.rejects(()=>pool.query("UPDATE comments SET root_id=$2,reply_to_id=$2 WHERE id=$1",[b,x]),e=>(e as {code:string}).code==="23514");
   await assert.rejects(()=>pool.query("DELETE FROM comments WHERE id=$1",[a]),e=>(e as {code:string}).code==="23503");
   const context=await (await request(endpoint(d),"GET",undefined,adminToken)).json();assert.equal(context.root.id,a);assert.equal(context.replyTo.id,c);assert.equal(context.replies.items.length,3);assert.equal(context.comment.rootId,a);
  });
  await t.test("comment moderation checks Core authorization, origin, bounds and contracts",async()=>{
   for(const url of ["/api/v1/admin/comments",endpoint(a),"/api/v1/admin/audit/comments"]){assert.equal((await request(url)).status,401);assert.equal((await request(url,"GET",undefined,userToken)).status,403);}
   await assert.rejects(()=>listComments(new Headers(),{}),e=>e instanceof ServiceError&&e.status===401);
   assert.equal((await request(endpoint(a),"PATCH",{version:0,action:"hide"},userToken)).status,403);
   assert.equal((await request(endpoint(a),"PATCH",{version:0,action:"hide"},adminToken,"https://attacker.example")).status,403);
   for(const value of [{version:-1,action:"hide"},{version:0,action:"create"},{version:0,action:"hide",body:"injected"}])assert.equal((await request(endpoint(a),"PATCH",value,adminToken)).status,400);
   assert.equal((await request(endpoint(a),"PATCH",{version:0,action:"x".repeat(20000)},adminToken)).status,413);
   for(const q of ["?before=0","?contentId=-1","?status=bad","?q=hidden"]){assert.equal((await request("/api/v1/admin/comments"+q,"GET",undefined,adminToken)).status,400);}
   assert.equal((await request(endpoint("999999999"),"GET",undefined,adminToken)).status,404);
   assert.equal((await request("/api/v1/comments","POST",{},adminToken)).status,404);
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/admin/comments/{id}"].patch);
  });
  await t.test("single and whole-thread visibility restore independently without rewriting replies",async()=>{
   assert.equal((await patch(a,0,"hide")).status,200);assert.equal((await get(b)).threadHidden,false);assert.equal((await get(b)).status,"visible");
   assert.equal((await patch(b,0,"hide")).status,200);assert.equal((await patch(a,1,"hide_thread")).status,200);
   assert.equal((await get(c)).threadHidden,true);assert.equal((await get(c)).version,0);
   assert.equal((await patch(a,2,"restore")).status,200);assert.equal((await get(a)).threadHidden,true);
   assert.equal((await patch(a,3,"show_thread")).status,200);assert.equal((await get(b)).status,"hidden");assert.equal((await get(b)).threadHidden,false);
   assert.equal((await patch(b,1,"hide_thread")).status,409);
   const race=await Promise.all([patch(c,0,"hide"),patch(c,0,"delete")]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM comment_audit WHERE comment_id=$1",[c])).rows[0].n,1);
  });
  await t.test("deletion clears body and retains replies while rejecting replies to deleted targets",async()=>{
   assert.equal((await patch(a,4,"delete")).status,200);const deleted=await get(a);assert.equal(deleted.body,"");assert.equal(deleted.excerpt,"");assert.equal(deleted.status,"deleted");
   assert.equal((await pool.query("SELECT body FROM comments WHERE id=$1",[a])).rows[0].body,"");
   assert.equal((await get(d)).replyToId,c);assert.equal((await get(b)).rootId,a);
   assert.equal((await patch(a,5,"restore")).status,409);assert.equal((await patch(a,5,"hide_thread")).status,200);assert.equal((await get(d)).threadHidden,true);
   await assert.rejects(()=>insert("不能回复已删除正文",a,a),e=>(e as {code:string}).code==="23514");
   const live=await insert("可继续回复存活的二级评论",a,b);assert.equal((await get(live)).rootId,a);
   assert.equal((await patch(d,0,"delete")).status,200);assert.equal((await get(d)).body,"");
  });
  await t.test("comment lists are bounded and paginated; admin HTML escapes text",async()=>{
   await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) SELECT $1,$2,repeat('预览',1000),$3,$4 FROM generate_series(1,35)",[postId,actor,a,b]);
   const first=await (await request("/api/v1/admin/comments?contentId="+postId,"GET",undefined,adminToken)).json();assert.equal(first.items.length,30);assert.ok(first.nextCursor);assert.ok(!("body" in first.items[0]));assert.equal(first.items[0].excerpt.length,120);
   const second=await (await request("/api/v1/admin/comments?contentId="+postId+"&before="+first.nextCursor,"GET",undefined,adminToken)).json();assert.ok(second.items.length>0);assert.equal(new Set([...first.items,...second.items].map(row=>row.id)).size,first.items.length+second.items.length);
   const context=await (await request(endpoint(b),"GET",undefined,adminToken)).json();assert.equal(context.replies.items.length,30);assert.ok(context.replies.nextCursor);
   const html=await (await request("/admin/comments/"+x,"GET",undefined,adminToken)).text();assert.ok(html.includes("当前评论")&&html.includes("整个评论串"));
   const escaped=await insert('<img src=x onerror=alert(1)>');const safeHtml=await (await request("/admin/comments/"+escaped,"GET",undefined,adminToken)).text();assert.ok(safeHtml.includes("&lt;img"));assert.ok(!safeHtml.includes('<img src=x'));
   assert.equal((await request("/admin/comments")).status,307);
  });
  await t.test("content removal cascades whole comment threads while audit history survives",async()=>{
   const before=(await pool.query("SELECT count(*)::int AS n FROM comment_audit WHERE content_id=$1",[postId])).rows[0].n;assert.ok(before>0);
   await pool.query("DELETE FROM contents WHERE id=$1",[postId]);assert.equal((await pool.query("SELECT 1 FROM comments WHERE content_id=$1",[postId])).rowCount,0);
   const audit=await (await request("/api/v1/admin/audit/comments","GET",undefined,adminToken)).json();assert.ok(audit.items.some(item=>item.commentId===a&&item.action==="delete"));assert.ok(!JSON.stringify(audit).includes("alert(1)"));
   assert.equal((await pool.query("SELECT count(*)::int AS n FROM comment_audit WHERE content_id=$1",[postId])).rows[0].n,before);
  });
 }finally{await pool.query("DELETE FROM contents WHERE id=ANY($1::bigint[])",[contents]);}
}
