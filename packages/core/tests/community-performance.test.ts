import test from "node:test";
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {getPool,readContentList,readNotifications,unreadNotificationCount,markNotificationsRead,readProfile,writeProfile} from "@sohoin/database";
test("editorial, profile and notification bounded query benchmark",{timeout:180000},async()=>{
 if(!/^\/sohoin_test_[a-f0-9]{16}$/.test(new URL(process.env.DATABASE_URL!).pathname))throw new Error("Isolated database required");const pool=getPool();
 await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES('bench-admin','管理员','bench-admin@example.test',false,'admin'),('bench-user','用户','bench-user@example.test',false,'user')`);
 await pool.query("INSERT INTO content_categories(name,slug) VALUES('测试','community-bench')");
 await pool.query(`INSERT INTO contents(type,title,body,category_id,status,author_id,published_at,featured,featured_at,pin_level) SELECT 'article','内容'||i,'正文',1,'published','bench-user',now()-i*interval '1 second',i%10=0,CASE WHEN i%10=0 THEN now() END,CASE WHEN i%37=0 THEN 2 ELSE 0 END FROM generate_series(1,20000) i`);
 await pool.query("INSERT INTO notifications(recipient_id,actor_id,kind,system_key,title) SELECT CASE WHEN i<=5000 THEN 'bench-user' ELSE 'bench-admin' END,'bench-admin','system','bench-'||i,'系统通知'||i FROM generate_series(1,55000) i");
 await pool.query("INSERT INTO comments(content_id,author_id,body,status) SELECT 1,'bench-admin','隐藏评论','hidden' FROM generate_series(1,5000)");await pool.query("ANALYZE");
 await writeProfile("bench-admin","bench-user",{version:0,bio:"个人介绍",homepage:"https://example.test"},true);
 const report={dataset:{contents:20000,notifications:60000,recipientVisible:5000,recipientHidden:5000},note:"Local warm cache and one process; not production concurrency or a latency guarantee.",queries:{} as Record<string,unknown>};
 const cases:[string,()=>Promise<unknown>][]=[["priority-published",()=>readContentList({q:"",status:"published",sort:"priority"})],["priority-all",()=>readContentList({q:"",status:"all",sort:"priority"})],["updated",()=>readContentList({q:"",status:"published",sort:"updated"})],["featured",()=>readContentList({q:"",status:"published",featured:"yes"})],["notifications-first-hidden-prefix",()=>readNotifications("bench-user",{status:"all"})],["notifications-unread-count",()=>unreadNotificationCount("bench-user")],["profile",()=>readProfile("bench-user")]];
 for(const [name,run] of cases){const sample=await run(),times:number[]=[];for(let i=0;i<20;i++){const started=performance.now();await run();times.push(performance.now()-started);}times.sort((a,b)=>a-b);report.queries[name]={p50Ms:times[9],p95Ms:times[18],rows:Array.isArray(sample)?sample.length:1,jsonBytes:Buffer.byteLength(JSON.stringify(sample))};}
 assert.equal(await unreadNotificationCount("bench-user"),5000);const page=await readNotifications("bench-user",{status:"all"});assert.equal(page.length,31);assert.ok(page.every(item=>item.kind==="system"));
 const changed=await markNotificationsRead("bench-user",{ids:page.slice(0,30).map(item=>item.id)});assert.equal(changed.updated,30);assert.equal(await unreadNotificationCount("bench-user"),4970);
 const base=path.resolve(import.meta.dirname,"../../../.local/performance");await mkdir(base,{recursive:true});await writeFile(path.join(base,"community-admin.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await pool.end();
});
