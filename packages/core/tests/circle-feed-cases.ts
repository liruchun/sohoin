import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {getPool,readSiteCircleFeed} from "@sohoin/database";
import {getSiteCircleFeed} from "../src/server/public-site";
import {ServiceError} from "../src/server/security";

/** Run only in the public-site runner's disposable database. */
export async function circleFeedCases(){
 const db=getPool(),prefix="circle-"+randomBytes(6).toString("hex");
 const [me,followed,stranger,follower]=["me","followed","stranger","follower"].map(x=>prefix+x);
 const users=[me,followed,stranger,follower];
 const category=(await db.query("INSERT INTO content_categories(name,slug) VALUES($1,$1) RETURNING id",[prefix])).rows[0].id;
 try{
  for(const id of users)await db.query('INSERT INTO "user"(id,name,email,"emailVerified",role,banned) VALUES($1,$1,$2,false,\'user\',false)',[id,id+"@example.invalid"]);
  await db.query("INSERT INTO user_follows(follower_id,following_id) VALUES($1,$2),($3,$1)",[me,followed,follower]);
  const post=async(author:string)=>(await db.query("INSERT INTO contents(type,title,body,category_id,status,author_id,published_at) VALUES('post','','Circle post',$1,'published',$2,'2026-10-22T00:00:00Z') RETURNING id::text",[category,author])).rows[0].id as string;
  const comment=async(content:string,author:string)=>(await db.query("INSERT INTO comments(content_id,author_id,body) VALUES($1,$2,'Comment') RETURNING id::text",[content,author])).rows[0].id as string;
  const own=await post(me),published=await post(followed),discussed=await post(stranger),reacted=await post(stranger),commentLiked=await post(stranger),unrelated=await post(stranger),incoming=await post(follower);
  const discussion=await comment(discussed,followed),target=await comment(commentLiked,stranger);
  await db.query("INSERT INTO content_reactions(content_id,user_id,code) VALUES($1,$2,'like'),($1,$2,'love'),($1,$3,'like')",[reacted,followed,me]);
  await db.query("INSERT INTO comment_reactions(comment_id,user_id,code) VALUES($1,$2,'like')",[target,followed]);
  const ids=async()=>new Set((await readSiteCircleFeed(me,null,false)).map(r=>r.id));
  assert.deepEqual(await ids(),new Set([own,published,discussed,reacted,commentLiked]));
  assert.ok(!(await ids()).has(unrelated)&&!(await ids()).has(incoming));
  await db.query("UPDATE comments SET status='hidden' WHERE id=$1",[discussion]);
  assert.ok(!(await ids()).has(discussed));
  await db.query("UPDATE comments SET status='visible' WHERE id=$1",[discussion]);
  // A reaction to a reply in a hidden/deleted thread must not admit the post.
  await db.query("DELETE FROM comment_reactions WHERE comment_id=$1",[target]);
  const reply=(await db.query("INSERT INTO comments(content_id,author_id,body,root_id,reply_to_id) VALUES($1,$2,'Reply',$3,$3) RETURNING id::text",[commentLiked,stranger,target])).rows[0].id;
  await db.query("INSERT INTO comment_reactions(comment_id,user_id,code) VALUES($1,$2,'like')",[reply,followed]);
  assert.ok((await ids()).has(commentLiked));
  await db.query("UPDATE comments SET thread_hidden=true WHERE id=$1",[target]);
  assert.ok(!(await ids()).has(commentLiked));
  await db.query("UPDATE comments SET thread_hidden=false,status='deleted',body='',deleted_at=now() WHERE id=$1",[target]);
  assert.ok(!(await ids()).has(commentLiked));
  await db.query("DELETE FROM user_follows WHERE follower_id=$1 AND following_id=$2",[me,followed]);
  assert.deepEqual(await ids(),new Set([own,reacted]));
  await db.query("DELETE FROM content_reactions WHERE content_id=$1 AND user_id=$2",[reacted,me]);
  assert.deepEqual(await ids(),new Set([own]));
  const ownComment=await comment(discussed,me);
  assert.ok((await ids()).has(discussed));
  await db.query("UPDATE comments SET status='deleted',body='',deleted_at=now() WHERE id=$1",[ownComment]);
  assert.ok(!(await ids()).has(discussed));
  await db.query("INSERT INTO user_follows(follower_id,following_id) VALUES($1,$2)",[me,followed]);
  await db.query('UPDATE "user" SET banned=true WHERE id=$1',[followed]);
  assert.deepEqual(await ids(),new Set([own]));
  await db.query("UPDATE contents SET status='archived' WHERE id=$1",[own]);
  assert.equal((await ids()).size,0);
  const expected=[];
  for(let i=0;i<26;i++)expected.push(await post(me));
  const first=await readSiteCircleFeed(me,null,false);
  assert.equal(first.length,21);
  const last=first[19];
  const next=await readSiteCircleFeed(me,{id:last.id,at:last.cursor_at},false);
  const all=[...first.slice(0,20),...next].map(r=>r.id);
  assert.deepEqual(all,expected.reverse());
  assert.equal(new Set(all).size,26);
  const session=async(user:string)=>{
   const token=randomBytes(32).toString("hex");
   await db.query('INSERT INTO "session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$1,$2,now()+interval \'1 hour\',now())',[token,user]);
   return new Headers({authorization:"Bearer "+token});
  };
  const ownHeaders=await session(me),otherHeaders=await session(stranger);
  const page=await getSiteCircleFeed(ownHeaders);
  assert.equal(page.items.length,20);assert.ok(page.next);
  assert.equal((await getSiteCircleFeed(ownHeaders,page.next)).items.length,6);
  await assert.rejects(()=>getSiteCircleFeed(otherHeaders,page.next!),e=>e instanceof ServiceError&&e.status===400);
  await assert.rejects(()=>getSiteCircleFeed(ownHeaders,"invalid"),e=>e instanceof ServiceError&&e.status===400);
  await assert.rejects(()=>getSiteCircleFeed(new Headers()),e=>e instanceof ServiceError&&e.status===401);
 }finally{
  await db.query("DELETE FROM contents WHERE category_id=$1",[category]);
  await db.query('DELETE FROM "user" WHERE id=ANY($1::text[])',[users]);
  await db.query("DELETE FROM content_categories WHERE id=$1",[category]);
 }
}
