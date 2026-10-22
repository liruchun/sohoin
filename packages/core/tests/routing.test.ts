import {test} from "node:test";
import assert from "node:assert/strict";
import {createSiteRouter, type CustomRoute} from "../../extension-api/src/routes";
const Page=()=>null;
const route=(path:string):CustomRoute=>({path,access:"public",Page});
test("default built-in routes and bounded unknown matches",()=>{
 const r=createSiteRouter();assert.equal(r.href.contentList(),"/content");assert.equal(r.href.contentDetail("123"),"/content/123");assert.equal(r.match(["content","123"])?.kind,"contentDetail");assert.equal(r.match(["missing"]),null);assert.equal(r.match(["content","1","extra"]),null);
});
test("custom paths keep built-in kinds and escape queries",()=>{
 const r=createSiteRouter({paths:{contentList:"/posts",contentDetail:"/stories/[id]"}});assert.equal(r.match(["stories","123"])?.params.id,"123");assert.equal(r.match(["posts"])?.kind,"contentList");assert.equal(r.href.contentList({q:"a&b",before:undefined}),"/posts?q=a%26b");assert.equal(r.match(["content"]),null);
});
test("custom dynamic pages and access declarations survive dispatch",()=>{
 const r=createSiteRouter({routes:[route("/about"),{...route("/projects/[slug]"),access:"admin"}]});const m=r.match(["projects","你好"]);assert.equal(m?.kind,"custom");assert.equal(m?.params.slug,"你好");if(m?.kind==="custom")assert.equal(m.route.access,"admin");assert.equal(r.href.custom("/projects/[slug]",{slug:"你好"}),"/projects/%E4%BD%A0%E5%A5%BD");
});
test("reserved paths cannot shadow host pages or endpoints",()=>{
 for(const path of ["/admin","/admin/audit","/api","/api/test","/_next/test","/content","/content/[slug]","/featured","/featured/[slug]","/p/test","/members/test","/threads/test","/comments/test"])assert.throws(()=>createSiteRouter({routes:[route(path)]}));
 assert.throws(()=>createSiteRouter({paths:{contentList:"/admin"}}));assert.throws(()=>createSiteRouter({paths:{contentDetail:"/api/[id]"}}));
});
test("ambiguous static and dynamic patterns fail early in either order",()=>{
 for(const paths of [["/projects/new","/projects/[id]"],["/projects/[id]","/projects/new"],["/projects/[id]","/projects/[slug]"],["/about","/about"]])assert.throws(()=>createSiteRouter({routes:paths.map(route)}),/Conflicting/);
 assert.throws(()=>createSiteRouter({paths:{contentList:"/stories/new",contentDetail:"/stories/[id]"}}),/Conflicting/);
});
test("invalid wildcard, root, repeated and prototype parameters rejected",()=>{
 for(const path of ["/","//about","/about/","/a?x=1","/a#x","/a/../b","/[root]","/a/[...rest]","/a/[[id]]","/a/[id]/[id]","/a/[constructor]","/a/[prototype]","/a/"+"b".repeat(200)])assert.throws(()=>createSiteRouter({routes:[route(path)]}));
 assert.throws(()=>createSiteRouter({paths:{contentDetail:"/stories/[slug]"}}));assert.throws(()=>createSiteRouter({paths:{contentList:"/list/[id]"}}));
});
test("request parameters cannot manufacture paths or prototype properties",()=>{
 const r=createSiteRouter({routes:[route("/projects/[slug]")]});for(const slug of ["..",".","a/b","a\\b","\u0000"]) {assert.equal(r.match(["projects",slug]),null);assert.throws(()=>r.href.custom("/projects/[slug]",{slug}));}assert.throws(()=>r.href.custom("/projects/[slug]"));assert.throws(()=>r.href.custom("/unregistered"));
});
test("route registry is bounded and explicit about access",()=>{
 assert.throws(()=>createSiteRouter({routes:Array.from({length:65},(_,i)=>route("/page"+i))}));assert.throws(()=>createSiteRouter({routes:[{...route("/bad"),access:"other" as "public"}]}));
});
