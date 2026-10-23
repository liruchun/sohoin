import './link-preview-cases';
import test from "node:test";
import {memberMediaCases} from './member-media-cases';
import {memberPublishingCases} from './member-publishing-cases';
import {logoCases} from "./logo-cases";
import {communityAdminCases} from "./community-admin-cases";
import {activityCases} from "./activities-cases";
import {followCases} from "./follows-cases";
import {pointsCases} from "./points-cases";
import {badgeCases} from "./badges-cases";
import {wornBadgeCases} from "./worn-badges-cases";
import {badgeAdminCases} from "./badges-admin-cases";
import {interactionCases} from "./interactions-cases";
import {commentCases} from "./comments-cases";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import path from "node:path";
import sharp from "sharp";
import {readdir} from "node:fs/promises";
import {uploadMedia} from "../src/server/media";
import {uploadMediaRequest} from "../src/server/media-http";
import {randomBytes} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {getPool,consumeLimit,acquireMediaStorageLock} from "@sohoin/database";
import {getAuth} from "../src/server/auth";
import {createSettingsService} from "../src/server/settings";
import {ServiceError,checkWriteOrigin,readJson} from "../src/server/security";
import {settingsPatchSchema,resolveSettings} from "@sohoin/extension-api/settings";
import {createContentService} from "../src/server/content";
import {getSiteFeed} from "../src/server/public-site";
import {listUsers,updateUser} from "../src/server/users";

test("shared Core security, content and HTTP integration",async t=>{
 process.env.PUBLIC_ID_SECRET??=randomBytes(32).toString("base64url");
 // Each case gets fresh counters in the runner's isolated database. This keeps
 // shared no-IP auth buckets from coupling otherwise independent login cases.
 t.beforeEach(async()=>{await getPool().query("DELETE FROM request_limits");});
 const base="http://127.0.0.1:3195";
 const original=(await getPool().query("SELECT value FROM site_settings WHERE id=1")).rows[0].value;
 const suffix=randomBytes(8).toString("hex");const password=randomBytes(18).toString("base64url");
 const admin=await getAuth().api.createUser({body:{email:"test-admin-"+suffix+"@example.test",password,name:"Security test",role:"admin"}});
 const user=await getAuth().api.createUser({body:{email:"test-user-"+suffix+"@example.test",password,name:"Security test",role:"user"}});
 const root=path.resolve(import.meta.dirname,"../../..");
 const server=spawn(process.execPath,[path.join(root,"apps/web/node_modules/next/dist/bin/next"),"start","-p","3195","-H","127.0.0.1"],{cwd:path.join(root,"apps/web"),windowsHide:true,env:{...process.env,BETTER_AUTH_URL:base,NODE_ENV:"production"},stdio:["ignore","pipe","pipe"]});
 let ready=false;server.stdout.on("data",data=>{if(String(data).includes("Ready"))ready=true;});server.stderr.on("data",()=>{});
 async function request(url:string,method="GET",body?:unknown,token?:string,origin:string|undefined=base){return fetch(base+url,{method,headers:{...(body!==undefined?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{}),...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:"manual"});}
 try {
  for(let i=0;!ready&&i<100;i++){if(server.exitCode!==null)throw new Error("Test server failed to start");await delay(200);}assert.ok(ready);
  let adminToken="",userToken="";
  await t.test("login issues sessions for website and APP",async()=>{
   for(const [email,isAdmin] of [[admin.user.email,true],[user.user.email,false]] as const){const response=await request("/api/auth/sign-in/email","POST",{email,password});assert.equal(response.status,200);const data=await response.json();const token=response.headers.get("set-auth-token")??data.token;assert.ok(token);if(isAdmin)adminToken=token;else userToken=token;assert.match(response.headers.get("set-cookie")??"",/HttpOnly/i);}
  });
  await t.test("anonymous and ordinary accounts cannot write; Core enforces the same rule",async()=>{
   assert.equal((await request("/api/v1/admin/site-settings")).status,401);
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision:0,patch:{}},userToken)).status,403);
   await assert.rejects(()=>createSettingsService().update(new Headers(),{revision:0,patch:{}}),e=>e instanceof ServiceError&&e.status===401);
   assert.equal((await request("/admin")).status,307);
   assert.equal((await request("/api/auth/sign-up/email","POST",{email:"new@example.test",password,name:"No"})).status,404);
  });
  let revision=0;
  await t.test("parameter allowlist, dangerous links, CSRF, body size",async()=>{
   const snapshot=await (await request("/api/v1/site-settings")).json();revision=snapshot.revision;
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision,patch:{role:"admin"}},adminToken)).status,400);
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision,patch:{navigation:[{label:"Bad",href:"javascript:alert(1)",visible:true}]}},adminToken)).status,400);
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision,patch:{}},adminToken,"https://attacker.example")).status,403);
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision,patch:{description:"a".repeat(20000)}},adminToken)).status,413);
   assert.throws(()=>checkWriteOrigin(new Request(base,{method:"POST",headers:{Cookie:"session=x"}})),ServiceError);
   await assert.rejects(()=>readJson(new Request(base,{method:"POST",headers:{"Content-Type":"application/json"},body:"{"})),ServiceError);
   for(const href of ["//evil.test","/\\evil.test","javascript:alert(1)","data:text/html,x"])assert.equal(settingsPatchSchema.safeParse({navigation:[{label:"x",href,visible:true}]}).success,false);
  });
  await t.test("save once updates public API, Core and the default public site metadata",async()=>{
   const patch={siteName:"集成验证社区",description:"保存后前台立即生效",custom:{headerNote:"来自后台的说明"},navigation:[{label:"阅读",href:"#notes",visible:true},{label:"隐藏项",href:"#topics",visible:false}]};
   const response=await request("/api/v1/admin/site-settings","PATCH",{revision,patch},adminToken,undefined);assert.equal(response.status,200);const result=await response.json();assert.equal(result.revision,revision+1);
   const publicSnapshot=await (await request("/api/v1/site-settings")).json();assert.equal(publicSnapshot.settings.siteName,patch.siteName);
   const customHtml=await (await request("/")).text();const coreHtml=await (await request("/?view=core")).text();
   assert.ok(!customHtml.includes("custom-navigation"));assert.ok(!coreHtml.includes("core-navigation"));
   assert.ok(customHtml.includes(patch.siteName)&&coreHtml.includes(patch.siteName));assert.equal(publicSnapshot.settings.custom.headerNote,patch.custom.headerNote);assert.match(customHtml,/<title>集成验证社区 · 推荐<\/title>/);
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision,patch},adminToken)).status,409);
   const audit=await getPool().query("SELECT 1 FROM settings_audit WHERE actor_id=$1",[admin.user.id]);assert.ok(audit.rowCount);
  });
  await t.test("concurrent writes have one winner and reject stale revision",async()=>{
   const current=await (await request("/api/v1/site-settings")).json();const responses=await Promise.all(["a","b"].map(description=>request("/api/v1/admin/site-settings","PATCH",{revision:current.revision,patch:{description}},adminToken)));
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  });
  await t.test("shared rate counters are atomic",async()=>{
   const results=await Promise.all(Array.from({length:10},()=>consumeLimit("test:"+suffix,60,3)));assert.equal(results.filter(x=>x.allowed).length,3);
  });
  await t.test("defaults preserve explicit empty strings and navigation arrays",()=>{
   const resolved=resolveSettings({description:"",navigation:[],custom:{headerNote:""}},{custom:{headerNote:"custom default"}});assert.equal(resolved.description,"");assert.equal(resolved.custom.headerNote,"");assert.deepEqual(resolved.navigation,[]);
  });
  await t.test("OpenAPI generated from shared schemas",async()=>{const response=await request("/api/openapi.json");assert.equal(response.status,200);const spec=await response.json();assert.equal(spec.openapi,"3.1.0");assert.ok(spec.paths["/api/v1/admin/site-settings"].patch.requestBody);});
  await t.test("audit permissions, cursor validation and bounded pagination",async()=>{
   assert.equal((await request("/api/v1/admin/audit")).status,401);
   assert.equal((await request("/api/v1/admin/audit","GET",undefined,userToken)).status,403);
   assert.equal((await request("/api/v1/admin/audit?before=0","GET",undefined,adminToken)).status,400);
   await getPool().query("INSERT INTO settings_audit (actor_id,before_value,after_value) SELECT $1,'{}'::jsonb,'{}'::jsonb FROM generate_series(1,35)",[admin.user.id]);
   const first=await (await request("/api/v1/admin/audit","GET",undefined,adminToken)).json();assert.equal(first.items.length,30);assert.ok(first.nextCursor);
   const second=await (await request("/api/v1/admin/audit?before="+first.nextCursor,"GET",undefined,adminToken)).json();assert.ok(second.items.length>0&&second.items.length<=30);assert.equal(second.nextCursor,null);
   assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,first.items.length+second.items.length);
   assert.ok(!("before_value" in first.items[0])&&!("after_value" in first.items[0]));
  });
  await commentCases(t,request,adminToken,userToken,admin.user.id);
  await interactionCases(t,request,adminToken,userToken,admin.user.id,user.user.id);
  await followCases(t,request,adminToken,userToken,admin.user.id,user.user.id);
  await pointsCases(t,adminToken,userToken,admin.user.id,user.user.id);
  await badgeCases(t,adminToken,userToken,admin.user.id,user.user.id);
  await badgeAdminCases(t,request,adminToken,userToken,user.user.id);
  await wornBadgeCases(t,request,adminToken,userToken,user.user.id);
  await activityCases(t,request,adminToken,userToken,admin.user.id,user.user.id);
  await communityAdminCases(t,request,adminToken,userToken,admin.user.id,user.user.id);
  await memberMediaCases(t,userToken,adminToken,user.user.id,admin.user.id);
  await memberPublishingCases(t,request,userToken,adminToken,user.user.id);
  await t.test("content and taxonomy permissions, contracts and body bounds",async()=>{
   const value={type:"article",title:"Draft",excerpt:"",body:"",categoryId:null,tagIds:[],status:"draft"};
   for(const path of ["/api/v1/admin/content","/api/v1/admin/taxonomies/categories","/api/v1/admin/audit/content"]){assert.equal((await request(path)).status,401);assert.equal((await request(path,"GET",undefined,userToken)).status,403);}
   assert.equal((await request("/api/v1/admin/content","POST",value,userToken)).status,403);
   assert.equal((await request("/api/v1/admin/content","POST",value,adminToken,"https://attacker.example")).status,403);
   for(const input of [{...value,authorId:user.user.id},{...value,type:"unknown"},{...value,status:"published"},{...value,body:"bad\u0000text"},{...value,tagIds:["1","1"]}])assert.equal((await request("/api/v1/admin/content","POST",input,adminToken)).status,400);
   assert.equal((await request("/api/v1/admin/content","POST",{...value,body:"x".repeat(300000)},adminToken)).status,413);
   assert.equal((await request("/api/v1/admin/taxonomies/user","POST",{name:"x",slug:"x",description:""},adminToken)).status,400);
   assert.equal((await request("/api/v1/content?status=draft")).status,400);
   await assert.rejects(()=>createContentService().create(new Headers(),value),e=>e instanceof ServiceError&&e.status===401);
   const types=await (await request("/api/v1/content-types")).json();assert.deepEqual(types,[{id:"article",label:"普通文章"},{id:"post",label:"社区帖子"}]);
  });
  await t.test("draft/publish/archive/delete, taxonomy constraints, XSS escaping and optimistic writes",async()=>{
   const term={name:"测试分类",slug:"category-"+suffix,description:"分类说明"};
   const categoryResponse=await request("/api/v1/admin/taxonomies/categories","POST",term,adminToken);assert.equal(categoryResponse.status,201);let category=await categoryResponse.json();
   const tagResponse=await request("/api/v1/admin/taxonomies/tags","POST",{name:"测试标签",slug:"tag-"+suffix,description:""},adminToken);assert.equal(tagResponse.status,201);const tag=await tagResponse.json();
   assert.equal((await request("/api/v1/admin/taxonomies/categories","POST",term,adminToken)).status,409);
   const termPath="/api/v1/admin/taxonomies/categories/"+category.id;
   const renamed=await request(termPath,"PATCH",{version:0,value:{...term,name:"社区板块"}},adminToken);assert.equal(renamed.status,200);category=await renamed.json();assert.equal(category.version,1);
   assert.equal((await request(termPath,"PATCH",{version:0,value:term},adminToken)).status,409);
   const value={type:"article",title:"测试发布 "+suffix,excerpt:"安全摘要",body:'正文 <img src=x onerror=alert(1)>\n下一行',categoryId:category.id,tagIds:[tag.id],status:"draft"};
   const created=await request("/api/v1/admin/content","POST",value,adminToken);assert.equal(created.status,201);let saved=await created.json();const path="/api/v1/admin/content/"+saved.id;
   const previewPath="/admin/content/"+saved.id+"/preview";
   assert.equal((await request(previewPath)).status,307);
   const forbiddenPreview=await (await request(previewPath,"GET",undefined,userToken)).text();assert.ok(!forbiddenPreview.includes(value.title)&&!forbiddenPreview.includes("&lt;img"));
   const previewResponse=await request(previewPath,"GET",undefined,adminToken);assert.equal(previewResponse.status,200);assert.match(previewResponse.headers.get("cache-control")??"",/no-store/);
   const previewHtml=await previewResponse.text();assert.ok(previewHtml.includes(value.title)&&previewHtml.includes("&lt;img"));assert.match(previewHtml,/noindex/);assert.ok(!previewHtml.includes('<img src=x'));
   const termDetail=await request(termPath,"GET",undefined,adminToken);assert.equal(termDetail.status,200);assert.equal((await termDetail.json()).name,"社区板块");assert.equal((await request(termPath)).status,401);assert.equal((await request(termPath,"GET",undefined,userToken)).status,403);
   assert.equal((await request("/api/v1/content/"+saved.id)).status,404);assert.equal((await request("/content/"+saved.id)).status,404);
   assert.equal((await request(termPath,"DELETE",{version:category.version},adminToken)).status,409);
   assert.equal((await request("/api/v1/admin/taxonomies/tags/"+tag.id,"DELETE",{version:0},adminToken)).status,409);
   assert.equal((await request(path,"PATCH",{version:0,value:{...value,categoryId:"99999999"}},adminToken)).status,400);
   const published=await request(path,"PATCH",{version:0,value:{...value,status:"published"}},adminToken);assert.equal(published.status,200);saved=await published.json();assert.equal(saved.version,1);
   const publicValue=await (await request("/api/v1/content/"+saved.id)).json();assert.equal(publicValue.body,value.body);assert.equal(publicValue.category.name,"社区板块");assert.equal(publicValue.tags[0].id,tag.id);assert.ok(!("version" in publicValue)&&!("author_id" in publicValue));
   const publicPage=(await getSiteFeed("latest")).items.find(item=>item.title===value.title)!;assert.ok(publicPage);const html=await (await request("/p/"+publicPage.publicId)).text();assert.ok(html.includes("&lt;img"));assert.ok(!html.includes('<img src=x'));assert.ok((await (await request("/?feed=latest")).text()).includes(value.title));
   const filtered=await (await request("/api/v1/content?categoryId="+category.id+"&tagId="+tag.id)).json();assert.equal(filtered.items.length,1);assert.ok(!("body" in filtered.items[0]));
   const filteredAdmin=await (await request("/api/v1/admin/content?categoryId="+category.id+"&tagId="+tag.id+"&status=published&type=article&q="+encodeURIComponent("测试发布"),"GET",undefined,adminToken)).json();assert.equal(filteredAdmin.items.length,1);assert.equal(filteredAdmin.items[0].id,saved.id);
   const filterHtml=await (await request("/admin/content?categoryId="+category.id+"&tagId="+tag.id+"&status=published&type=article","GET",undefined,adminToken)).text();assert.ok(filterHtml.includes("社区板块")&&filterHtml.includes("测试标签"));
   assert.equal((await request(path,"DELETE",{version:1},adminToken)).status,409);
   const writes=await Promise.all(["first","second"].map(excerpt=>request(path,"PATCH",{version:1,value:{...value,excerpt,status:"published"}},adminToken)));assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
   const archived=await request(path,"PATCH",{version:2,value:{...value,status:"archived"}},adminToken);assert.equal(archived.status,200);assert.equal((await request("/api/v1/content/"+saved.id)).status,404);assert.equal((await request("/content/"+saved.id)).status,404);
   assert.equal((await request(path,"DELETE",{version:2},adminToken)).status,409);assert.equal((await request(path,"DELETE",{version:3},adminToken)).status,200);
   assert.equal((await request(termPath,"DELETE",{version:category.version},adminToken)).status,200);assert.equal((await request("/api/v1/admin/taxonomies/tags/"+tag.id,"DELETE",{version:0},adminToken)).status,200);
   const audit=await (await request("/api/v1/admin/audit/content","GET",undefined,adminToken)).json();assert.ok(audit.items.some(item=>item.objectId===saved.id&&item.action==="deleted"));assert.ok(!JSON.stringify(audit).includes(value.body));
  });
  await t.test("content list pagination is bounded and custom types use the shared service",async()=>{
   const category=(await getPool().query("INSERT INTO content_categories(name,slug) VALUES('Paging',$1) RETURNING id::text",["paging-"+suffix])).rows[0];
   await getPool().query(`INSERT INTO contents(type,title,excerpt,body,category_id,status,author_id,published_at) SELECT 'article',$1,'excerpt','private body',$2,CASE WHEN i<=35 THEN 'published' ELSE 'draft' END,$3,NOW() FROM generate_series(1,40) i`,["Paging "+suffix,category.id,admin.user.id]);
   const endpoint="/api/v1/content?q="+encodeURIComponent("Paging "+suffix);const first=await (await request(endpoint)).json();assert.equal(first.items.length,30);assert.ok(first.nextCursor);
   const second=await (await request(endpoint+"&before="+first.nextCursor)).json();assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,35);assert.ok(!JSON.stringify(first).includes("private body"));
   const draft=await (await request("/api/v1/admin/content?status=draft","GET",undefined,adminToken)).json();assert.equal(draft.items.length,5);
   for(const q of ["%","_","' OR 1=1 --"]){const result=await (await request("/api/v1/content?q="+encodeURIComponent(q))).json();assert.equal(result.items.length,0);}
   const custom=createContentService([{id:"short-note",label:"短帖"}]);const adminHeaders=new Headers({Authorization:"Bearer "+adminToken});
   const note=await custom.create(adminHeaders,{type:"short-note",title:"Custom type",excerpt:"",body:"Plain text",categoryId:category.id,tagIds:[],status:"draft"});assert.equal(note.type,"short-note");assert.equal((await createContentService().get(adminHeaders,note.id)).type,"short-note");assert.throws(()=>createContentService([{id:"INVALID",label:"x"}]));
   await custom.remove(adminHeaders,note.id,{version:0});await getPool().query("DELETE FROM contents WHERE category_id=$1",[category.id]);await getPool().query("DELETE FROM content_categories WHERE id=$1",[category.id]);
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/admin/content"].post.requestBody);assert.ok(spec.paths["/api/v1/admin/taxonomies/{kind}/{id}"].delete);
  });
  await t.test("posts allow absent titles and keep bounded feed text separate from full detail",async()=>{
   const category=(await getPool().query("INSERT INTO content_categories(name,slug) VALUES('Posts',$1) RETURNING id::text",["posts-"+suffix])).rows[0];
   const value={type:"post",title:"",excerpt:"",body:"帖子正文 "+"内容".repeat(200),categoryId:category.id,tagIds:[],status:"published"};
   assert.equal((await request("/api/v1/admin/content","POST",{...value,type:"article"},adminToken)).status,400);
   assert.equal((await request("/api/v1/admin/content","POST",{...value,body:"",status:"draft"},adminToken)).status,400);
   const response=await request("/api/v1/admin/content","POST",value,adminToken);assert.equal(response.status,201);const post=await response.json();assert.equal(post.title,"");assert.equal(post.excerpt,"");
   const feed=await (await request("/api/v1/content?type=post&categoryId="+category.id)).json();assert.equal(feed.items.length,1);assert.equal(feed.items[0].excerpt,value.body.slice(0,280));assert.ok(!("body" in feed.items[0])&&!("data" in feed.items[0]));
   const detail=await (await request("/api/v1/content/"+post.id)).json();assert.equal(detail.body,value.body);assert.equal(detail.excerpt,"");assert.deepEqual(detail.data,{});
   const publicPost=(await getSiteFeed("latest")).items.find(item=>item.body===value.body)!;assert.ok(publicPost);const html=await (await request("/threads/"+publicPost.publicId)).text();assert.ok(html.includes("帖子正文"));assert.equal((await request("/content/"+post.id)).status,404);
   const updated=await request("/api/v1/admin/content/"+post.id,"PATCH",{version:0,value:{...value,body:"更新后的短帖"}},adminToken);assert.equal(updated.status,200);
   const fresh=await (await request("/api/v1/content?type=post&categoryId="+category.id)).json();assert.equal(fresh.items[0].excerpt,"更新后的短帖");
   await getPool().query("DELETE FROM contents WHERE id=$1",[post.id]);await getPool().query("DELETE FROM content_categories WHERE id=$1",[category.id]);
  });
  await t.test("typed extensions validate, remain private by default and share optimistic transactions",async()=>{
   const fields={publicSummary:{kind:"text",maxLength:80,public:true,required:true},staffNote:{kind:"text",maxLength:120},score:{kind:"number",min:0,max:100,integer:true},layout:{kind:"enum",options:["normal","compact"],public:true}} as const;
   const custom=createContentService([{id:"resource-note",label:"资源笔记",extension:{schemaVersion:1,fields}}]);const adminHeaders=new Headers({Authorization:"Bearer "+adminToken});
   const category=(await getPool().query("INSERT INTO content_categories(name,slug) VALUES('Extension',$1) RETURNING id::text",["extension-"+suffix])).rows[0];
   const value={type:"resource-note",title:"Extension "+suffix,excerpt:"",body:"Plain text",categoryId:category.id,tagIds:[],status:"published",data:{publicSummary:"公开简介",staffNote:"internal-only-marker",score:50,layout:"compact"}};
   const note=await custom.create(adminHeaders,value);assert.equal(note.dataSchemaVersion,1);assert.equal(note.data.staffNote,"internal-only-marker");
   const publicValue=await custom.getPublic(note.id);assert.deepEqual(publicValue.data,{publicSummary:"公开简介",layout:"compact"});
   const hostPublic=await (await request("/api/v1/content/"+note.id)).json();assert.deepEqual(hostPublic.data,{});assert.ok(!JSON.stringify(hostPublic).includes("internal-only-marker"));
   const list=await custom.list(adminHeaders,{categoryId:category.id});assert.ok(!("data" in list.items[0])&&!("dataSchemaVersion" in list.items[0]));
   const {data,...withoutData}=value;
   for(const bad of [withoutData,{...value,data:{...data,unknown:true}},{...value,data:{...data,score:101}},{...value,data:{...data,layout:"wide"}},{...value,data:{staffNote:"missing required"}}])await assert.rejects(()=>custom.update(adminHeaders,note.id,{version:0,value:bad}),e=>e instanceof ServiceError&&e.status===400);
   const writes=await Promise.allSettled(["a","b"].map(staffNote=>custom.update(adminHeaders,note.id,{version:0,value:{...value,data:{...data,staffNote}}})));assert.equal(writes.filter(result=>result.status==="fulfilled").length,1);assert.ok(writes.some(result=>result.status==="rejected"&&result.reason instanceof ServiceError&&result.reason.status===409));
   const current=await custom.get(adminHeaders,note.id);assert.equal(current.version,1);assert.equal((await getPool().query("SELECT schema_version FROM content_extensions WHERE content_id=$1",[note.id])).rows[0].schema_version,1);
   const newer=createContentService([{id:"resource-note",label:"资源笔记",extension:{schemaVersion:2,fields}}]);assert.deepEqual((await newer.getPublic(note.id)).data,{});await assert.rejects(()=>newer.update(adminHeaders,note.id,{version:1,value}),e=>e instanceof ServiceError&&e.status===409);assert.equal((await custom.get(adminHeaders,note.id)).version,1);
   assert.throws(()=>createContentService([{id:"invalid-field",label:"Bad",extension:{schemaVersion:1,fields:{constructor:{kind:"boolean"}}}}]));
   assert.equal((await request("/api/v1/admin/content","POST",{...value,type:"article"},adminToken)).status,400);
   await custom.update(adminHeaders,note.id,{version:1,value:{...value,status:"archived"}});await custom.remove(adminHeaders,note.id,{version:2});assert.equal((await getPool().query("SELECT 1 FROM content_extensions WHERE content_id=$1",[note.id])).rowCount,0);await getPool().query("DELETE FROM content_categories WHERE id=$1",[category.id]);
  });
  await t.test("media metadata constraints, unique covers and shared asset deletion protection",async()=>{
   const asset=(await getPool().query(`INSERT INTO media_assets(uploader_id,storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,width,height,status) VALUES($1,'local','original',$2,'photo.jpg','image','image/jpeg',2048,800,600,'ready') RETURNING id::text`,[admin.user.id,"photo-"+suffix])).rows[0];
   await assert.rejects(()=>getPool().query(`INSERT INTO media_assets(storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,status) VALUES('local','original',$1,'bad.jpg','image','image/jpeg',100,'ready')`,["bad-"+suffix]),e=>e.code==="23514");
   await assert.rejects(()=>getPool().query(`INSERT INTO media_variants(media_id,variant_key,storage_provider,storage_namespace,storage_key,mime_type,byte_size,width,height,status) VALUES($1,'thumb','local','derived',$2,'image/webp',100,0,100,'ready')`,[asset.id,"bad-thumb-"+suffix]),e=>e.code==="23514");
   await getPool().query(`INSERT INTO media_variants(media_id,variant_key,storage_provider,storage_namespace,storage_key,mime_type,byte_size,width,height,status) VALUES($1,'thumb-webp','local','derived',$2,'image/webp',800,320,240,'ready')`,[asset.id,"thumb-"+suffix]);
   const post=(await getPool().query("INSERT INTO contents(type,title,body,status,author_id) VALUES('post','','Media body','draft',$1) RETURNING id::text",[admin.user.id])).rows[0];
   await getPool().query("INSERT INTO content_media(content_id,media_id,role,position,alt_text) VALUES($1,$2,'cover',0,'封面')",[post.id,asset.id]);
   await assert.rejects(()=>getPool().query("INSERT INTO content_media(content_id,media_id,role,position) VALUES($1,$2,'cover',0)",[post.id,asset.id]),e=>e.code==="23505");
   await assert.rejects(()=>getPool().query("DELETE FROM media_assets WHERE id=$1",[asset.id]),e=>e.code==="23503");
   await getPool().query("INSERT INTO content_media(content_id,media_id,role,position,caption) VALUES($1,$2,'gallery',0,'另一处说明')",[post.id,asset.id]);
   assert.equal((await getPool().query("SELECT 1 FROM content_media WHERE media_id=$1",[asset.id])).rowCount,2);
   await getPool().query("DELETE FROM contents WHERE id=$1",[post.id]);assert.equal((await getPool().query("SELECT 1 FROM content_media WHERE content_id=$1",[post.id])).rowCount,0);assert.equal((await getPool().query("SELECT 1 FROM media_assets WHERE id=$1",[asset.id])).rowCount,1);
   await getPool().query("DELETE FROM media_assets WHERE id=$1",[asset.id]);assert.equal((await getPool().query("SELECT 1 FROM media_variants WHERE media_id=$1",[asset.id])).rowCount,0);
  });
  await t.test("image uploads authorize before reading and reject invalid raster input",async()=>{
   const existing=(await getPool().query("SELECT id::text FROM media_assets WHERE uploader_id=$1 ORDER BY id",[admin.user.id])).rows;
   const url="/api/v1/admin/media";const png=await sharp({create:{width:20,height:10,channels:3,background:"white"}}).png().toBuffer();
   async function send(bytes:Uint8Array,mime:string,token=adminToken,origin=base,name="测试.png"){return fetch(base+url,{method:"POST",headers:{Authorization:"Bearer "+token,Origin:origin,"Content-Type":mime,"X-File-Name":encodeURIComponent(name)},body:bytes});}
   assert.equal((await request(url)).status,401);assert.equal((await request(url,"GET",undefined,userToken)).status,403);
   assert.equal((await send(png,"image/png",userToken)).status,403);assert.equal((await send(png,"image/png",adminToken,"https://evil.test")).status,403);
   let read=false;await assert.rejects(()=>uploadMedia(new Headers(),{name:"test.png",mime:"image/png",read:async()=>{read=true;return png;}}),e=>e instanceof ServiceError&&e.status===401);assert.equal(read,false);
   assert.equal((await send(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),"image/png")).status,415);
   assert.equal((await send(png,"image/jpeg")).status,415);assert.equal((await send(png,"image/svg+xml")).status,415);
   assert.equal((await send(png.subarray(0,24),"image/png")).status,400);assert.equal((await send(png,"image/png",adminToken,base,"../escape.png")).status,400);
   const authHeaders=new Headers({Authorization:"Bearer "+adminToken,"Content-Type":"image/png","X-File-Name":"test.png","Content-Length":String(10*1024*1024+1)});
   await assert.rejects(()=>uploadMediaRequest(new Request(base+url,{method:"POST",headers:authHeaders,body:png})),e=>e instanceof ServiceError&&e.status===413);
   const largeStream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(10*1024*1024));controller.enqueue(new Uint8Array(1));controller.close();}});
   authHeaders.delete("Content-Length");await assert.rejects(()=>uploadMediaRequest(new Request(base+url,{method:"POST",headers:authHeaders,body:largeStream,duplex:"half"} as RequestInit)),e=>e instanceof ServiceError&&e.status===413);
   assert.deepEqual((await getPool().query("SELECT id::text FROM media_assets WHERE uploader_id=$1 ORDER BY id",[admin.user.id])).rows,existing);
  });
  await t.test("images are re-encoded, private, bounded, audited and protected while referenced",async()=>{
   const existingFiles=(await readdir(process.env.MEDIA_STORAGE_DIR!,{recursive:true})).filter(file=>/\.webp$/.test(file)).sort();
   const bytes=await sharp({create:{width:1200,height:800,channels:3,background:"white"}}).withMetadata({exif:{IFD0:{Copyright:"private-test"}}}).png().toBuffer();
   const uploaded=await fetch(base+"/api/v1/admin/media",{method:"POST",headers:{Authorization:"Bearer "+adminToken,"Content-Type":"image/png","X-File-Name":encodeURIComponent("图片.png")},body:bytes});assert.equal(uploaded.status,201);const image=await uploaded.json();assert.equal(image.mimeType,"image/webp");assert.equal(image.width,1200);assert.equal(image.height,800);assert.equal(image.version,1);assert.ok(!("storage_key" in image)&&!JSON.stringify(image).includes(process.env.MEDIA_STORAGE_DIR!));
   const first=await (await request("/api/v1/admin/media","GET",undefined,adminToken)).json();assert.ok(first.items.some(item=>item.id===image.id));assert.equal((await request("/api/v1/admin/media?before=0","GET",undefined,adminToken)).status,400);
   assert.equal((await request(image.fileUrl)).status,401);assert.equal((await request(image.fileUrl,"GET",undefined,userToken)).status,403);
   const file=await request(image.fileUrl,"GET",undefined,adminToken);assert.equal(file.status,200);assert.match(file.headers.get("cache-control")!,/no-store/);assert.equal(file.headers.get("x-content-type-options"),"nosniff");const decoded=await sharp(Buffer.from(await file.arrayBuffer())).metadata();assert.equal(decoded.width,1200);assert.equal(decoded.format,"webp");assert.equal(decoded.exif,undefined);assert.equal(decoded.icc,undefined);
   const thumbnail=await request(image.previewUrl,"GET",undefined,adminToken);const thumb=await sharp(Buffer.from(await thumbnail.arrayBuffer())).metadata();assert.ok(thumb.width!<=480&&thumb.height!<=480);
   assert.equal((await request(image.fileUrl+"?variant=../../secret","GET",undefined,adminToken)).status,400);
   const deletePath="/api/v1/admin/media/"+image.id;assert.equal((await request(deletePath,"DELETE",{version:1},adminToken,"https://evil.test")).status,403);assert.equal((await request(deletePath,"DELETE",{version:1},userToken)).status,403);assert.equal((await request(deletePath,"DELETE",{version:2},adminToken)).status,409);
   const content=(await getPool().query("INSERT INTO contents(type,title,body,status,author_id) VALUES('article','Image reference','body','draft',$1) RETURNING id",[admin.user.id])).rows[0];await getPool().query("INSERT INTO content_media(content_id,media_id,role) VALUES($1,$2,'cover')",[content.id,image.id]);
   assert.equal((await request(deletePath,"DELETE",{version:1},adminToken)).status,409);assert.equal((await request(image.fileUrl,"GET",undefined,adminToken)).status,200);
   await getPool().query("DELETE FROM contents WHERE id=$1",[content.id]);const deleted=await request(deletePath,"DELETE",{version:1},adminToken);assert.equal(deleted.status,200);assert.deepEqual(await deleted.json(),{deleted:true,cleanupPending:false});assert.equal((await request(image.fileUrl,"GET",undefined,adminToken)).status,404);assert.equal((await request(deletePath,"DELETE",{version:1},adminToken)).status,404);
   const audits=await getPool().query("SELECT action FROM media_audit WHERE media_id=$1 ORDER BY id",[image.id]);assert.deepEqual(audits.rows.map(row=>row.action),["uploaded","deleted"]);
   const remaining=await readdir(process.env.MEDIA_STORAGE_DIR!,{recursive:true});assert.deepEqual(remaining.filter(file=>/\.webp$/.test(file)).sort(),existingFiles);
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/admin/media"].post.requestBody.content["image/png"]);
  });
  await logoCases(t,{base,request,adminToken,userToken});
  await t.test("media pagination is bounded and hides tombstones and storage locations",async()=>{
   await getPool().query(`INSERT INTO media_assets(uploader_id,storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,width,height,status) SELECT $1,'test','pagination','key-'||i,'item-'||i,'image','image/webp',10,1,1,'ready' FROM generate_series(1,35) i`,[admin.user.id]);
   const expected=(await getPool().query("SELECT m.id::text FROM media_assets m WHERE m.status='ready' ORDER BY m.id DESC")).rows.map(row=>row.id as string);
   const seen:string[]=[];let before:string|null=null;
   for(let offset=0;offset<expected.length;offset+=30){
    const response=await request("/api/v1/admin/media"+(before?"?before="+before:""),"GET",undefined,adminToken);assert.equal(response.status,200);
    const page=await response.json();const ids=page.items.map((item:{id:string})=>item.id);
    assert.deepEqual(ids,expected.slice(offset,offset+30));
    assert.ok(!JSON.stringify(page).includes("storage_"));
    seen.push(...ids);before=page.nextCursor;
    assert.equal(before,offset+30<expected.length?ids[ids.length-1]:null);
   }
   assert.equal(new Set(seen).size,expected.length);
   await getPool().query("DELETE FROM media_assets WHERE storage_provider='test' AND storage_namespace='pagination'");
  });
  await t.test("maintenance blocks media mutations before receiving input while reads stay available",async()=>{
   const release=await acquireMediaStorageLock(true);try{const response=await fetch(base+"/api/v1/admin/media",{method:"POST",headers:{Authorization:"Bearer "+adminToken,"Content-Type":"image/png","X-File-Name":"maintenance.png"},body:Buffer.from("not decoded during maintenance")});assert.equal(response.status,503);assert.equal((await response.json()).error.code,"MEDIA_MAINTENANCE");assert.equal(response.headers.get("retry-after"),"5");assert.equal((await request("/api/v1/admin/media/1","DELETE",{version:1},adminToken)).status,503);assert.equal((await request("/api/v1/admin/media","GET",undefined,adminToken)).status,200);}finally{await release();}
  });
  async function bindingAsset(key:string){return (await getPool().query(`INSERT INTO media_assets(uploader_id,storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,width,height,status) VALUES($1,'test','bindings',$2,'绑定测试','image','image/webp',10,10,10,'ready') RETURNING id::text`,[admin.user.id,suffix+key])).rows[0].id as string;}
  await t.test("content media preserves omitted fields, validates references and saves ordered metadata atomically",async()=>{
   const a=await bindingAsset("a"),b=await bindingAsset("b");const link=(mediaId:string,role="gallery",caption="")=>({mediaId,role,altText:"替代文本",caption});const value={type:"article",title:"媒体关联",body:"正文",excerpt:"",status:"draft",categoryId:null,tagIds:[],media:[link(a,"cover"),link(b,"gallery","第二张"),link(a,"gallery","第一张"),link(a,"attachment")]};
   const created=await request("/api/v1/admin/content","POST",value,adminToken);assert.equal(created.status,201);let saved=await created.json();const url="/api/v1/admin/content/"+saved.id;
   assert.deepEqual(saved.media.filter(i=>i.role==="gallery").map(i=>i.mediaId),[b,a]);assert.equal(saved.media.find(i=>i.role==="gallery"&&i.mediaId===b).caption,"第二张");
   const {media,...legacy}=value;const retained=await request(url,"PATCH",{version:0,value:legacy},adminToken);assert.equal(retained.status,200);saved=await retained.json();assert.equal(saved.media.length,4);
   for(const invalid of [[link(a,"cover"),link(b,"cover")],[link(a),link(a)],[link(a,"invalid")],Array.from({length:11},(_,i)=>link(String(1000+i)))])assert.equal((await request(url,"PATCH",{version:1,value:{...legacy,media:invalid}},adminToken)).status,400);
   const beforeAudit=(await getPool().query("SELECT count(*)::int AS n FROM content_audit WHERE object_id=$1 AND kind='content'",[saved.id])).rows[0].n;
   assert.equal((await request(url,"PATCH",{version:1,value:{...legacy,title:"不应保存",media:[link("9223372036854775807")]}},adminToken)).status,400);
   const unchanged=await (await request(url,"GET",undefined,adminToken)).json();assert.equal(unchanged.version,1);assert.equal(unchanged.title,legacy.title);assert.equal(unchanged.media.length,4);assert.equal((await getPool().query("SELECT count(*)::int AS n FROM content_audit WHERE object_id=$1 AND kind='content'",[saved.id])).rows[0].n,beforeAudit);
   const refs=await (await request("/api/v1/admin/media/"+a,"GET",undefined,adminToken)).json();assert.equal(refs.references.items.length,3);assert.ok(refs.references.items.every(i=>i.contentId===saved.id));assert.ok(!JSON.stringify(refs).includes("storage_"));
   const rows=await (await request("/api/v1/admin/content","GET",undefined,adminToken)).json();assert.ok(!("media" in rows.items.find(i=>i.id===saved.id)));
   const reordered=await request(url,"PATCH",{version:1,value:{...legacy,media:[link(a),link(b)]}},adminToken);assert.equal(reordered.status,200);assert.deepEqual((await reordered.json()).media.map(i=>i.mediaId),[a,b]);
   assert.equal((await request(url,"PATCH",{version:1,value:{...legacy,media:[]}},adminToken)).status,409);
   assert.equal((await request(url,"PATCH",{version:2,value:{...legacy,media:[]}},adminToken)).status,200);assert.equal((await getPool().query("SELECT 1 FROM content_media WHERE content_id=$1",[saved.id])).rowCount,0);
   await getPool().query("DELETE FROM contents WHERE id=$1",[saved.id]);await getPool().query("DELETE FROM media_assets WHERE id=ANY($1::bigint[])",[[a,b]]);
  });
  await t.test("private media references page independently and audit records survive deleted assets",async()=>{
   const id=await bindingAsset("references");const url="/api/v1/admin/media/"+id;
   for(const route of [url,"/api/v1/admin/audit/media"]){assert.equal((await request(route)).status,401);assert.equal((await request(route,"GET",undefined,userToken)).status,403);assert.equal((await request(route+"?before=0","GET",undefined,adminToken)).status,400);}
   await getPool().query(`WITH inserted AS (INSERT INTO contents(type,title,body,status,author_id) SELECT 'post','','引用明细帖子','draft',$1 FROM generate_series(1,35) RETURNING id) INSERT INTO content_media(content_id,media_id,role) SELECT id,$2,'cover' FROM inserted`,[admin.user.id,id]);
   const first=await (await request(url,"GET",undefined,adminToken)).json();assert.equal(first.references.items.length,30);assert.ok(first.references.nextCursor);assert.ok(first.references.items.every(i=>i.title==="引用明细帖子"&&i.status==="draft"));
   const second=await (await request(url+"?before="+first.references.nextCursor,"GET",undefined,adminToken)).json();assert.equal(second.references.items.length,5);assert.equal(new Set([...first.references.items,...second.references.items].map(i=>i.id)).size,35);
   await getPool().query("DELETE FROM contents WHERE id IN (SELECT content_id FROM content_media WHERE media_id=$1)",[id]);await getPool().query("DELETE FROM media_assets WHERE id=$1",[id]);
   await getPool().query("INSERT INTO media_audit(actor_id,media_id,label,action) SELECT $1,$2,'已删除媒体','deleted' FROM generate_series(1,35)",[admin.user.id,id]);
   const audit=await (await request("/api/v1/admin/audit/media","GET",undefined,adminToken)).json();assert.equal(audit.items.length,30);assert.ok(audit.nextCursor);assert.ok(audit.items.every(i=>i.mediaId===id));const older=await (await request("/api/v1/admin/audit/media?before="+audit.nextCursor,"GET",undefined,adminToken)).json();assert.ok(older.items.length>=5);assert.ok(!JSON.stringify(audit).includes("storage_"));
   assert.equal((await request(url,"GET",undefined,adminToken)).status,404);const html=await (await request("/admin/audit?type=media","GET",undefined,adminToken)).text();assert.ok(html.includes("已删除媒体"));
  });
  await t.test("binding and deletion serialize and never leave a reference to a tombstoned image",async()=>{
   for(let iteration=0;iteration<3;iteration++){const id=await bindingAsset("race"+iteration);const value={type:"article",title:"并发媒体关联",body:"",excerpt:"",status:"draft",categoryId:null,tagIds:[],media:[{mediaId:id,role:"cover",altText:"",caption:""}]};const [binding,removal]=await Promise.all([request("/api/v1/admin/content","POST",value,adminToken),request("/api/v1/admin/media/"+id,"DELETE",{version:1},adminToken)]);
    if(binding.status===201){assert.equal(removal.status,409);const content=await binding.json();assert.equal((await getPool().query("SELECT status FROM media_assets WHERE id=$1",[id])).rows[0].status,"ready");await getPool().query("DELETE FROM contents WHERE id=$1",[content.id]);}
    else{assert.equal(binding.status,400);assert.equal(removal.status,200);assert.equal((await getPool().query("SELECT 1 FROM content_media WHERE media_id=$1",[id])).rowCount,0);}
    await getPool().query("DELETE FROM media_assets WHERE id=$1",[id]);
   }
  });
  await t.test("user management enforces permissions, CSRF and patch allowlists",async()=>{
   const endpoint="/api/v1/admin/users/"+user.user.id;
   assert.equal((await request("/api/v1/admin/users")).status,401);
   assert.equal((await request("/api/v1/admin/users","GET",undefined,userToken)).status,403);
   assert.equal((await request(endpoint,"PATCH",{version:0,patch:{role:"admin"}},userToken)).status,403);
   await assert.rejects(()=>listUsers(new Headers(),{}),e=>e instanceof ServiceError&&e.status===401);
   await assert.rejects(()=>updateUser(new Headers(),user.user.id,{version:0,patch:{role:"admin"}}),e=>e instanceof ServiceError&&e.status===401);
   assert.equal((await request(endpoint,"PATCH",{version:0,patch:{banned:true}},adminToken,"https://attacker.example")).status,403);
   for(const patch of [{email:"hijack@example.test"},{password:"replacement"},{role:"superadmin"},{}])assert.equal((await request(endpoint,"PATCH",{version:0,patch},adminToken)).status,400);
   assert.equal((await request("/api/v1/admin/users?role=superadmin","GET",undefined,adminToken)).status,400);
   assert.equal((await request("/api/v1/admin/users/not_existing","GET",undefined,adminToken)).status,404);
   assert.equal((await request("/api/auth/admin/set-role","POST",{userId:user.user.id,role:"admin"},adminToken)).status,404);
   const detail=await (await request(endpoint,"GET",undefined,adminToken)).json();
   assert.deepEqual(Object.keys(detail).sort(),["id","name","email","emailVerified","role","banned","banReason","createdAt","updatedAt","version"].sort());
  });
  await t.test("user search is literal, filtered and bounded with nonoverlapping cursor pages",async()=>{
   await getPool().query(`INSERT INTO "user"(id,name,email,"emailVerified",role,banned) SELECT 'paging-'||$1||'-'||lpad(i::text,3,'0'),'Paging '||$1,'paging-'||$1||'-'||i||'@example.test',false,'user',i%2=0 FROM generate_series(1,35) i`,[suffix]);
   const endpoint="/api/v1/admin/users?q="+encodeURIComponent("Paging "+suffix);
   const first=await (await request(endpoint,"GET",undefined,adminToken)).json();assert.equal(first.items.length,30);assert.ok(first.nextCursor);
   const second=await (await request(endpoint+"&before="+first.nextCursor,"GET",undefined,adminToken)).json();assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
   assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,35);
   const banned=await (await request(endpoint+"&status=banned&role=user","GET",undefined,adminToken)).json();assert.equal(banned.items.length,17);assert.ok(banned.items.every(x=>x.banned&&x.role==="user"));
   for(const q of ["%","_","' OR 1=1 --"]){const page=await (await request("/api/v1/admin/users?q="+encodeURIComponent(q),"GET",undefined,adminToken)).json();assert.equal(page.items.length,0);}
   await getPool().query('DELETE FROM "user" WHERE id LIKE $1',["paging-"+suffix+"-%"]);
  });
  await t.test("ban/unban, audit, optimistic conflicts and role updates revoke sessions",async()=>{
   const endpoint="/api/v1/admin/users/"+user.user.id;
   const responses=await Promise.all(["first","second"].map(banReason=>request(endpoint,"PATCH",{version:0,patch:{banned:true,banReason}},adminToken,undefined)));
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
   assert.equal((await request("/api/auth/get-session","GET",undefined,userToken)).status,200);
   assert.equal(await (await request("/api/auth/get-session","GET",undefined,userToken)).json(),null);
   assert.equal((await getPool().query('SELECT 1 FROM "session" WHERE "userId"=$1',[user.user.id])).rowCount,0);
   assert.notEqual((await request("/api/auth/sign-in/email","POST",{email:user.user.email,password})).status,200);
   const records=await getPool().query("SELECT * FROM user_admin_audit WHERE target_id=$1",[user.user.id]);assert.equal(records.rowCount,1);assert.equal(records.rows[0].actor_id,admin.user.id);assert.equal(records.rows[0].after_value.banned,true);
   assert.equal((await request(endpoint,"PATCH",{version:1,patch:{banned:false}},adminToken)).status,200);
   const login=await request("/api/auth/sign-in/email","POST",{email:user.user.email,password});assert.equal(login.status,200);const data=await login.json();const token=login.headers.get("set-auth-token")??data.token;
   assert.equal((await request(endpoint,"PATCH",{version:2,patch:{role:"admin"}},adminToken)).status,200);
   assert.equal((await request("/api/v1/admin/users","GET",undefined,token)).status,401);
   assert.equal((await request(endpoint,"PATCH",{version:3,patch:{role:"user"}},adminToken)).status,200);
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/admin/users/{id}"].patch.requestBody);
  });
  await t.test("account sessions are bounded, token-free and scoped to the owner",async()=>{
   const own=await getAuth().api.createUser({body:{email:"test-sessions-"+suffix+"@example.test",password,name:"Session owner",role:"user"}});
   try{
    const login=await request("/api/auth/sign-in/email","POST",{email:own.user.email,password});assert.equal(login.status,200);const data=await login.json();const token=login.headers.get("set-auth-token")??data.token;
    const current=(await getPool().query('SELECT id FROM "session" WHERE "userId"=$1',[own.user.id])).rows[0].id;
    const foreign=(await getPool().query('SELECT id FROM "session" WHERE "userId"=$1 LIMIT 1',[admin.user.id])).rows[0].id;
    await getPool().query(`INSERT INTO "session"(id,token,"userId","expiresAt","updatedAt") SELECT 'fixture-session-'||$1||'-'||lpad(i::text,3,'0'),'fixture-token-'||$1||'-'||i,$2,NOW()+INTERVAL '1 day',NOW() FROM generate_series(1,24) i`,[suffix,own.user.id]);
    const endpoint="/api/v1/account/sessions";
    assert.equal((await request(endpoint)).status,401);
    const first=await (await request(endpoint,"GET",undefined,token)).json();assert.equal(first.items.length,20);assert.ok(first.nextCursor);
    const second=await (await request(endpoint+"?before="+first.nextCursor,"GET",undefined,token)).json();assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
    const all=[...first.items,...second.items];assert.equal(new Set(all.map(item=>item.id)).size,25);assert.ok(all.some(item=>item.id===current&&item.current));assert.ok(!all.some(item=>item.id===foreign));
    for(const item of all)assert.deepEqual(Object.keys(item).sort(),["id","createdAt","expiresAt","userAgent","ipAddress","current"].sort());
    assert.ok(!JSON.stringify(first).includes(token));assert.ok(all.every(item=>item.ipAddress===null||item.ipAddress.trim().length>0));
    assert.equal((await request(endpoint+"/revoke","POST",{scope:"session",id:foreign},token)).status,404);
    assert.equal((await request(endpoint+"/revoke","POST",{scope:"session",id:current},token)).status,409);
    assert.equal((await request(endpoint+"/revoke","POST",{scope:"others"},token,"https://attacker.example")).status,403);
    assert.equal((await request(endpoint+"/revoke","POST",{scope:"others",userId:admin.user.id},token)).status,400);
    const revoke=await request(endpoint+"/revoke","POST",{scope:"session",id:all.find(item=>!item.current).id},token,undefined);assert.equal(revoke.status,200);assert.equal((await revoke.json()).revoked,1);
    const others=await request(endpoint+"/revoke","POST",{scope:"others"},token);assert.equal(others.status,200);assert.equal((await others.json()).revoked,23);
    const remaining=await (await request(endpoint,"GET",undefined,token)).json();assert.equal(remaining.items.length,1);assert.equal(remaining.items[0].current,true);
   }finally{await getPool().query('DELETE FROM "user" WHERE id=$1',[own.user.id]);}
  });
  await t.test("password changes verify current password, revoke every session and rate limit attempts",async()=>{
   const own=await getAuth().api.createUser({body:{email:"test-password-"+suffix+"@example.test",password,name:"Password owner",role:"user"}});
   const replacement=randomBytes(18).toString("base64url");
   try{
    const tokens:string[]=[];
    for(let i=0;i<2;i++){const login=await request("/api/auth/sign-in/email","POST",{email:own.user.email,password});assert.equal(login.status,200);const data=await login.json();tokens.push(login.headers.get("set-auth-token")??data.token);}
    const endpoint="/api/v1/account/password";
    assert.equal((await request(endpoint,"POST",{currentPassword:password,newPassword:replacement})).status,401);
    assert.equal((await request(endpoint,"POST",{currentPassword:password,newPassword:replacement},tokens[0],"https://attacker.example")).status,403);
    assert.equal((await request(endpoint,"POST",{currentPassword:"incorrect-password",newPassword:replacement},tokens[0])).status,400);
    assert.equal((await request(endpoint,"POST",{currentPassword:password,newPassword:"short"},tokens[0])).status,400);
    assert.equal((await request(endpoint,"POST",{currentPassword:password,newPassword:replacement,userId:admin.user.id},tokens[0])).status,400);
    const result=await request(endpoint,"POST",{currentPassword:password,newPassword:replacement},tokens[0],undefined);assert.equal(result.status,200);assert.deepEqual(await result.json(),{reauthenticate:true});
    for(const token of tokens)assert.equal((await request("/api/v1/account/sessions","GET",undefined,token)).status,401);
    assert.equal((await getPool().query('SELECT 1 FROM "session" WHERE "userId"=$1',[own.user.id])).rowCount,0);
    assert.equal((await getPool().query("SELECT 1 FROM account_security_audit WHERE actor_id=$1 AND action='password_changed'",[own.user.id])).rowCount,1);
    assert.notEqual((await request("/api/auth/sign-in/email","POST",{email:own.user.email,password})).status,200);
    const login=await request("/api/auth/sign-in/email","POST",{email:own.user.email,password:replacement});assert.equal(login.status,200);const data=await login.json();const token=login.headers.get("set-auth-token")??data.token;
    assert.equal((await request(endpoint,"POST",{currentPassword:password,newPassword:replacement},token)).status,400);
    const limited=await request(endpoint,"POST",{currentPassword:password,newPassword:replacement},token);assert.equal(limited.status,429);assert.ok(limited.headers.get("retry-after"));
   }finally{await getPool().query('DELETE FROM "user" WHERE id=$1',[own.user.id]);}
  });
  await t.test("user and account audits require admin and page without exposing raw data",async()=>{
   const login=await request("/api/auth/sign-in/email","POST",{email:user.user.email,password});assert.equal(login.status,200);const data=await login.json();const ordinaryToken=login.headers.get("set-auth-token")??data.token;
   await getPool().query(`INSERT INTO user_admin_audit(actor_id,target_id,before_value,after_value) SELECT $1,$2,'{"role":"user","banReason":"private-audit-marker"}'::jsonb,'{"role":"admin","banReason":null}'::jsonb FROM generate_series(1,35)`,[admin.user.id,user.user.id]);
   await getPool().query("INSERT INTO account_security_audit(actor_id,action) SELECT $1,'password_changed' FROM generate_series(1,35)",[admin.user.id]);
   for(const kind of ["users","account"]){
    const endpoint="/api/v1/admin/audit/"+kind;
    assert.equal((await request(endpoint)).status,401);assert.equal((await request(endpoint,"GET",undefined,ordinaryToken)).status,403);
    assert.equal((await request(endpoint+"?before=0","GET",undefined,adminToken)).status,400);
    const first=await (await request(endpoint,"GET",undefined,adminToken)).json();assert.equal(first.items.length,30);assert.ok(first.nextCursor);
    const second=await (await request(endpoint+"?before="+first.nextCursor,"GET",undefined,adminToken)).json();assert.ok(second.items.length>=5);assert.equal(second.nextCursor,null);
    assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,first.items.length+second.items.length);
    assert.ok(!JSON.stringify(first).includes("private-audit-marker"));assert.ok(!("before_value" in first.items[0])&&!("after_value" in first.items[0]));
    const html=await (await request("/admin/audit?type="+kind,"GET",undefined,adminToken)).text();assert.ok(html.includes("操作记录"));
   }
   const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/account/password"].post.requestBody);
  });
  await t.test("self protection and concurrent administrators cannot remove all administrators",async()=>{
   const own="/api/v1/admin/users/"+admin.user.id;
   for(const patch of [{role:"user"},{banned:true}])assert.equal((await request(own,"PATCH",{version:0,patch},adminToken)).status,409);
   const peer=await getAuth().api.createUser({body:{email:"test-peer-"+suffix+"@example.test",password,name:"Peer",role:"admin"}});
   try{
    const login=await request("/api/auth/sign-in/email","POST",{email:peer.user.email,password});assert.equal(login.status,200);const data=await login.json();const token=login.headers.get("set-auth-token")??data.token;
    const results=await Promise.all([request("/api/v1/admin/users/"+peer.user.id,"PATCH",{version:0,patch:{role:"user"}},adminToken),request(own,"PATCH",{version:0,patch:{role:"user"}},token)]);
    assert.equal(results.filter(r=>r.status===200).length,1);assert.ok(results.some(r=>[401,403].includes(r.status)));
    const remaining=await getPool().query(`SELECT id FROM "user" WHERE role='admin' AND NOT COALESCE(banned,false)`);assert.equal(remaining.rowCount,1);
   }finally{
    await getPool().query('UPDATE "user" SET role=\'admin\' WHERE id=$1',[admin.user.id]);await getPool().query('DELETE FROM "user" WHERE id=$1',[peer.user.id]);
    const login=await request("/api/auth/sign-in/email","POST",{email:admin.user.email,password});assert.equal(login.status,200);const data=await login.json();adminToken=login.headers.get("set-auth-token")??data.token;
   }
  });
  await t.test("logout revokes APP and browser session",async()=>{const response=await request("/api/auth/sign-out","POST",{},adminToken);assert.equal(response.status,200);assert.equal((await request("/api/v1/admin/site-settings","GET",undefined,adminToken)).status,401);});
 }finally{
  server.kill();await new Promise<void>(resolve=>{if(server.exitCode!==null)resolve();else server.once("exit",()=>resolve());});
  await getPool().query("UPDATE site_settings SET value=$1::jsonb,revision=revision+1 WHERE id=1",[JSON.stringify(original)]);
  await getPool().query('DELETE FROM contents WHERE author_id=ANY($1::text[])',[[admin.user.id,user.user.id]]);
  // Immutable accounting fixtures stay until the runner drops its dedicated database.
  await getPool().query('DELETE FROM "user" u WHERE id=ANY($1::text[]) AND NOT EXISTS(SELECT 1 FROM points_accounts p WHERE p.user_id=u.id) AND NOT EXISTS(SELECT 1 FROM badge_audit b WHERE b.user_id=u.id)',[[admin.user.id,user.user.id]]);
  await getPool().query("DELETE FROM request_limits WHERE key=$1",["test:"+suffix]);await getPool().end();
 }
});
