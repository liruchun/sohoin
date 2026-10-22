import test from "node:test";
import {writeProfile,sendSystemNotification} from "@sohoin/database";
import {verifyActivityUpgrade} from "./activity-upgrade";
import assert from "node:assert/strict";
import path from "node:path";
import {mkdir,writeFile,readFile,lstat,utimes,rm,appendFile} from "node:fs/promises";
import {randomBytes,createHash} from "node:crypto";
import sharp from "sharp";
import {getPool,Pool,acquireMediaStorageLock,MediaMaintenanceBusyError,ADMIN_PERMISSIONS_LOCK} from "@sohoin/database";
import {cleanupMedia} from "../scripts/lib/media-cleanup";
import {mediaRoot,safeMediaFile} from "../scripts/lib/media-files";
import {backupSite,restoreSite} from "../scripts/lib/site-backup";

test("database integrity, file maintenance and actual backup restore",async t=>{
 const root=mediaRoot(),base=path.dirname(root),stem=path.basename(root),backupBase=path.join(base,stem+"-backups"),restored=path.join(base,stem+"-restored");
 const suffix=randomBytes(8).toString("hex"),actor="maintenance-"+suffix;const targetName="sohoin_restore_"+suffix,targetUrl=new URL(process.env.DATABASE_URL!);targetUrl.pathname="/"+targetName;
 const pool=getPool();await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,'Maintenance test',$2,false,'admin')`,[actor,actor+"@example.test"]);
 const bytes=await sharp({create:{width:16,height:10,channels:3,background:"white"}}).webp().toBuffer();
 const key=()=>`2026/10/${randomBytes(16).toString("hex")}.webp`;
 async function file(key:string,old=false){const target=await safeMediaFile(root,"images-v1/"+key);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:"wx"});if(old)await utimes(target,new Date(0),new Date(Date.now()-72*3600000));return target;}
 async function asset(key:string){return (await pool.query(`INSERT INTO media_assets(uploader_id,storage_provider,storage_namespace,storage_key,original_name,kind,mime_type,byte_size,width,height,status,checksum_sha256) VALUES($1,'local','images-v1',$2,'维护验证','image','image/webp',$3,16,10,'ready',$4) RETURNING id::text`,[actor,key,bytes.length,createHash("sha256").update(bytes).digest("hex")])).rows[0].id as string;}
 try{
  await t.test("activity migration backfills history without private bookmarks or duplicate republishing",verifyActivityUpgrade);
  await t.test("database rejects orphan authors, oversized text, invalid versions and invalid categories",async()=>{
   await assert.rejects(()=>pool.query("INSERT INTO contents(type,title,status,author_id) VALUES('article','x','draft','missing-author')"),e=>(e as {code:string}).code==="23503");
   await assert.rejects(()=>pool.query("INSERT INTO contents(type,title,status,author_id) VALUES('article',$1,'draft',$2)",["x".repeat(161),actor]),e=>(e as {code:string}).code==="23514");
   await assert.rejects(()=>pool.query("INSERT INTO contents(type,title,status,author_id,version) VALUES('article','x','draft',$1,-1)",[actor]),e=>(e as {code:string}).code==="23514");
   await assert.rejects(()=>pool.query("INSERT INTO content_categories(name,slug) VALUES('x','Invalid Slug')"),e=>(e as {code:string}).code==="23514");
   const content=(await pool.query("INSERT INTO contents(type,title,status,author_id) VALUES('article','保留作者','draft',$1) RETURNING id",[actor])).rows[0].id;
   await assert.rejects(()=>pool.query('DELETE FROM "user" WHERE id=$1',[actor]),e=>(e as {code:string}).code==="23503");await pool.query("DELETE FROM contents WHERE id=$1",[content]);
  });
  await t.test("maintenance excludes uploads/deletes and always releases its session lock",async()=>{
   const permissions=await pool.connect();try{await permissions.query("BEGIN");await permissions.query("SELECT pg_advisory_xact_lock($1)",[ADMIN_PERMISSIONS_LOCK]);const unrelated=await acquireMediaStorageLock(true);await unrelated();}finally{await permissions.query("ROLLBACK");permissions.release();}
   const shared=await acquireMediaStorageLock(),other=await acquireMediaStorageLock();await assert.rejects(()=>acquireMediaStorageLock(true),MediaMaintenanceBusyError);await shared();await other();const exclusive=await acquireMediaStorageLock(true);await assert.rejects(()=>acquireMediaStorageLock(),MediaMaintenanceBusyError);await exclusive();const again=await acquireMediaStorageLock();await again();
   const hold=await acquireMediaStorageLock();await assert.rejects(()=>backupSite(backupBase),MediaMaintenanceBusyError);await hold();
  });
  let readyKey="",readyId="",thumbKey="";
  await t.test("cleanup defaults to dry run and preserves ready, young and out-of-scope files",async()=>{
   readyKey=key();readyId=await asset(readyKey);await file(readyKey,true);thumbKey=readyKey.replace(".webp","-thumb.webp");await file(thumbKey,true);await pool.query(`INSERT INTO media_variants(media_id,variant_key,storage_provider,storage_namespace,storage_key,mime_type,byte_size,width,height,status) VALUES($1,'thumbnail','local','images-v1',$2,'image/webp',$3,16,10,'ready')`,[readyId,thumbKey,bytes.length]);
   const deletedKey=key(),deletedId=await asset(deletedKey),deletedFile=await file(deletedKey);await pool.query("UPDATE media_assets SET status='deleted',deleted_at=now() WHERE id=$1",[deletedId]);
   const orphan=await file(key(),true),young=await file(key());const note=path.join(root,"notes.txt");await writeFile(note,"preserve");
   const preview=await cleanupMedia();assert.equal(preview.dryRun,true);assert.equal(preview.candidates,2);assert.equal(preview.removed,0);await lstat(orphan);await lstat(deletedFile);
   const applied=await cleanupMedia({apply:true});assert.equal(applied.removed,2);assert.equal(applied.failed,0);await assert.rejects(()=>lstat(orphan));await assert.rejects(()=>lstat(deletedFile));await lstat(young);await lstat(await safeMediaFile(root,"images-v1/"+readyKey));assert.equal(await readFile(note,"utf8"),"preserve");
   await assert.rejects(()=>safeMediaFile(root,"images-v1/../../escape.webp"));await assert.rejects(()=>cleanupMedia({apply:true,graceHours:0}));
  });
  await t.test("pg_dump and pg_restore recover business rows and actual media bytes into new targets",async()=>{
   const content=(await pool.query("INSERT INTO contents(type,title,body,status,author_id) VALUES('article','备份恢复验证','正文','draft',$1) RETURNING id",[actor])).rows[0].id;await pool.query("INSERT INTO content_media(content_id,media_id,role) VALUES($1,$2,'cover')",[content,readyId]);
   const comment=(await pool.query("INSERT INTO comments(content_id,author_id,body,thread_hidden) VALUES($1,$2,'备份一级评论',true) RETURNING id",[content,actor])).rows[0].id;
   await pool.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,'备份回复',$3,$3)",[content,actor,comment]);
   await pool.query("INSERT INTO comment_audit(actor_id,comment_id,content_id,action,before_status,after_status,before_thread_hidden,after_thread_hidden) VALUES($1,$2,$3,'hide_thread','visible','visible',false,true)",[actor,comment,content]);
   await pool.query(`INSERT INTO "session"(id,"expiresAt",token,"userId","updatedAt") VALUES($1,now()+interval '1 day',$2,$3,now())`,["restore-session-"+suffix,randomBytes(24).toString("hex"),actor]);
   await pool.query("INSERT INTO content_reactions(content_id,user_id,code) VALUES($1,$2,'like')",[content,actor]);
   await pool.query("INSERT INTO comment_reactions(comment_id,user_id,code) VALUES($1,$2,'love')",[comment,actor]);
   await pool.query("INSERT INTO content_bookmarks(content_id,user_id) VALUES($1,$2)",[content,actor]);
   await pool.query("INSERT INTO comment_bookmarks(comment_id,user_id) VALUES($1,$2)",[comment,actor]);
   const follower=actor+'-follower';await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified",role) VALUES($1,'备份关注用户',$2,false,'user')`,[follower,follower+'@example.test']);
   await pool.query("INSERT INTO user_follows(follower_id,following_id) VALUES($1,$2),($2,$1)",[actor,follower]);
   await writeProfile(actor,actor,{version:0,bio:'备份介绍',homepage:'https://example.test'},true,{schemaVersion:1,data:{city:'杭州',secret:'备份私密字段'}});
   await sendSystemNotification(actor,{recipientId:follower,key:'backup-system',title:'备份系统消息',body:'恢复消息正文'});
   const backup=await backupSite(backupBase);assert.equal(backup.fileCount,2);assert.equal(backup.counts.contents,"1");assert.equal(backup.counts.user_follows,"2");assert.equal(backup.counts.user_activities,"4");assert.equal(backup.counts.user_profiles,"1");assert.equal(backup.counts.notifications,"3");assert.equal(backup.counts.comments,"2");for(const table of ["content_reactions","comment_reactions","content_bookmarks","comment_bookmarks"])assert.equal(backup.counts[table],"1");assert.equal(backup.counts.comment_audit,"1");const result=await restoreSite(backup.directory,targetUrl.toString(),restored);assert.equal(result.fileCount,2);assert.equal(result.loginSessionsRevoked,true);
   const recovered=new Pool({connectionString:targetUrl.toString(),max:1});try{assert.equal((await recovered.query("SELECT bio FROM user_profiles WHERE user_id=$1",[actor])).rows[0].bio,"备份介绍");assert.equal((await recovered.query("SELECT data FROM user_extensions WHERE user_id=$1",[actor])).rows[0].data.secret,"备份私密字段");assert.equal((await recovered.query("SELECT body FROM notifications WHERE system_key='backup-system'")).rows[0].body,"恢复消息正文");assert.equal((await recovered.query("SELECT count(*)::int AS n FROM user_activities WHERE actor_id=$1",[actor])).rows[0].n,4);assert.equal((await recovered.query("SELECT count(*)::int AS n FROM user_follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)",[actor,follower])).rows[0].n,2);for(const table of ["content_reactions","comment_reactions","content_bookmarks","comment_bookmarks"])assert.equal((await recovered.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,1);assert.equal((await recovered.query("SELECT code FROM comment_reactions WHERE comment_id=$1",[comment])).rows[0].code,"love");assert.equal((await recovered.query("SELECT body,root_id,reply_to_id FROM comments WHERE root_id=$1",[comment])).rows[0].body,"备份回复");assert.equal((await recovered.query("SELECT thread_hidden FROM comments WHERE id=$1",[comment])).rows[0].thread_hidden,true);assert.equal((await recovered.query("SELECT count(*)::int AS n FROM comment_audit")).rows[0].n,1);assert.equal((await recovered.query("SELECT title FROM contents WHERE id=$1",[content])).rows[0].title,"备份恢复验证");assert.equal((await recovered.query("SELECT count(*)::int AS n FROM content_media")).rows[0].n,1);assert.equal((await recovered.query('SELECT count(*)::int AS n FROM "session"')).rows[0].n,0);}finally{await recovered.end();}
   assert.deepEqual(await readFile(await safeMediaFile(restored,"images-v1/"+readyKey)),bytes);assert.deepEqual(await readFile(await safeMediaFile(restored,"images-v1/"+thumbKey)),bytes);
   await assert.rejects(()=>restoreSite(backup.directory,targetUrl.toString(),restored),/already exists/);await assert.rejects(()=>restoreSite(backup.directory,targetUrl.toString(),root),/separate/);if(process.platform==="win32")await assert.rejects(()=>restoreSite(backup.directory,targetUrl.toString(),root.toUpperCase()),/separate/);
   await appendFile(path.join(backup.directory,"files.jsonl"),"corrupted\n");await assert.rejects(()=>restoreSite(backup.directory,targetUrl.toString(),restored+"-tampered"),/checksum/);
   assert.equal((await pool.query("SELECT title FROM contents WHERE id=$1",[content])).rows[0].title,"备份恢复验证");
  });
 }finally{
  if(!/^sohoin_restore_[a-f0-9]{16}$/.test(targetName)||targetName===decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1)))throw new Error("Unsafe restore test database");
  await pool.query('DROP DATABASE IF EXISTS "'+targetName+'" WITH (FORCE)');
  for(const directory of [backupBase,restored]){if(path.dirname(path.resolve(directory))!==base||!path.basename(directory).startsWith(stem+"-"))throw new Error("Unsafe maintenance test path");await rm(directory,{recursive:true,force:true});}
  await pool.end();
 }
});
