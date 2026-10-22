import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import {performance} from "node:perf_hooks";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {getPool,readFollowingActivities} from "@sohoin/database";
import {getAuth} from "../src/server/auth";

test("following feed foundation with 10000 follows and source-generated activity",{timeout:180000},async()=>{
 const database=decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1));if(!/^sohoin_test_[a-f0-9]{16}$/.test(database))throw new Error("Activity benchmark requires isolated test database");
 const pool=getPool(),started=performance.now(),password=randomBytes(18).toString("base64url");
 const viewer=await getAuth().api.createUser({body:{email:"activities-benchmark@example.test",password,name:"动态验证用户",role:"user"}});
 await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) SELECT 'a'||lpad(i::text,8,'0'),'用户'||i,'activity'||i||'@example.test',false,'user' FROM generate_series(1,30000) i`);
 await pool.query("INSERT INTO content_categories(name,slug) VALUES('动态测试','activities-benchmark')");
 await pool.query(`INSERT INTO contents(type,title,excerpt,body,category_id,status,author_id,published_at) SELECT 'post','帖子'||i,'动态摘要',repeat('正文',200),1,CASE WHEN i%10<7 THEN 'published' ELSE 'draft' END,'a'||lpad((1+i%30000)::text,8,'0'),CASE WHEN i%10<7 THEN now() END FROM generate_series(1,100000) i`);
 await pool.query(`INSERT INTO comments(content_id,author_id,body,status) SELECT i,'a'||lpad((1+i%30000)::text,8,'0'),repeat('评论',100),CASE WHEN i%13=0 THEN 'hidden' ELSE 'visible' END FROM generate_series(1,100000) i`);
 await pool.query(`INSERT INTO content_reactions(content_id,user_id,code) SELECT i,'a'||lpad((1+i%30000)::text,8,'0'),'like' FROM generate_series(1,100000) i`);
 await pool.query(`INSERT INTO comment_reactions(comment_id,user_id,code) SELECT i,'a'||lpad((1+i%30000)::text,8,'0'),'love' FROM generate_series(1,100000) i`);
 await pool.query(`INSERT INTO user_follows(follower_id,following_id) SELECT $1,'a'||lpad(i::text,8,'0') FROM generate_series(1,10000) i`,[viewer.user.id]);
 await pool.query("ANALYZE");
 const report={note:"Local warm-cache single-process foundation test, not production capacity proof or a latency SLA.",dataset:{follows:10000,users:30001,contents:100000,comments:100000,reactions:200000,activities:370000,additionalHiddenActivities:5000},seedMs:performance.now()-started,database:{} as Record<string,unknown>,http:{} as Record<string,unknown>,consecutivePages:0};
 const seen=new Set<string>();let cursor:string|undefined;
 for(let page=0;page<50;page++){
  const rows=await readFollowingActivities(viewer.user.id,cursor);assert.equal(rows.length,31);
  for(const row of rows.slice(0,30)){assert.ok(!seen.has(row.id));seen.add(row.id);assert.ok(Number(row.actor_id.slice(1))<=10000);if(cursor)assert.ok(BigInt(row.id)<BigInt(cursor));}
  cursor=rows[29].id;report.consecutivePages++;
 }
 const percentile=(values:number[],fraction:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*fraction)-1)];
 async function measure(name:string,who:string,before?:string){
  let captured:{sql:string;values:unknown[]}|undefined;const original=pool.query;
  (pool as any).query=function(sql:string,values:unknown[]){captured={sql,values};return (original as Function).call(pool,sql,values);};
  let sample;try{sample=await readFollowingActivities(who,before);}finally{pool.query=original;}
  const times:number[]=[];for(let i=0;i<20;i++){const start=performance.now();await readFollowingActivities(who,before);times.push(performance.now()-start);}
  const plan=(await pool.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+captured!.sql,captured!.values)).rows[0]["QUERY PLAN"][0];
  report.database[name]={p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),rows:sample.length,jsonBytes:Buffer.byteLength(JSON.stringify(sample)),plan};
 }
 await measure("first-page",viewer.user.id);await measure("after-50-pages",viewer.user.id,cursor);await measure("no-follows","a00030000");await measure("comment-created-range",viewer.user.id,"170001");await measure("publication-range",viewer.user.id,"70001");
 await pool.query(`INSERT INTO comments(content_id,author_id,body,status) SELECT 1,'a00000001','隐藏评论','hidden' FROM generate_series(1,5000)`);await pool.query("ANALYZE user_activities");
 await measure("newest-5000-hidden",viewer.user.id);const hiddenPage=await readFollowingActivities(viewer.user.id);assert.equal(hiddenPage.length,31);assert.ok(hiddenPage.every(row=>row.comment_excerpt!=="隐藏评论"));
 const root=path.resolve(import.meta.dirname,"../../.."),base="http://127.0.0.1:3196";const server=spawn(process.execPath,[path.join(root,"apps/web/node_modules/next/dist/bin/next"),"start","-p","3196","-H","127.0.0.1"],{cwd:path.join(root,"apps/web"),windowsHide:true,env:{...process.env,BETTER_AUTH_URL:base,NODE_ENV:"production"},stdio:["ignore","pipe","pipe"]});let ready=false;server.stdout.on("data",data=>{if(String(data).includes("Ready"))ready=true;});server.stderr.on("data",()=>{});
 try{
  for(let i=0;!ready&&i<100;i++){if(server.exitCode!==null)throw new Error("Activity benchmark server failed");await delay(100);}assert.ok(ready);
  const login=await fetch(base+"/api/auth/sign-in/email",{method:"POST",headers:{"Content-Type":"application/json",Origin:base},body:JSON.stringify({email:viewer.user.email,password})});assert.equal(login.status,200);const data=await login.json(),token=login.headers.get("set-auth-token")??data.token;assert.ok(token);
  for(const route of ["/api/v1/account/activities","/api/v1/account/activities?before="+cursor]){const times:number[]=[];let bytes=0;for(let i=0;i<21;i++){const start=performance.now(),response=await fetch(base+route,{headers:{Authorization:"Bearer "+token}});assert.equal(response.status,200);bytes=(await response.arrayBuffer()).byteLength;if(i)times.push(performance.now()-start);}report.http[route]={p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),responseBytes:bytes};}
 }finally{server.kill();await new Promise<void>(resolve=>{if(server.exitCode!==null)return resolve();server.once("exit",()=>resolve());});}
 await mkdir(path.join(root,".local/performance"),{recursive:true});await writeFile(path.join(root,".local/performance/following-activities.json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,database:Object.fromEntries(Object.entries(report.database).map(([name,value])=>{const {plan,...summary}=value as Record<string,unknown>;return [name,summary];}))},null,2));await pool.end();
});
