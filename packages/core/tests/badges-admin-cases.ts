import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import {randomUUID} from "node:crypto";
import sharp from "sharp";
import {getPool} from "@sohoin/database";
import {createAdminBadgeService,uploadMedia,deleteMedia,getMediaDetail,ServiceError} from "../src/server";
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function badgeAdminCases(t:TestContext,request:Requester,adminToken:string,userToken:string,userId:string){
 const headers=new Headers({Authorization:"Bearer "+adminToken}),admin=createAdminBadgeService(headers),pool=getPool();
 const definition={name:"后台勋章测试",description:"普通文本 <script>不是脚本</script>",enabled:true,reason:"创建原因",iconMediaId:null,requestId:randomUUID()};
 let key="",revision=1,iconId="";
 await t.test("badge admin HTTP protects reads and writes, body size and identities",async()=>{
  assert.equal((await request("/api/v1/admin/badges")).status,401);
  assert.equal((await request("/api/v1/admin/badges","GET",undefined,userToken)).status,403);
  assert.equal((await request("/api/v1/admin/badges","POST",definition,userToken)).status,403);
  assert.equal((await request("/api/v1/admin/badges","POST",definition,adminToken,"https://attacker.example")).status,403);
  assert.equal((await request("/api/v1/admin/badges","POST",{...definition,padding:"x".repeat(9000)},adminToken)).status,413);
  assert.equal((await request("/api/v1/admin/badges","POST",{...definition,key:"forged-key"},adminToken)).status,400);
  const created=await request("/api/v1/admin/badges","POST",definition,adminToken);
  assert.equal(created.status,201);assert.match(created.headers.get("cache-control")??"",/no-store/);
  const data=await created.json();key=data.key;assert.equal(data.name,definition.name);assert.equal(data.iconMediaId,null);
  assert.equal((await request("/api/v1/admin/badges","POST",definition,adminToken)).status,409);
  assert.equal((await pool.query("SELECT 1 FROM badges WHERE key=$1",[key])).rowCount,1);
  assert.equal((await request("/api/v1/admin/badges/"+key,"GET",undefined,userToken)).status,403);
  const {requestId,...update}=definition;
  assert.equal((await request("/api/v1/admin/badges/"+key,"PATCH",{...update,key:"another-key",revision},adminToken)).status,400);
  assert.equal((await request("/api/v1/admin/badges/"+key,"PATCH",{...update,revision:99},adminToken)).status,409);
  assert.equal((await request("/api/v1/admin/badges/options?userId="+userId+"&actor=admin","GET",undefined,adminToken)).status,400);
 });
 await t.test("badge images use existing uploads, reject invalid assets and prevent deletion while referenced",async()=>{
  const image=await uploadMedia(headers,{name:"badge-test.png",mime:"image/png",read:()=>sharp({create:{width:64,height:64,channels:4,background:{r:10,g:20,b:30,alpha:0.5}}}).png().toBuffer()});
  iconId=image.id;
  const {requestId,...update}=definition;
  const invalid=await request("/api/v1/admin/badges/"+key,"PATCH",{...update,revision,iconMediaId:"9223372036854775807"},adminToken);
  assert.equal(invalid.status,400);
  const saved=await request("/api/v1/admin/badges/"+key,"PATCH",{...update,revision,iconMediaId:iconId},adminToken);
  assert.equal(saved.status,200);revision=(await saved.json()).revision;
  const assetKey=(await getPool().query("SELECT storage_key FROM media_assets WHERE id=$1",[iconId])).rows[0].storage_key;
  const publicIcon=await request("/api/site-media/"+assetKey);
  assert.equal(publicIcon.status,200);
  assert.match(publicIcon.headers.get("X-Robots-Tag")??"",/noindex/);
  const disabled=await admin.updateDefinition({key,name:definition.name,description:definition.description,enabled:false,reason:"停用图标访问测试",revision});
  revision=disabled.revision;
  assert.equal((await request("/api/site-media/"+assetKey)).status,404);
  const detail=await getMediaDetail(headers,iconId,{});
  assert.equal(detail.asset.inUse,true);
  await assert.rejects(()=>deleteMedia(headers,iconId,{version:detail.asset.version}),e=>e instanceof ServiceError&&e.status===409);
  const legacy=await admin.updateDefinition({key,name:definition.name,description:definition.description,enabled:true,reason:"保持图标",revision});
  revision=legacy.revision;assert.equal(legacy.iconMediaId,iconId);
  const cleared=await admin.updateDefinition({key,name:definition.name,description:definition.description,enabled:true,reason:"移除图标",revision,iconMediaId:null});
  revision=cleared.revision;
  assert.equal((await getMediaDetail(headers,iconId,{})).asset.inUse,false);
  await deleteMedia(headers,iconId,{version:detail.asset.version});
  assert.equal((await request("/api/v1/admin/badges/"+key,"PATCH",{...update,revision,iconMediaId:iconId},adminToken)).status,400);
 });
 await t.test("badge SVGs retain vectors, reject active markup and stay private without an enabled badge",async()=>{
  const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#ff4d55"/></svg>');
  const svg=await uploadMedia(headers,{name:"badge-vector.svg",mime:"image/svg+xml",purpose:"badge",read:async()=>bytes});
  const storageKey=(await pool.query("SELECT storage_key FROM media_assets WHERE id=$1",[svg.id])).rows[0].storage_key;
  assert.equal((await request("/api/site-media/"+storageKey)).status,404);
  await assert.rejects(()=>uploadMedia(headers,{name:"unsafe.svg",mime:"image/svg+xml",purpose:"badge",read:async()=>Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')}),e=>e instanceof ServiceError&&e.status===415);
  const badge=await admin.createDefinition({key:"svg-"+randomUUID().replaceAll("-",""),name:"矢量勋章",description:"矢量测试",enabled:true,reason:"测试",iconMediaId:svg.id});
  const response=await request("/api/site-media/"+storageKey);
  assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/image\/svg\+xml/);
  assert.match(response.headers.get("content-security-policy")??"",/sandbox/);
  assert.match(await response.text(),/<svg/);
  assert.equal((await request("/api/site-media/"+storageKey+"?variant=thumbnail")).status,200);
  await admin.updateDefinition({key:badge.key,name:badge.name,description:badge.description,iconMediaId:badge.iconMediaId,enabled:false,reason:"停用",revision:badge.revision});
  assert.equal((await request("/api/site-media/"+storageKey)).status,404);
 });
 await t.test("manual grants bind the actor and source, replay safely and update recipient and user views",async()=>{
  const input={userId,badgeKey:key,reason:"人工补发",requestId:randomUUID()};
  assert.equal((await request("/api/v1/admin/badges/grants","POST",input,userToken)).status,403);
  assert.equal((await request("/api/v1/admin/badges/grants","POST",input,adminToken,"https://attacker.example")).status,403);
  assert.equal((await request("/api/v1/admin/badges/grants","POST",{...input,actor:{kind:"system",id:"fake"}},adminToken)).status,400);
  const responses=await Promise.all([request("/api/v1/admin/badges/grants","POST",input,adminToken),request("/api/v1/admin/badges/grants","POST",input,adminToken)]);
  for(const response of responses)assert.equal(response.status,200);
  const results=await Promise.all(responses.map(response=>response.json()));
  assert.equal(results.filter(result=>result.replayed).length,1);
  const recipients=await admin.listRecipients(key);assert.equal(recipients.items.length,1);assert.equal(recipients.items[0].userId,userId);assert.equal(recipients.items[0].actorKind,"admin");
  const history=await admin.listUserAudit(userId);
  const audit=history.items.find(row=>row.badgeKey===key);assert.ok(audit);assert.equal(audit.request.sourceType,"manual");assert.equal(audit.actor.kind,"admin");
  let before:string|undefined,owned=false;
  do{const response=await request("/api/v1/admin/badges/options?userId="+userId+(before?"&before="+before:""),"GET",undefined,adminToken);assert.equal(response.status,200);const page=await response.json();owned ||= page.items.some((item:{key:string;owned:boolean})=>item.key===key&&item.owned);before=page.nextCursor??undefined;}while(before);
  assert.equal(owned,true);
  const undo={userId,badgeKey:key,revision:results[0].state.revision,reason:"人工撤销",requestId:randomUUID()};
  assert.equal((await request("/api/v1/admin/badges/grants","PATCH",undo,userToken)).status,403);
  assert.equal((await request("/api/v1/admin/badges/grants","PATCH",undo,adminToken)).status,200);
  assert.equal((await admin.listRecipients(key)).items.length,0);
  assert.equal((await request("/api/v1/admin/badges/grants","PATCH",{...undo,requestId:randomUUID()},adminToken)).status,409);
 });
 await t.test("badge admin pages render private server content and canonical user navigation",async()=>{
  for(const path of ["/admin/badges","/admin/badges/new","/admin/badges/"+key,"/admin/badges/"+key+"?tab=recipients","/admin/badges/"+key+"?tab=audit","/admin/users/"+userId+"/badges","/admin/users/"+userId+"/badges?tab=audit"]){
   const response=await request(path,"GET",undefined,adminToken);assert.equal(response.status,200,path);const html=await response.text();assert.match(html,/noindex/);assert.equal((html.match(/<h1(?:\s|>)/g)??[]).length,1,path);
   const denied=await request(path);assert.ok([303,307,308,401,403].includes(denied.status),path);
  }
  const spec=await (await request("/api/openapi.json")).json();assert.ok(spec.paths["/api/v1/admin/badges/grants"].patch);
 });
}
