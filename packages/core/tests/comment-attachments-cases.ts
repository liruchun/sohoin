import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import type {TestContext} from 'node:test';
import {getPool,createMemberPublication,insertMemberMedia,readPublicMediaFile,readMediaFile} from '@sohoin/database';
import {getSiteComment,getSiteDiscussion} from '../src/server/public-discussion';
import {createShortPublicId} from '../src/server/public-id';
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;

export async function commentAttachmentCases(t:TestContext,request:Requester,userToken:string,otherToken:string,userId:string){
 await t.test('comment attachments: mixed order, edit, ownership and visibility follow the discussion',async()=>{
  const pool=getPool(),slug='comment-media-'+randomUUID().slice(0,8),parentToken=createShortPublicId();
  const category=(await pool.query('INSERT INTO content_categories(name,slug) VALUES($1,$2) RETURNING id',['Comment media',slug])).rows[0].id;
  const base='/api/v1/account/publications',tokens:string[]=[],keys:string[]=[],ids:string[]=[];
  try{
   await createMemberPublication(userId,{kind:'post',body:'Attachment test',category:slug,media:[]},randomUUID(),randomBytes(32).toString('hex'),parentToken);
   for(const kind of ['image','video','image','image'] as const){
    const token=createShortPublicId(),checksum=randomBytes(32).toString('hex'),key='2026/10/'+randomBytes(16).toString('hex'),storage=key+(kind==='video'?'.mp4':'.webp');
    await insertMemberMedia(userId,token,checksum,'images-v1','comment.'+(kind==='video'?'mp4':'webp'),checksum,{key:storage,mime:kind==='video'?'video/mp4':'image/webp',size:100,width:320,height:180},{key:key+'-thumb.webp',mime:'image/webp',size:50,width:320,height:180},{kind,...(kind==='video'?{durationMs:1000}:{})});
    tokens.push(token);keys.push(storage);
   }
   const link={url:'https://example.com/comment',title:'Comment link',image:'',icon:'',position:1,coverMediaId:tokens[2]};
   const input={kind:'comment',requestId:randomUUID(),body:'Mixed comment',target:{type:'post',publicId:parentToken},media:tokens.slice(0,2),links:[link]};
   assert.equal((await request(base,'POST',input,undefined)).status,401);
   assert.equal((await request(base,'POST',input,userToken,'https://attacker.example')).status,403);
   assert.equal((await request(base,'POST',{...input,requestId:randomUUID()},otherToken)).status,400);
   const response=await request(base,'POST',input,userToken);assert.equal(response.status,201);
   const root=(await response.json()).publicId;ids.push(root);
   assert.equal((await (await request(base,'POST',input,userToken)).json()).publicId,root);
   const endpoint=`${base}/comment/${root}`;
   const own=(await (await request(endpoint,'GET',undefined,userToken)).json()).publication;
   assert.deepEqual(own.media.map((item:{id:string})=>item.id),tokens.slice(0,2));
   assert.equal(own.links[0].coverMediaId,tokens[2]);
   assert.deepEqual((await getSiteComment(root)).media.map(item=>item.kind),['image','link','video']);
   assert.equal((await getSiteDiscussion(parentToken,'post')).threads[0].comment.content.media.length,3);
   for(const key of keys.slice(0,3))assert.ok(await readPublicMediaFile(key,false));
   const mediaId=(await pool.query('SELECT media_id::text FROM member_media WHERE public_id=$1',[tokens[0]])).rows[0].media_id;
   assert.equal((await readMediaFile(mediaId))?.in_use,true);
   assert.equal((await request(endpoint,'PATCH',{version:0,value:{body:'Must roll back',media:[],links:[{...link,position:0,coverMediaId:'zzzzzzzzzz'}]}},userToken)).status,400);
   const unchanged=(await (await request(endpoint,'GET',undefined,userToken)).json()).publication;
   assert.equal(unchanged.body,'Mixed comment');assert.equal(unchanged.version,0);
   assert.deepEqual((await getSiteComment(root)).media.map(item=>item.kind),['image','link','video']);
   const value={body:'Edited mixed comment',media:[tokens[1],tokens[0]],links:[{...link,position:0}]};
   assert.equal((await request(endpoint,'PATCH',{version:0,value},otherToken)).status,404);
   assert.equal((await request(endpoint,'PATCH',{version:0,value},userToken)).status,200);
   assert.equal((await request(endpoint,'PATCH',{version:0,value},userToken)).status,409);
   assert.deepEqual((await getSiteComment(root)).media.map(item=>item.kind),['link','video','image']);
   const nestedResponse=await request(base,'POST',{kind:'comment',requestId:randomUUID(),body:'Reply with image',target:{type:'comment',publicId:root},media:[tokens[3]],links:[]},userToken);
   assert.equal(nestedResponse.status,201);const nested=(await nestedResponse.json()).publicId;ids.push(nested);
   assert.equal((await getSiteComment(nested)).media.length,1);
   await pool.query("UPDATE comments SET thread_hidden=true WHERE id=(SELECT comment_id FROM public_comment_ids WHERE short_id=$1)",[root]);
   for(const key of keys)assert.equal(await readPublicMediaFile(key,false),undefined);
   await assert.rejects(()=>getSiteComment(nested));
   await pool.query("UPDATE comments SET thread_hidden=false WHERE id=(SELECT comment_id FROM public_comment_ids WHERE short_id=$1)",[root]);
   assert.ok(await readPublicMediaFile(keys[3],false));
   await pool.query("UPDATE comments SET status='hidden' WHERE id=(SELECT comment_id FROM public_comment_ids WHERE short_id=$1)",[nested]);
   assert.equal(await readPublicMediaFile(keys[3],false),undefined);
   await pool.query("UPDATE comments SET status='visible' WHERE id=(SELECT comment_id FROM public_comment_ids WHERE short_id=$1)",[nested]);
   await pool.query('UPDATE "user" SET banned=true WHERE id=$1',[userId]);
   for(const key of keys)assert.equal(await readPublicMediaFile(key,false),undefined);
   await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[userId]);
   await pool.query("UPDATE contents SET status='archived' WHERE category_id=$1",[category]);
   for(const key of keys)assert.equal(await readPublicMediaFile(key,false),undefined);
   await pool.query("UPDATE contents SET status='published' WHERE category_id=$1",[category]);
   assert.equal((await request(endpoint,'PATCH',{version:1,value:{body:'No attachments',media:[],links:[]}},userToken)).status,200);
   for(const key of keys.slice(0,3))assert.equal(await readPublicMediaFile(key,false),undefined);
   assert.equal((await readMediaFile(mediaId))?.in_use,false);
   assert.equal((await request(`${base}/comment/${nested}`,'PATCH',{version:0,value:null},userToken)).status,200);
   assert.equal(await readPublicMediaFile(keys[3],false),undefined);
  }finally{
   await pool.query('UPDATE "user" SET banned=false WHERE id=$1',[userId]);
   await pool.query('DELETE FROM contents WHERE category_id=$1',[category]);
   await pool.query('DELETE FROM content_categories WHERE id=$1',[category]);
   await pool.query('DELETE FROM member_publications WHERE public_id=ANY($1::text[])',[[parentToken,...ids]]);
  }
 });
}
