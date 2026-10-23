import {spawn} from "node:child_process";
import path from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {test} from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {getPool,savePublicRouteIds,insertMedia,readMediaFile,tombstoneMedia,MediaStoreError,readPublicMediaFile,readSitePresentation} from "@sohoin/database";
import {createPublicIdCodec,createShortPublicId} from "../src/server/public-id";
import {getSiteFeed,getSiteContent,getSiteProfile,getSiteSitemap} from "../src/server/public-site";
import {getSiteDiscussion,getSiteReplyBranch,getSiteContentHead,getSiteAncestorReplyCounts,readCommentActionToken,commentRoutes} from "../src/server/public-discussion";
import {ServiceError} from "../src/server/security";
const key=randomBytes(32).toString("base64url"),codec=createPublicIdCodec(key);
test("public IDs encrypt with randomized nonces and authenticate purpose, payload and encoding",()=>{
 const token=codec.seal("content","123");assert.match(token,/^d1_/);assert.equal(codec.open("content",token),"123");assert.notEqual(token,codec.seal("content","123"));assert.equal(codec.open("user",token),null);assert.equal(createPublicIdCodec(randomBytes(32).toString("base64url")).open("content",token),null);
 for(const invalid of ["123",token+"=",token.slice(0,-4)+"aaaa","d1_"+"a".repeat(300),"../"+token])assert.equal(codec.open("content",invalid),null);
 assert.throws(()=>createPublicIdCodec("weak"));
});
test("short IDs have exactly ten lowercase Base36 characters and contain a letter",()=>{
 const ids=Array.from({length:1000},createShortPublicId);assert.equal(new Set(ids).size,1000);assert.ok(ids.every(id=>/^(?=.*[a-z])[a-z0-9]{10}$/.test(id)));
});
test("public pages preserve stable IDs, exact keyset order, type and visibility boundaries",async t=>{
 process.env.PUBLIC_ID_SECRET=key;const db=getPool();
 try{
 await db.query(`INSERT INTO "user"(id,name,email,"emailVerified",role,banned) VALUES('site-author','测试作者','site-author@example.invalid',false,'user',false),('site-other','另一个用户','site-other@example.invalid',false,'user',false)`);
 await db.query("INSERT INTO user_profiles(user_id,bio,homepage) VALUES('site-author','公开介绍','https://example.org')");
 const cat=(await db.query("INSERT INTO content_categories(name,slug) VALUES('建站','public-site') RETURNING id::text")).rows[0].id;
 await db.query(`INSERT INTO contents(type,title,body,category_id,status,author_id,published_at,featured,featured_at) SELECT 'post','', '正文 '||i,$1,'published','site-author',t,true,t FROM (SELECT i,'2026-10-15 10:00:00+00'::timestamptz+i*interval '1 microsecond' AS t FROM generate_series(1,25) i) x`,[cat]);
 const article=(await db.query("INSERT INTO contents(type,title,body,category_id,status,author_id,published_at) VALUES('article','真实文章','文章正文',$1,'published','site-other',now()) RETURNING id::text",[cat])).rows[0].id;
 let first:Awaited<ReturnType<typeof getSiteFeed>>;
 await t.test("local media requires a current public reference and protects avatar deletion",async()=>{
  await db.query(`INSERT INTO "user"(id,name,email,"emailVerified",role,banned) VALUES('site-media-admin','媒体管理员','site-media-admin@example.invalid',false,'admin',false)`);
  const key='2026/10/'+"a".repeat(32)+'.webp';
  const media=await insertMedia('site-media-admin','images-v1','public-fixture.webp',"a".repeat(64),{key,mime:'image/webp',size:4,width:1,height:1},{key:key.replace('.webp','-thumb.webp'),mime:'image/webp',size:4,width:1,height:1});
  assert.equal(await readPublicMediaFile(key,false),undefined);
  await db.query("INSERT INTO media_variants(media_id,variant_key,storage_provider,storage_namespace,storage_key,mime_type,byte_size,width,height,status) VALUES($1,'w960','local','images-v1',$2,'image/webp',4,960,480,'ready')",[media,key.replace('.webp','-w960.webp')]);
  assert.equal(await readPublicMediaFile(key,'w960'),undefined);
  await db.query(`UPDATE "user" SET image=$1 WHERE id='site-author'`,['/api/site-media/'+key]);
  assert.ok(await readPublicMediaFile(key,true));assert.equal((await readMediaFile(media))?.in_use,true);
  assert.equal((await readPublicMediaFile(key,'w960'))?.storage_key,key.replace('.webp','-w960.webp'));
  assert.equal(await readPublicMediaFile(key,'w1440'),undefined);
  await assert.rejects(tombstoneMedia('site-media-admin',media,1),e=>e instanceof MediaStoreError&&e.code==='in_use');
  await db.query(`UPDATE "user" SET banned=true WHERE id='site-author'`);assert.equal(await readPublicMediaFile(key,false),undefined);
  await db.query(`UPDATE "user" SET banned=false,image=NULL WHERE id='site-author'`);
  await db.query("INSERT INTO content_media(content_id,media_id,role,position,alt_text) VALUES($1,$2,'gallery',0,'测试配图')",[article,media]);
  assert.ok(await readPublicMediaFile(key,false));const presentation=(await readSitePresentation([article]))[0];assert.equal(presentation.media[0].url,'/api/site-media/'+key);assert.equal(presentation.media[0].alt,'测试配图');
  await db.query("UPDATE contents SET status='draft' WHERE id=$1",[article]);assert.equal(await readPublicMediaFile(key,false),undefined);
  assert.equal(await readPublicMediaFile(key,'w960'),undefined);
  await db.query("UPDATE contents SET status='published' WHERE id=$1",[article]);
  await db.query("UPDATE media_assets SET status='deleted',deleted_at=now() WHERE id=$1",[media]);assert.equal(await readPublicMediaFile(key,false),undefined);
  await db.query("DELETE FROM content_media WHERE media_id=$1",[media]);
 });
 await t.test("feed uses opaque stable IDs, bounded text and encrypted cursor without omissions",async()=>{
  first=await getSiteFeed("featured");assert.equal(first.items.length,20);assert.ok(first.next);const again=await getSiteFeed("featured");assert.deepEqual(first.items.map(p=>p.publicId),again.items.map(p=>p.publicId));const second=await getSiteFeed("featured",first.next!);assert.equal(second.items.length,5);assert.equal(new Set([...first.items,...second.items].map(p=>p.publicId)).size,25);assert.equal(second.next,null);
  assert.ok(first.items.every(p=>/^(?=.*[a-z])[a-z0-9]{10}$/.test(p.publicId)&&/^(?=.*[a-z])[a-z0-9]{10}$/.test(p.author.publicId)));
  assert.ok(!JSON.stringify(first).includes('site-author'));assert.ok(!JSON.stringify(first).includes('@example.invalid'));assert.ok(!('id' in first.items[0]));
  await assert.rejects(getSiteFeed("latest",first.next!),e=>e instanceof ServiceError&&e.status===400);
 });
 await t.test("detail and profile validate route kind, short ID format and canonical token",async()=>{
  const item=first.items[0],p=await getSiteContent(item.publicId,"post");assert.equal(p.publicId,item.publicId);assert.equal((await getSiteContent(item.publicId.toUpperCase(),"post")).publicId,item.publicId);assert.equal((await getSiteProfile(item.author.publicId)).bio,"公开介绍");
  for(const value of [item.author.publicId,"123",item.publicId.slice(0,-4)+"aaaa"]){await assert.rejects(getSiteContent(value,"post"),e=>e instanceof ServiceError&&e.status===404);}
  await assert.rejects(getSiteContent(item.publicId,"article"),e=>e instanceof ServiceError&&e.status===404);
  const mapped=(await db.query("SELECT content_id::text AS id FROM public_route_ids WHERE short_id=$1",[item.publicId])).rows[0];await assert.rejects(getSiteContent(codec.seal("content",mapped.id),"post"),e=>e instanceof ServiceError&&e.status===404);
 });
 await t.test("feed reports bounded text while detail retains the complete body",async()=>{
  const item=first.items[0],local=(await db.query("SELECT content_id::text AS id FROM public_route_ids WHERE short_id=$1",[item.publicId])).rows[0].id;
  const previous=(await db.query("SELECT body FROM contents WHERE id=$1",[local])).rows[0].body;
  const full="完整正文。".repeat(400);
  try{
   await db.query("UPDATE contents SET body=$2 WHERE id=$1",[local,full]);
   const preview=(await getSiteFeed("featured")).items.find(p=>p.publicId===item.publicId)!;
   assert.equal(preview.body.length,1500);assert.equal(preview.bodyTruncated,true);
   const detail=await getSiteContent(item.publicId,"post");assert.equal(detail.body,full);assert.equal(detail.bodyTruncated,false);
  }finally{await db.query("UPDATE contents SET body=$2 WHERE id=$1",[local,previous]);}
 });
 await t.test("public discussion bounds pages, hides moderated threads and binds opaque cursors",async()=>{
  const item=first.items[0],other=first.items[1];
  const id=(await db.query("SELECT content_id::text AS id FROM public_route_ids WHERE short_id=$1",[item.publicId])).rows[0].id;
  const insert=async(body:string,root?:string,author="site-author")=>(await db.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,$3,$4,$4) RETURNING id::text",[id,author,body,root??null])).rows[0].id as string;
  try{
   for(let i=0;i<12;i++)await insert("根评论 "+i);
   const root=await insert("可见根评论");
   for(let i=0;i<5;i++)await insert("回复 "+i,root);
   const hidden=await insert("隐藏评论");await db.query("UPDATE comments SET status='hidden' WHERE id=$1",[hidden]);
   await insert("隐藏根下的回复",hidden);
   const hiddenThread=await insert("隐藏整串");await insert("隐藏整串的回复",hiddenThread);await db.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[hiddenThread]);
   const page=await getSiteDiscussion(item.publicId,"post");
   assert.equal(page.threads.length,10);assert.ok(page.next);assert.equal(page.threads[0].comment.body,"可见根评论");
   assert.equal(page.threads[0].replies.length,3);assert.ok(page.threads[0].next);
   assert.equal(page.threads[0].comment.replies,5);
   assert.equal(readCommentActionToken(page.threads[0].comment.actionToken,item.publicId),root);
   assert.throws(()=>readCommentActionToken(page.threads[0].comment.actionToken,other.publicId),e=>e instanceof ServiceError&&e.status===400);
   assert.throws(()=>readCommentActionToken(page.threads[0].token,item.publicId),e=>e instanceof ServiceError&&e.status===400);
   assert.deepEqual(page.threads[0].comment.interaction.myReactions,[]);
   assert.equal(page.threads[0].comment.interaction.bookmarked,false);
   assert.ok(!JSON.stringify(page).includes("隐藏"));assert.ok(!JSON.stringify(page).includes("site-author"));assert.ok(!("id" in page.threads[0].comment));
   assert.equal((await readSitePresentation([id]))[0].comments,18);
   assert.equal((await getSiteContentHead(item.publicId,"post")).updatedAt,page.head.updatedAt);
   const next=await getSiteDiscussion(item.publicId,"post",{commentsBefore:page.next!});assert.equal(next.threads.length,3);
   const tail=await getSiteDiscussion(item.publicId,"post",{thread:page.threads[0].token,repliesBefore:page.threads[0].next!});assert.equal(tail.threads[0].replies.length,2);
   for(const input of [{commentsBefore:"1"},{commentsBefore:page.threads[0].token},{repliesBefore:page.threads[0].next!}])await assert.rejects(getSiteDiscussion(item.publicId,"post",input),e=>e instanceof ServiceError&&e.status===400);
   await assert.rejects(getSiteDiscussion(other.publicId,"post",{commentsBefore:page.next!}),e=>e instanceof ServiceError&&e.status===400);
   await assert.rejects(getSiteDiscussion(item.publicId,"article"),e=>e instanceof ServiceError&&e.status===404);
   const bannedRoot=await insert("封禁作者的根",undefined,"site-other");await insert("封禁根下的回复",bannedRoot);
   await insert("封禁作者的回复",root,"site-other");
   await db.query(`UPDATE "user" SET banned=true WHERE id='site-other'`);
   assert.ok(!JSON.stringify(await getSiteDiscussion(item.publicId,"post")).includes("封禁"));
   await db.query(`UPDATE "user" SET banned=false WHERE id='site-other'`);
   await db.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[root]);
   assert.equal((await getSiteDiscussion(item.publicId,"post",{thread:page.threads[0].token})).threads.length,0);
   await db.query("UPDATE contents SET status='draft' WHERE id=$1",[id]);await assert.rejects(getSiteDiscussion(item.publicId,"post"),e=>e instanceof ServiceError&&e.status===404);
   await db.query("UPDATE contents SET status='published' WHERE id=$1",[id]);
   await db.query(`UPDATE "user" SET banned=true WHERE id='site-author'`);await assert.rejects(getSiteDiscussion(item.publicId,"post"),e=>e instanceof ServiceError&&e.status===404);
  }finally{
   await db.query(`UPDATE "user" SET banned=false WHERE id IN ('site-author','site-other')`);await db.query("UPDATE contents SET status='published' WHERE id=$1",[id]);await db.query("DELETE FROM comments WHERE content_id=$1",[id]);
  }
 });
 await t.test("discussion pages include deep reply chains in batches with parent-bound pagination",async()=>{
  const item=first.items[0],other=first.items[1];
  const id=(await db.query("SELECT content_id::text AS id FROM public_route_ids WHERE short_id=$1",[item.publicId])).rows[0].id;
  const insert=async(body:string,root:string|null=null,target:string|null=null)=>(await db.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,'site-author',$2,$3,$4) RETURNING id::text",[id,body,root,target])).rows[0].id as string;
  try{
   const root=await insert("独立评论详情");
   let child="";
   for(let i=0;i<12;i++)child=await insert("直接回复 "+i,root,root);
   let target=child;
   for(let i=0;i<12;i++)target=await insert("回复的回复 "+i,root,target);
   const [page,again]=await Promise.all([getSiteDiscussion(item.publicId,"post"),getSiteDiscussion(item.publicId,"post")]);
   const publicRoot=page.threads[0].comment.publicId;
   assert.match(publicRoot,/^(?=.*[a-z])[a-z0-9]{10}$/);
   assert.equal(publicRoot,again.threads[0].comment.publicId);
   assert.equal(page.threads[0].comment.replies,24);
   assert.deepEqual(page.threads[0].replies.map(reply=>reply.body),["直接回复 0","直接回复 1","直接回复 2"]);
   const first=page.threads[0];
   assert.equal(first.replies.length,3);assert.ok(first.next);
   const childId=(await commentRoutes([child])).get(child)!;
   const childPreview=await getSiteReplyBranch(childId,undefined);
   assert.equal(childPreview.items.length,5);assert.ok(childPreview.next);
   assert.ok(childPreview.items.every(reply=>reply.body.startsWith("回复的回复")));
   const nestedMore=await getSiteReplyBranch(childId,childPreview.next!);
   assert.equal(nestedMore.items.length,5);assert.ok(nestedMore.next);
   const nestedLast=await getSiteReplyBranch(childId,nestedMore.next!);
   assert.equal(nestedLast.items.length,2);assert.equal(nestedLast.next,null);
   assert.equal(new Set([...childPreview.items,...nestedMore.items,...nestedLast.items].map(reply=>reply.publicId)).size,12);
   assert.deepEqual([...childPreview.items,...nestedMore.items,...nestedLast.items].map(reply=>reply.body),Array.from({length:12},(_,i)=>"回复的回复 "+i));
   await assert.rejects(getSiteReplyBranch(publicRoot,childPreview.next!),e=>e instanceof ServiceError&&e.status===400);
   const second=(await getSiteDiscussion(item.publicId,"post",{thread:first.token,repliesBefore:first.next!})).threads[0];
   assert.equal(second.replies.length,5);assert.ok(second.next);
   const allReplies=[...first.replies,...second.replies];
   let nextReply=second.next;
   while(nextReply){
    const batch=(await getSiteDiscussion(item.publicId,"post",{thread:first.token,repliesBefore:nextReply})).threads[0];
    assert.equal(batch.replies.length,batch.next?5:1);
    allReplies.push(...batch.replies);nextReply=batch.next;
   }
   assert.equal(allReplies.length,24);assert.equal(new Set(allReplies.map(reply=>reply.publicId)).size,24);
   assert.deepEqual(allReplies.map(reply=>reply.body),[...Array.from({length:12},(_,i)=>"直接回复 "+i),...Array.from({length:12},(_,i)=>"回复的回复 "+i)]);
   const selected=await getSiteDiscussion(item.publicId,"post",{comment:publicRoot});
   assert.equal(selected.selected?.body,"独立评论详情");
   const content=await getSiteContent(publicRoot,"comment");
   assert.equal(content.body,"独立评论详情");assert.equal(content.type,"comment");
   assert.equal(content.comment?.parentPublicId,item.publicId);
   assert.equal((await getSiteDiscussion(publicRoot,"comment")).head.publicId,publicRoot);
   assert.ok((await getSiteFeed("latest")).items.every(row=>row.type!=="comment"));
   await db.query("UPDATE public_comment_ids SET short_id=$2 WHERE comment_id=$1",[root,item.publicId]);
   assert.equal((await getSiteContent(item.publicId,"comment")).body,"独立评论详情");
   assert.equal((await getSiteContent(item.publicId,"post")).type,"post");
   await db.query("UPDATE public_comment_ids SET short_id=$2 WHERE comment_id=$1",[root,publicRoot]);
   assert.equal(selected.threads.length,5);assert.ok(selected.next);
   assert.ok(selected.threads.every(thread=>thread.comment.body.startsWith("直接回复")&&thread.replies.length===0));
   const selectedIds=selected.threads.map(thread=>thread.comment.publicId);
   let nextSelected=selected.next;
   while(nextSelected){
    const tail=await getSiteDiscussion(item.publicId,"post",{comment:publicRoot,repliesBefore:nextSelected});
    assert.equal(tail.threads.length,tail.next?5:4);
    selectedIds.push(...tail.threads.map(thread=>thread.comment.publicId));nextSelected=tail.next;
   }
   assert.equal(selectedIds.length,24);assert.equal(new Set(selectedIds).size,24);
   assert.deepEqual(selectedIds,allReplies.map(reply=>reply.publicId));
   const indexed=await getSiteSitemap();
   // Comment pages are noindex and canonical to their thread, so the sitemap stays content-only.
   assert.ok(indexed.every(row=>!row.path.startsWith("/c/")&&!row.path.startsWith("/comments/")));
   const publicChild=childId;
   const nested=await getSiteDiscussion(item.publicId,"post",{comment:publicChild});
   assert.equal(nested.selected?.body,"直接回复 11");assert.equal(nested.selected?.replies,12);
   // A new deep reply refreshes every ancestor, not just the list owner.
   const newest=await insert("新增深层回复",root,target);
   const newestPublic=(await commentRoutes([newest])).get(newest)!;
   const ancestorCounts=await getSiteAncestorReplyCounts(newestPublic);
   assert.equal(ancestorCounts.find(row=>row.publicId===publicRoot)?.count,25);
   assert.equal(ancestorCounts.find(row=>row.publicId===publicChild)?.count,13);
   assert.equal(ancestorCounts.find(row=>row.publicId===nested.threads[0].comment.publicId)?.count,12);
   assert.ok(!ancestorCounts.some(row=>row.publicId===newestPublic));
   assert.equal((await getSiteContent(publicRoot,"comment")).comments,25);
   assert.equal((await getSiteContent(publicChild,"comment")).comments,13);
   await db.query("UPDATE comments SET status='hidden' WHERE id=$1",[newest]);
   assert.deepEqual(await getSiteAncestorReplyCounts(newestPublic),[]);
   assert.equal((await getSiteContent(publicChild,"comment")).comments,12);
   await db.query("DELETE FROM comments WHERE id=$1",[newest]);
   assert.equal(nested.threads.length,5);assert.ok(nested.threads.every(thread=>thread.comment.body.startsWith("回复的回复")));
   await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment:publicChild,repliesBefore:selected.next!}),e=>e instanceof ServiceError&&e.status===400);
   await assert.rejects(getSiteDiscussion(other.publicId,"post",{comment:publicRoot}),e=>e instanceof ServiceError&&e.status===404);
   await assert.rejects(getSiteDiscussion(item.publicId,"article",{comment:publicRoot}),e=>e instanceof ServiceError&&e.status===404);
   await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment:root}),e=>e instanceof ServiceError&&e.status===404);
   await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment:publicRoot,thread:page.threads[0].token}),e=>e instanceof ServiceError&&e.status===400);
   assert.ok(!("id" in nested.selected!));assert.ok(!JSON.stringify(nested).includes("site-author"));
   await db.query("UPDATE comments SET status='hidden' WHERE id=$1",[child]);
   await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment:publicChild}),e=>e instanceof ServiceError&&e.status===404);
   await assert.rejects(getSiteReplyBranch(publicChild,undefined),e=>e instanceof ServiceError&&e.status===404);
   const hiddenBranch=await getSiteReplyBranch(publicRoot,undefined);
   assert.ok(hiddenBranch.items.every(reply=>reply.body.startsWith("直接回复")));
   await db.query("UPDATE comments SET status='visible' WHERE id=$1",[child]);
   await db.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[root]);
   assert.deepEqual(await getSiteAncestorReplyCounts(publicChild),[]);
   for(const comment of [publicRoot,publicChild,nested.threads[0].comment.publicId])await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment}),e=>e instanceof ServiceError&&e.status===404);
   assert.ok(!(await getSiteSitemap()).some(row=>row.path.startsWith("/comments/")));
   await assert.rejects(getSiteContent(publicRoot,"comment"),e=>e instanceof ServiceError&&e.status===404);
   await db.query("UPDATE comments SET thread_hidden=false WHERE id=$1",[root]);
   const otherRoot=(await db.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,'site-other','另一作者的根评论') RETURNING id::text",[id])).rows[0].id;
   await insert("另一作者线程内的回复",otherRoot,otherRoot);
   const otherReply=(await getSiteDiscussion(item.publicId,"post")).threads[0].replies[0].publicId;
   await db.query(`UPDATE "user" SET banned=true WHERE id='site-other'`);
   await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment:otherReply}),e=>e instanceof ServiceError&&e.status===404);
   assert.ok(!(await getSiteSitemap()).some(row=>row.path.endsWith("/"+otherReply)));
   await db.query(`UPDATE "user" SET banned=false WHERE id='site-other'`);
   await db.query("UPDATE contents SET status='draft' WHERE id=$1",[id]);
   await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment:publicRoot}),e=>e instanceof ServiceError&&e.status===404);
   await db.query("UPDATE contents SET status='published' WHERE id=$1",[id]);
   await db.query(`UPDATE "user" SET banned=true WHERE id='site-author'`);
   await assert.rejects(getSiteDiscussion(item.publicId,"post",{comment:publicChild}),e=>e instanceof ServiceError&&e.status===404);
  }finally{
   await db.query(`UPDATE "user" SET banned=false WHERE id IN ('site-author','site-other')`);
   await db.query("UPDATE contents SET status='published' WHERE id=$1",[id]);
   await db.query("DELETE FROM comments WHERE content_id=$1",[id]);
  }
 });
 await t.test("concurrent allocation is stable and database rejects duplicate short IDs",async()=>{
  await assert.rejects(db.query("UPDATE public_route_ids SET short_id=upper(short_id) WHERE short_id=$1",[first.items[0].publicId]),e=>(e as {code?:string}).code==="23514");
  const pages=await Promise.all(Array.from({length:6},()=>getSiteFeed("articles")));assert.ok(pages.every(p=>p.items[0].publicId===pages[0].items[0].publicId));
  await db.query('INSERT INTO "user"(id,name,email,"emailVerified",role,banned) VALUES(\'site-collision\',\'碰撞测试\',\'collision@example.invalid\',false,\'user\',false)');
  await assert.rejects(savePublicRouteIds([{kind:"user",content_id:null,user_id:"site-collision",token:first.items[0].publicId}]),e=>(e as {code?:string}).code==="23505");
 });
 await t.test("published articles use the article route while drafts, archived and banned authors remain hidden",async()=>{
  const a=(await getSiteFeed("articles")).items[0];assert.equal((await getSiteContent(a.publicId,"article")).title,"真实文章");await assert.rejects(getSiteContent(a.publicId,"post"));await db.query("UPDATE contents SET status='archived' WHERE id=$1",[article]);await assert.rejects(getSiteContent(a.publicId,"article"),e=>e instanceof ServiceError&&e.status===404);
  await db.query(`UPDATE "user" SET banned=true WHERE id='site-author'`);assert.equal((await getSiteFeed()).items.length,0);await assert.rejects(getSiteProfile(first.items[0].author.publicId),e=>e instanceof ServiceError&&e.status===404);await db.query(`UPDATE "user" SET banned=false WHERE id='site-author'`);
 });
 await t.test("source demo records are excluded from indexed feed and sitemap",async()=>{
  await db.query("INSERT INTO demo_imports(id,source_url,captured_at,dataset_hash) VALUES('site-test','https://bonjour.bio/?feed=featured',now(),$1)",["a".repeat(64)]);const content=(await db.query("SELECT content_id::text AS id FROM public_route_ids WHERE short_id=$1",[first.items[0].publicId])).rows[0].id;
  await db.query("INSERT INTO demo_import_objects(batch_id,kind,source_id,local_id,source_url,snapshot) VALUES('site-test','content','source1',$1,'https://bonjour.bio/posts/source1','{}')",[content]);
  const page=await getSiteFeed("featured",undefined,true);assert.ok(!page.items.some(p=>p.publicId===first.items[0].publicId));const sitemap=await getSiteSitemap();assert.ok(!sitemap.some(p=>p.path.endsWith(first.items[0].publicId)));assert.ok(sitemap.every(p=>/^\/threads\/[a-z0-9]{10}$/.test(p.path)||/^\/p\/[a-z0-9]{10}$/.test(p.path)));
 });
 await t.test("HTTP routes reject numeric IDs and emit safe JSON-LD, noindex and canonical controls",async()=>{
  const root=path.resolve(import.meta.dirname,"../../.."),base="http://127.0.0.1:3197";
  const server=spawn(process.execPath,[path.join(root,"apps/web/node_modules/next/dist/bin/next"),"start","-p","3197","-H","127.0.0.1"],{cwd:path.join(root,"apps/web"),windowsHide:true,env:{...process.env,SITE_INDEXING_ENABLED:"true",SITE_URL:"https://sohoin.com",BETTER_AUTH_URL:base},stdio:"ignore"});
  try{
   let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+"/robots.txt")).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw new Error("Test public server failed");await delay(100);}assert.ok(ready);
   const req=(p:string)=>fetch(base+p,{headers:{"User-Agent":"Googlebot"},redirect:"manual"});
   for(const p of ["/t/123","/p/123","/members/123","/comments/123","/threads/123","/discussions/123","/c/123","/u/123","/content","/content/1"]){assert.equal((await req(p)).status,404,p);}
   const item=(await getSiteFeed("featured",undefined,true)).items[0];const postPath="/threads/"+item.publicId;const id=(await db.query("SELECT content_id::text AS id FROM public_route_ids WHERE short_id=$1",[item.publicId])).rows[0].id;
   const dangerous='正文 </script><script>alert(1)</script>';await db.query("UPDATE contents SET body=$2 WHERE id=$1",[id,dangerous]);
   const detail=await req(postPath);assert.equal(detail.status,200);const html=await detail.text();assert.ok(!html.includes('<script>alert(1)</script>'));
   const full=await req("/api/site/content/post/"+item.publicId);assert.equal(full.status,200);assert.match(full.headers.get("cache-control")??"",/no-store/);assert.equal(full.headers.get("x-robots-tag"),"noindex");assert.equal((await full.json()).content.body,dangerous);
   assert.equal((await req("/api/site/content/article/"+item.publicId)).status,404);assert.equal((await req("/api/site/content/post/123")).status,404);
   const data=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));const posting=data.find(x=>x['@type']==='DiscussionForumPosting');assert.ok(posting);assert.equal(posting.text,dangerous);assert.ok(posting.url.startsWith('https://sohoin.com'+postPath));
   // A skeleton must never replace server-delivered, crawlable public content.
   for(const agent of ["Googlebot","Mozilla/5.0"]){
    const home=await fetch(base+"/",{headers:{"User-Agent":agent}});assert.equal(home.status,200);
    const source=await home.text(),articles=source.match(/<article\b[^>]*>[\s\S]*?<\/article>/g)??[];
    assert.ok(articles.some(article=>article.includes(postPath)&&article.includes("正文")));
    assert.equal((source.match(/<h1[ >]/g)??[]).length,1);assert.ok(source.includes('rel="canonical"'));assert.ok(!source.includes('<script>alert(1)</script>'));
   }
   const invalidCursor=await (await req("/?after=invalid")).text();assert.ok(invalidCursor.includes("分页地址已失效"));assert.equal((invalidCursor.match(/<h1[ >]/g)??[]).length,1);assert.match(invalidCursor,/<meta name="robots" content="noindex, follow"/);
   const alias=await req("/threads/"+item.publicId.toUpperCase());assert.equal(alias.status,308);assert.equal(alias.headers.get("location"),postPath);
   const userAlias=await req("/members/"+item.author.publicId.toUpperCase());assert.equal(userAlias.status,308);assert.equal(userAlias.headers.get("location"),"/members/"+item.author.publicId);
   assert.equal((await req("/u/"+item.author.publicId)).status,404);
   assert.equal((await req("/p/"+item.publicId)).status,404);const user=await req("/members/"+item.author.publicId);assert.equal(user.status,200);const userHtml=await user.text();assert.ok(!userHtml.includes('site-author@example.invalid'));assert.ok(userHtml.includes('ProfilePage'));
   const demoItem=first.items[0];const demoPath="/threads/"+demoItem.publicId;const demoHtml=await (await req(demoPath)).text();assert.match(demoHtml,/<meta name="robots" content="noindex, follow"/);assert.ok(!demoHtml.includes('application/ld+json'));
   await db.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,'site-author',$2)",[id,dangerous]);
   const publicComment=(await getSiteDiscussion(item.publicId,"post")).threads[0].comment.publicId,commentPath="/comments/"+publicComment;
   const commentResponse=await req(commentPath);assert.equal(commentResponse.status,200);
   const commentHtml=await commentResponse.text();
   // Comment pages stay reachable but are noindex and canonical to the parent thread.
   assert.match(commentHtml,/<meta name="robots" content="noindex, follow"/);
   const parentPath=postPath;
   assert.ok(commentHtml.includes('rel="canonical" href="https://sohoin.com'+parentPath+'"'));
   assert.equal((commentHtml.match(/<h1[ >]/g)??[]).length,1);
   const commentData=[...commentHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(x=>x['@type']==='Comment');
   assert.equal(commentData?.text,dangerous);assert.ok(!commentHtml.includes('<script>alert(1)</script>'));
   assert.equal((await req(postPath+"/"+publicComment)).status,404);
   const map=await (await req('/sitemap.xml')).text();assert.ok(!map.includes('https://sohoin.com'+commentPath));assert.ok(!map.includes(first.items[0].publicId));assert.ok(!map.includes('/content/'));assert.ok(map.includes('https://sohoin.com/threads/'));
  }finally{server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),delay(3000)]);}
 });
 }finally{await db.end();}
});
