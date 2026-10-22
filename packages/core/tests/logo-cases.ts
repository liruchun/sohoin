import type {TestContext} from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {getPool} from "@sohoin/database";
import {sanitizeLogoSvg} from "../src/server/logo-svg";
import {buildResponsiveImages} from "../src/server/media-responsive";
import {loadMediaBytes} from "../src/server/media-storage";

type RequestFn=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;
export async function logoCases(t:TestContext,{base,request,adminToken,userToken}:{base:string;request:RequestFn;adminToken:string;userToken:string}){
 await t.test("responsive uploads persist actual widths and deletion removes every derivative",async()=>{
  const png=await sharp({create:{width:1600,height:800,channels:3,background:"#567"}}).png().toBuffer();
  const response=await fetch(base+"/api/v1/admin/media",{method:"POST",headers:{Authorization:"Bearer "+adminToken,"Content-Type":"image/png","X-File-Name":"responsive.png"},body:png});
  assert.equal(response.status,201);const asset=await response.json();
  const variants=(await getPool().query("SELECT variant_key,storage_namespace,storage_key,byte_size,width,height FROM media_variants WHERE media_id=$1 ORDER BY width",[asset.id])).rows;
  try{
   assert.deepEqual(variants.filter(v=>v.variant_key.startsWith("w")).map(v=>v.width),[480,960,1440]);
   for(const v of variants){const bytes=await loadMediaBytes(v.storage_namespace,v.storage_key,Number(v.byte_size));const info=await sharp(bytes).metadata();assert.equal(info.width,v.width);assert.equal(info.height,v.height);}
  }finally{assert.equal((await request("/api/v1/admin/media/"+asset.id,"DELETE",{version:1},adminToken)).status,200);}
  for(const v of variants)await assert.rejects(loadMediaBytes(v.storage_namespace,v.storage_key,Number(v.byte_size)),{code:"MEDIA_NOT_FOUND"});
  const small=await sharp({create:{width:320,height:640,channels:3,background:"#567"}}).webp().toBuffer();
  assert.deepEqual(await buildResponsiveImages(small,320),[]);
  assert.deepEqual(await buildResponsiveImages(png,1600,["w480","w960","w1440"]),[]);
 });
 await t.test("Inkscape font annotations are discarded from inline styles and stylesheets",()=>{
  const svg=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="58.394871mm" height="11.502076mm" viewBox="0 0 58.394871 11.502076" xml:space="preserve">${body}</svg>`;
  const style="font-size:4.02123px;font-family:zihunxinquhei_trial;-inkscape-font-specification:'zihunxinquhei_trial, Normal';fill:#f05a3a;stroke-width:0.0417436";
  const clean=sanitizeLogoSvg(Buffer.from(svg(`<style>.logo{${style}}</style><g transform="translate(-46,-139)"><path style="${style}" d="M46 139H66V149H46Z"/></g>`))).toString();
  assert.doesNotMatch(clean,/-inkscape-font-specification/);
  assert.match(clean,/font-family:zihunxinquhei_trial/);
  assert.match(clean,/fill:#f05a3a;stroke-width:0.0417436/);
  assert.match(clean,/transform="translate\(-46,-139\)"/);
  assert.match(clean,/d="M46 139H66V149H46Z"/);
  for(const unsafe of ["-inkscape-unknown:normal","-inkscape-font-specification:url(https://example.invalid/font)","-inkscape-font-specification:expression(alert(1))",`${style};fill:url(https://example.invalid/image)`]){
   for(const body of [`<path style="${unsafe}"/>`,`<style>path{${unsafe}}</style>`])assert.throws(()=>sanitizeLogoSvg(Buffer.from(svg(body))),{code:"UNSUPPORTED_LOGO_SVG"});
  }
 });
 await t.test("Inkscape editor annotations are removed without allowing active SVG content",()=>{
  const wrap=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="20mm" height="10mm" viewBox="0 0 20 10">${body}</svg>`;
  const path='<g inkscape:label="图层 1" inkscape:groupmode="layer"><path fill="#f05a3a" d="M0 0H20V10H0Z"/></g>';
  const clean=sanitizeLogoSvg(Buffer.from(wrap('<sodipodi:namedview pagecolor="#fff"><inkscape:page width="20" height="10"/></sodipodi:namedview>'+path))).toString();
  assert.doesNotMatch(clean,/inkscape|sodipodi|namedview/);
  assert.match(clean,/viewBox="0 0 20 10"/);
  assert.match(clean,/fill="#f05a3a"/);
  assert.match(clean,/d="M0 0H20V10H0Z"/);
  for(const body of ['<script>alert(1)</script>','<path onload="alert(1)"/>','<use href="https://example.invalid/a.svg#x"/>','<g xmlns:inkscape="https://example.invalid/editor" inkscape:label="x"/>']){
   assert.throws(()=>sanitizeLogoSvg(Buffer.from(wrap(path+body))),{code:"UNSUPPORTED_LOGO_SVG"});
  }
 });
 async function upload(background:string){const png=await sharp({create:{width:80,height:40,channels:4,background}}).png().toBuffer();const response=await fetch(base+"/api/v1/admin/media",{method:"POST",headers:{Authorization:"Bearer "+adminToken,"Content-Type":"image/png","X-File-Name":"logo.png"},body:png});assert.equal(response.status,201);return response.json();}
 async function snapshot(){return (await request("/api/v1/admin/site-settings","GET",undefined,adminToken)).json();}
 async function save(logo:{normal:string|null;dark:string|null}){const current=await snapshot();return request("/api/v1/admin/site-settings","PATCH",{revision:current.revision,patch:{logo}},adminToken);}
 async function saveIcons(icons:{favicon:string|null;app:string|null}){const current=await snapshot();return request("/api/v1/admin/site-settings","PATCH",{revision:current.revision,patch:{icons}},adminToken);}
 await t.test("generated icons have bounded PNG sizes, publish only selected assets and protect references",async()=>{
  const initial=await snapshot(),source=await upload("transparent");let generated:{id:string;fileUrl:string}|undefined;
  try{
   assert.equal((await saveIcons({favicon:source.id,app:source.id})).status,400);
   assert.equal((await request("/api/v1/admin/site-icons/generate","POST",{mediaId:source.id},userToken)).status,403);
   const response=await request("/api/v1/admin/site-icons/generate","POST",{mediaId:source.id},adminToken);assert.equal(response.status,201);generated=await response.json();
   for(const [variant,size] of Object.entries({favicon:32,apple:180,"app-192":192,"app-512":512,"maskable-512":512})){
    const file=await request(generated!.fileUrl+"?variant="+variant,"GET",undefined,adminToken);assert.equal(file.status,200);assert.equal(file.headers.get("content-type"),"image/png");
    const bytes=Buffer.from(await file.arrayBuffer()),metadata=await sharp(bytes).metadata();assert.equal(metadata.width,size);assert.equal(metadata.height,size);
    if(variant!=="favicon"){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=3;i<data.length;i+=info.channels)assert.equal(data[i],255);}
   }
   assert.equal((await saveIcons({favicon:generated!.id,app:generated!.id})).status,200);
   const published=await request("/api/v1/site-icon/app-512");assert.equal(published.status,200);assert.equal(published.headers.get("x-robots-tag"),"noindex");
   assert.equal((await request("/api/v1/site-icon/"+source.id)).status,404);
   assert.equal((await request("/api/v1/admin/media/"+generated!.id,"DELETE",{version:1},adminToken)).status,409);
   const manifest=await (await request("/manifest.webmanifest")).json();assert.equal(manifest.name,initial.settings.siteName);assert.equal(manifest.icons.length,3);assert.ok(manifest.icons.some((icon:{purpose:string})=>icon.purpose==="maskable"));
   const html=await (await request("/")).text();assert.match(html,/apple-touch-icon/);assert.match(html,/\/api\/v1\/site-icon\/favicon\?v=/);
   assert.equal((await saveIcons({favicon:null,app:null})).status,200);assert.equal((await request("/api/v1/site-icon/app-512")).status,404);
  }finally{await saveIcons(initial.settings.icons);for(const asset of [generated,source])if(asset)await request("/api/v1/admin/media/"+asset.id,"DELETE",{version:1},adminToken);}
 });
 await t.test("SVG Logos retain vectors with separate thumbnails and reject active resources",async()=>{
  const initial=await snapshot();let asset:{id:string;fileUrl:string;previewUrl:string}|undefined;
  const svg=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40">${body}</svg>`;
  const valid=svg('<style>svg{color:#111}@media (prefers-color-scheme: dark){svg{color:#fff}}</style><defs><linearGradient id="g"><stop stop-color="currentColor"/><stop offset="1" stop-color="#555"/></linearGradient></defs><path fill="url(#g)" d="M10 30 L40 5 L70 30 Z"/>');
  async function send(body:string,path="?purpose=logo",token=adminToken,mime="image/svg+xml"){return fetch(base+"/api/v1/admin/media"+path,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":mime,"X-File-Name":"logo.svg"},body});}
  try{
   assert.equal((await send(valid,"?purpose=logo",userToken)).status,403);
   assert.equal((await send(valid,"")).status,415);
   assert.equal((await send(valid,"?purpose=logo",adminToken,"image/png")).status,415);
   for(const source of [
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+svg("&x;"),
    svg('<script>alert(1)</script>'),svg('<path onload="alert(1)"/>'),
    svg('<use href="https://example.invalid/logo.svg#x"/>'),
    svg('<path fill="url(file:///etc/passwd)"/>'),svg('<style>@import "https://example.invalid/x.css";</style>'),
    svg('<foreignObject/>'),svg('<animate attributeName="opacity"/>'),
   ])assert.equal((await send(source)).status,415);
   assert.equal((await send(svg('<path d="'))).status,415);
   const uploaded=await send('<?xml version="1.0" encoding="UTF-8"?><!-- Logo -->'+valid);assert.equal(uploaded.status,201);asset=await uploaded.json();
   const file=await request(asset!.fileUrl,"GET",undefined,adminToken);assert.equal(file.headers.get("content-type"),"image/svg+xml");
   const source=await file.text();assert.ok(source.startsWith("<svg"));assert.ok(!source.includes("<!--"));
   const metadata=await sharp(Buffer.from(source)).metadata();assert.equal(metadata.format,"svg");assert.equal(metadata.width,80);assert.equal(metadata.height,40);
   const thumbnail=await request(asset!.previewUrl,"GET",undefined,adminToken);assert.equal(thumbnail.headers.get("content-type"),"image/webp");
   assert.equal((await save({normal:asset!.id,dark:asset!.id})).status,200);
   for(const variant of ["normal","dark"]){const response=await request("/api/v1/site-logo/"+variant);assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"image/svg+xml");assert.equal(response.headers.get("x-robots-tag"),"noindex");assert.equal(response.headers.get("x-content-type-options"),"nosniff");assert.match(response.headers.get("content-security-policy")??"",/sandbox/);}
  }finally{await save(initial.settings.logo);if(asset)await request("/api/v1/admin/media/"+asset.id,"DELETE",{version:1},adminToken);}
 });
 await t.test("logos validate references, publish only selected images, protect media and revoke old URLs",async()=>{
  const initial=await snapshot();const a=await upload("black"),b=await upload("white"),unused=await upload("gray");
  try{
   assert.equal((await request("/api/v1/site-logo/normal")).status,404);
   assert.equal((await request("/api/v1/site-logo/"+unused.id)).status,404);
   assert.equal((await request(unused.fileUrl)).status,401);
   for(const logo of [{normal:"https://evil.test/logo.svg",dark:null},{normal:"0",dark:null},{normal:"1",dark:null,extra:true}])assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision:initial.revision,patch:{logo}},adminToken)).status,400);
   const invalid=await save({normal:"9223372036854775807",dark:null});assert.equal(invalid.status,400);assert.equal((await snapshot()).revision,initial.revision);
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision:initial.revision,patch:{logo:{normal:a.id,dark:null}}},userToken)).status,403);
   const saved=await save({normal:a.id,dark:null});assert.equal(saved.status,200);const result=await saved.json();assert.equal(result.settings.logo.normal,a.id);
   assert.equal((await request("/api/v1/admin/site-settings","PATCH",{revision:initial.revision,patch:{logo:{normal:b.id,dark:null}}},adminToken)).status,409);
   const publicSnapshot=await (await request("/api/v1/site-settings")).json();assert.deepEqual(publicSnapshot.settings.logo,{normal:"/api/v1/site-logo/normal",dark:null});
   const logo=await request("/api/v1/site-logo/normal");assert.equal(logo.status,200);assert.equal(logo.headers.get("content-type"),"image/webp");assert.equal(logo.headers.get("x-content-type-options"),"nosniff");assert.equal(logo.headers.get("x-robots-tag"),"noindex");assert.equal(logo.headers.get("cache-control"),"no-store");
   const bytes=Buffer.from(await logo.arrayBuffer());const fallback=Buffer.from(await (await request("/api/v1/site-logo/dark")).arrayBuffer());assert.deepEqual(fallback,bytes);
   const html=await (await request("/")).text();assert.match(html,/class="site-brand-logo(?: [^"]*)?"[^>]*src="\/api\/v1\/site-logo\/normal"/);assert.ok(!html.includes("/api/v1/admin/media/"));assert.equal((html.match(/<h1[ >]/g)??[]).length,1);
   const listed=await (await request("/api/v1/admin/media","GET",undefined,adminToken)).json();assert.equal(listed.items.find(item=>item.id===a.id).inUse,true);
   assert.equal((await request("/api/v1/admin/media/"+a.id,"DELETE",{version:1},adminToken)).status,409);
   assert.equal((await save({normal:a.id,dark:b.id})).status,200);const dark=Buffer.from(await (await request("/api/v1/site-logo/dark")).arrayBuffer());assert.notDeepEqual(dark,bytes);
   const audit=await getPool().query("SELECT 1 FROM settings_audit WHERE after_value #>> '{logo,dark}'=$1",[b.id]);assert.ok(audit.rowCount);
   assert.equal((await save({normal:b.id,dark:null})).status,200);assert.notDeepEqual(Buffer.from(await (await request("/api/v1/site-logo/normal")).arrayBuffer()),bytes);
   assert.equal((await request("/api/v1/admin/media/"+a.id,"DELETE",{version:1},adminToken)).status,200);
   assert.equal((await save({normal:a.id,dark:null})).status,400);
   assert.equal((await save({normal:null,dark:null})).status,200);assert.equal((await request("/api/v1/site-logo/normal")).status,404);assert.equal((await request("/api/v1/site-logo/dark")).status,404);
   const cleared=await (await request("/")).text();assert.ok(!cleared.includes('class="site-brand-logo'));
  }finally{await save(initial.settings.logo);for(const asset of [a,b,unused])await request("/api/v1/admin/media/"+asset.id,"DELETE",{version:1},adminToken);}
 });
 await t.test("logo binding and deletion serialize without saving a deleted asset",async()=>{
  const initial=await snapshot();
  try{for(let i=0;i<3;i++){
   const asset=await upload("black"),current=await snapshot();
   const [binding,removal]=await Promise.all([request("/api/v1/admin/site-settings","PATCH",{revision:current.revision,patch:{logo:{normal:asset.id,dark:null}}},adminToken),request("/api/v1/admin/media/"+asset.id,"DELETE",{version:1},adminToken)]);
   if(binding.status===200){assert.equal(removal.status,409);assert.equal((await request("/api/v1/site-logo/normal")).status,200);assert.equal((await save({normal:null,dark:null})).status,200);await request("/api/v1/admin/media/"+asset.id,"DELETE",{version:1},adminToken);}
   else{assert.equal(binding.status,400);assert.equal(removal.status,200);assert.equal((await snapshot()).settings.logo.normal,null);}
  }}finally{await save(initial.settings.logo);}
 });
}
