import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import {performance} from "node:perf_hooks";
import path from "node:path";
import {mkdir,writeFile} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import {getPool,readContentList,readContent,readMediaList,readMediaReferences,readTerms,readManagedUsers,writeContent,deleteContent,readComments,readInteractionBatch,readOwnBookmarks,writeInteraction,readFollowStates,readOwnFollows,writeFollow} from "@sohoin/database";
import {getAuth} from "../src/server/auth";
test("isolated admin scale benchmark",{timeout:180000},async()=>{
 const label=process.env.BENCH_LABEL??"latest";if(!/^[a-z0-9-]{1,40}$/.test(label))throw new Error("Invalid benchmark label");
 const database=decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1));if(!/^sohoin_test_[a-f0-9]{16}$/.test(database))throw new Error("Benchmark requires runner-created database");
 const pool=getPool(),password=randomBytes(18).toString("base64url");const actor=await getAuth().api.createUser({body:{email:"benchmark@example.test",password,name:"验收管理员",role:"admin"}});
 const seeded=performance.now();
 await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role,banned) SELECT 'u'||lpad(i::text,8,'0'),'用户'||lpad(i::text,8,'0'),'user'||lpad(i::text,8,'0')||'@example.test',false,CASE WHEN i%1000=0 THEN 'admin' ELSE 'user' END,i%997=0 FROM generate_series(1,30000) i`);
 await pool.query("INSERT INTO content_categories(name,slug) SELECT '分类'||i,'category-'||i FROM generate_series(1,200) i");await pool.query("INSERT INTO content_tags(name,slug) SELECT '标签'||i,'tag-'||i FROM generate_series(1,503) i");
 await pool.query(`INSERT INTO contents(type,title,excerpt,body,category_id,status,author_id,published_at) SELECT CASE WHEN i%3=0 THEN 'article' ELSE 'post' END,CASE WHEN i%997=0 THEN 'Needle '||lpad(i::text,8,'0') ELSE '内容 '||lpad(i::text,8,'0') END,'简短摘要',repeat(md5(i::text),40),1+i%200,CASE WHEN i%10<6 THEN 'published' WHEN i%10<9 THEN 'draft' ELSE 'archived' END,$1,CASE WHEN i%10<6 THEN now() ELSE NULL END FROM generate_series(1,100000) i`,[actor.user.id]);
 await pool.query("INSERT INTO content_tag_links(content_id,tag_id) SELECT id,1+(id+offset_value)%503 FROM contents CROSS JOIN (VALUES(0),(7),(19)) offsets(offset_value)");
 await pool.query(`INSERT INTO media_assets(uploader_id,storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,width,height,status) SELECT $1,'test','benchmark','asset-'||i,'图片'||i,'image','image/webp',1024,640,400,'ready' FROM generate_series(1,20000) i`,[actor.user.id]);
 await pool.query("INSERT INTO content_media(content_id,media_id,role) SELECT id,CASE WHEN id<=60000 THEN 1 ELSE 1+id%20000 END,'cover' FROM contents");
 await pool.query("INSERT INTO comments(content_id,author_id,body,status) SELECT 1+i%10000,$1,repeat('评论正文',20),CASE WHEN i%19=0 THEN 'hidden' ELSE 'visible' END FROM generate_series(1,30000) i",[actor.user.id]);
 await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) SELECT 2,$1,repeat('相互回复',20),1,1 FROM generate_series(1,70000) i",[actor.user.id]);
 await pool.query(`INSERT INTO content_reactions(content_id,user_id,code) SELECT 1+i%10000,'u'||lpad((1+(i/10000))::text,8,'0'),'like' FROM generate_series(0,499999) i`);
 await pool.query(`INSERT INTO content_reactions(content_id,user_id,code) SELECT 2,'u'||lpad(i::text,8,'0'),'love' FROM generate_series(1,30000) i ON CONFLICT DO NOTHING`);
 await pool.query(`INSERT INTO comment_reactions(comment_id,user_id,code) SELECT 1+i%10000,'u'||lpad((1+(i/10000))::text,8,'0'),'like' FROM generate_series(0,99999) i`);
 await pool.query("INSERT INTO content_bookmarks(content_id,user_id) SELECT id,$1 FROM contents WHERE status='published' ORDER BY id LIMIT 10000",[actor.user.id]);
 await pool.query("INSERT INTO comment_bookmarks(comment_id,user_id) SELECT id,$1 FROM comments ORDER BY id LIMIT 10000",[actor.user.id]);
 await pool.query(`INSERT INTO user_follows(follower_id,following_id) SELECT 'u'||lpad((1+i%30000)::text,8,'0'),'u'||lpad((1+(i%30000+1+i/30000)%30000)::text,8,'0') FROM generate_series(0,499999) i`);
 await pool.query(`INSERT INTO user_follows(follower_id,following_id) SELECT $1,'u'||lpad(i::text,8,'0') FROM generate_series(1,5000) i`,[actor.user.id]);
 await pool.query(`INSERT INTO user_follows(follower_id,following_id) SELECT 'u'||lpad(i::text,8,'0'),$1 FROM generate_series(1,5000) i`,[actor.user.id]);
 await pool.query("ANALYZE");
 const report={label,seedMs:performance.now()-seeded,dataset:{contents:100000,users:30001,media:20000,tagLinks:300000,mediaLinks:100000,comments:100000,contentReactions:529950,commentReactions:100000,contentBookmarks:10000,commentBookmarks:10000,follows:510000},note:"Local PostgreSQL warm-cache, one process, bounded responses; not production SLA or capacity proof.",database:{} as Record<string,unknown>,http:{} as Record<string,unknown>};
 const sample=99000,filters={q:"",status:"published",type:"article",categoryId:String(1+sample%200),tagId:String(1+sample%503)};
 const cases:[string,()=>Promise<unknown>][]=[
  ["content-all",()=>readContentList({q:"",status:"all"})],["content-published",()=>readContentList({q:"",status:"published"})],
  ["content-title-prefix",()=>readContentList({q:"Needle",status:"all"})],["content-prefix-no-match",()=>readContentList({q:"absent",status:"all"})],
  ["content-category",()=>readContentList({q:"",status:"all",categoryId:"1"})],["content-tag",()=>readContentList({q:"",status:"all",tagId:"1"})],
  ["content-combined",()=>readContentList(filters)],["content-combined-deep",()=>readContentList({...filters,before:"20000"})],
  ["content-detail",()=>readContent("99000")],["users-first",()=>readManagedUsers({q:"",role:"all",status:"all"})],
  ["users-prefix",()=>readManagedUsers({q:"用户00001",role:"all",status:"all"})],["users-admin",()=>readManagedUsers({q:"",role:"admin",status:"all"})],
  ["users-banned",()=>readManagedUsers({q:"",role:"all",status:"banned"})],["media-first",()=>readMediaList()],
  ["media-hot-references",()=>readMediaReferences("1")],["media-deep-references",()=>readMediaReferences("1","20000")],
  ["comments-first",()=>readComments({status:"all"})],["comments-hidden",()=>readComments({status:"hidden"})],
  ["comments-content",()=>readComments({status:"all",contentId:"2"})],["comments-content-hidden",()=>readComments({status:"hidden",contentId:"2"})],
  ["comments-thread",()=>readComments({status:"all"},"1")],["comments-thread-deep",()=>readComments({status:"all",before:"50000"},"1")],
  ["interactions-content-batch",()=>readInteractionBatch(actor.user.id,"content",Array.from({length:30},(_,i)=>String(i+1)))],
  ["interactions-content-hot",()=>readInteractionBatch(actor.user.id,"content",["2"])],
  ["interactions-comment-batch",()=>readInteractionBatch(actor.user.id,"comments",Array.from({length:30},(_,i)=>String(i+1)))],
  ["bookmarks-content-first",()=>readOwnBookmarks(actor.user.id,"content")],
  ["bookmarks-content-deep",()=>readOwnBookmarks(actor.user.id,"content","5000")],
  ["bookmarks-comments-first",()=>readOwnBookmarks(actor.user.id,"comments")],
  ["follows-batch",()=>readFollowStates(actor.user.id,Array.from({length:30},(_,i)=>'u'+String(i+1).padStart(8,'0')))],
  ["follows-following",()=>readOwnFollows(actor.user.id,"following")],
  ["follows-followers",()=>readOwnFollows(actor.user.id,"followers")],
  ["follows-following-deep",()=>readOwnFollows(actor.user.id,"following","502500")],
  ["terms-prefix",()=>readTerms("tags","标签5")],
 ];
 const percentile=(values:number[],fraction:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*fraction)-1)];
 for(const [name,run] of cases){
  const original=pool.query;const captured:{sql:string;values?:unknown[]}[]=[];
  (pool as any).query=function(sql:string,...args:unknown[]){if(typeof sql==="string")captured.push({sql,values:Array.isArray(args[0])?args[0]:undefined});return (original as Function).call(pool,sql,...args);};
  let value:unknown;try{value=await run();}finally{pool.query=original;}
  const times:number[]=[];for(let i=0;i<20;i++){const started=performance.now();await run();times.push(performance.now()-started);}
  let plan:unknown;const statement=captured.find(x=>/^SELECT/i.test(x.sql));if(statement){const result=await pool.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+statement.sql,statement.values);plan=result.rows[0]["QUERY PLAN"][0];}
  report.database[name]={p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),queriesPerRead:captured.length,rows:Array.isArray(value)?value.length:1,jsonBytes:Buffer.byteLength(JSON.stringify(value)),plan};
 }
 const mutationTimes:number[]=[];for(let i=0;i<10;i++){const started=performance.now();const created=await writeContent(actor.user.id,{type:"article",title:"CRUD验证",body:"正文",excerpt:"",categoryId:"1",status:"draft",tagIds:["1","2"],media:[{mediaId:"2",role:"cover",altText:"",caption:""}]});await writeContent(actor.user.id,{type:"article",title:"更新验证",body:"正文更新",excerpt:"",categoryId:"1",status:"draft",tagIds:["2","3"],media:[]},created.id,0);await deleteContent(actor.user.id,created.id,1);mutationTimes.push(performance.now()-started);}report.database["content-create-update-delete"]={p50Ms:percentile(mutationTimes,.5),p95Ms:percentile(mutationTimes,.95),note:"Complete 3-operation transaction sequence including media binding and audits"};
 const interactionWrites:number[]=[];for(let i=0;i<10;i++){const started=performance.now();await writeInteraction(actor.user.id,"content","2",{code:"like"});await writeInteraction(actor.user.id,"content","2",{code:"love"});await writeInteraction(actor.user.id,"content","2",{code:null});interactionWrites.push(performance.now()-started);}report.database["interaction-create-switch-cancel"]={p50Ms:percentile(interactionWrites,.5),p95Ms:percentile(interactionWrites,.95),note:"Three complete transactions, including actor/type/visibility checks"};
 const followWrites:number[]=[];for(let i=0;i<10;i++){const started=performance.now();await writeFollow(actor.user.id,"u00020000",true);await writeFollow(actor.user.id,"u00020000",false);followWrites.push(performance.now()-started);}report.database["follow-create-cancel"]={p50Ms:percentile(followWrites,.5),p95Ms:percentile(followWrites,.95),note:"Two full transactions with permission gate and user checks"};
 const root=path.resolve(import.meta.dirname,"../../..");const base="http://127.0.0.1:3196";const server=spawn(process.execPath,[path.join(root,"apps/web/node_modules/next/dist/bin/next"),"start","-p","3196","-H","127.0.0.1"],{cwd:path.join(root,"apps/web"),env:{...process.env,BETTER_AUTH_URL:base,NODE_ENV:"production"},stdio:["ignore","pipe","pipe"],windowsHide:true});let ready=false;server.stdout.on("data",bytes=>{if(String(bytes).includes("Ready"))ready=true;});server.stderr.on("data",()=>{});
 try{for(let i=0;!ready&&i<100;i++){if(server.exitCode!==null)throw new Error("Benchmark server failed");await delay(100);}assert.ok(ready);const login=await fetch(base+"/api/auth/sign-in/email",{method:"POST",headers:{"Content-Type":"application/json",Origin:base},body:JSON.stringify({email:actor.user.email,password})});assert.equal(login.status,200);const data=await login.json();const token=login.headers.get("set-auth-token")??data.token;assert.ok(token);
  for(const route of ["/api/v1/admin/content","/api/v1/admin/content?q=Needle","/api/v1/admin/content?status=published&type=article&categoryId="+filters.categoryId+"&tagId="+filters.tagId,"/api/v1/admin/media/1","/api/v1/admin/users?role=admin","/api/v1/admin/comments","/api/v1/admin/comments?status=hidden&contentId=2","/api/v1/admin/comments/1","/api/v1/account/follows/following","/api/v1/account/follows/followers"]){const times:number[]=[];let size=0;for(let i=0;i<21;i++){const started=performance.now();const response=await fetch(base+route,{headers:{Authorization:"Bearer "+token}});assert.equal(response.status,200);const bytes=await response.arrayBuffer();size=bytes.byteLength;if(i)times.push(performance.now()-started);}report.http[route]={p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),responseBytes:size};}
  const bad=await fetch(base+"/admin/content?before=0",{headers:{Authorization:"Bearer "+token}});assert.equal(bad.status,200);assert.ok((await bad.text()).includes("筛选参数无效"));
 }finally{server.kill();await new Promise<void>(resolve=>{if(server.exitCode!==null)return resolve();server.once("exit",()=>resolve());});}
 await mkdir(path.join(root,".local/performance"),{recursive:true});await writeFile(path.join(root,".local/performance/admin-scale-"+label+".json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify({dataset:report.dataset,seedMs:report.seedMs,database:Object.fromEntries(Object.entries(report.database).map(([name,value])=>{const {plan,...summary}=value as Record<string,unknown>;return [name,summary];})),http:report.http},null,2));await pool.end();
});
