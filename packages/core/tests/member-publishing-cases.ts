import {commentAttachmentCases} from './comment-attachments-cases';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import type {TestContext} from 'node:test';
import {getPool,insertMemberMedia,readSitePresentation,readPublicMediaFile} from '@sohoin/database';
import {createShortPublicId} from '../src/server/public-id';
type Requester=(url:string,method?:string,body?:unknown,token?:string,origin?:string)=>Promise<Response>;

export async function memberPublishingCases(t:TestContext,request:Requester,userToken:string,otherToken:string,userId:string){
 await t.test('member publishing: auth, retries, visibility, ownership, revisions and reply notifications',async()=>{
  const pool=getPool(),slug='publishing-'+randomUUID().slice(0,8),created:string[]=[];
  const category=(await pool.query('INSERT INTO content_categories(name,slug) VALUES($1,$2) RETURNING id',['Publishing test',slug])).rows[0].id;
  const base='/api/v1/account/publications';
  const input={kind:'post',requestId:randomUUID(),body:'A member post\n<script>plain text</script>',category:slug,media:[]};
  try{
   assert.equal((await request('/api/v1/account/videos','POST',{})).status,401);
   assert.equal((await request('/api/v1/account/videos','POST',{},userToken,'https://attacker.example')).status,403);
   assert.equal((await request('/api/v1/account/videos','POST',{},userToken)).status,415);
   assert.equal((await request('/api/v1/account/link-preview','POST',{url:'https://example.com'})).status,401);
   assert.equal((await request('/api/v1/account/link-preview','POST',{url:'https://example.com'},userToken,'https://attacker.example')).status,403);
   assert.equal((await request('/api/v1/account/link-preview','POST',{url:'http://127.0.0.1'},userToken)).status,400);
   assert.equal((await request(base,'POST',input)).status,401);
   assert.equal((await request(base,'POST',input,userToken,'https://attacker.example')).status,403);
   assert.equal((await request(base,'POST',{...input,authorId:'other'},userToken)).status,400);
   assert.equal((await request(base,'POST',{...input,body:'x'.repeat(70000)},userToken)).status,413);
   const results=await Promise.all([request(base,'POST',input,userToken),request(base,'POST',input,userToken)]);
   assert.deepEqual(results.map(r=>r.status),[201,201]);
   const first=await results[0].json(),again=await results[1].json();assert.equal(first.publicId,again.publicId);assert.match(first.publicId,/^(?=.*[a-z])[a-z0-9]{10}$/);created.push(first.publicId);
   assert.equal((await request(base,'POST',{...input,body:'different'},userToken)).status,409);
   const endpoint=`${base}/post/${first.publicId}`;
   assert.equal((await (await request(endpoint,'GET',undefined,otherToken)).json()).publication,null);
   assert.equal((await request(endpoint,'PATCH',{version:0,value:null},otherToken)).status,404);
   assert.equal((await request(endpoint,'PATCH',{version:0,value:{body:'Updated',category:slug,media:[]}},userToken)).status,200);
   assert.equal((await request(endpoint,'PATCH',{version:0,value:null},userToken)).status,409);
   const post=(await pool.query('SELECT c.id,c.author_id,c.body FROM public_route_ids r JOIN contents c ON c.id=r.content_id WHERE r.short_id=$1',[first.publicId])).rows[0];assert.equal(post.author_id,userId);assert.equal(post.body,'Updated');
   // Missing or foreign media never becomes a public attachment.
   const foreign=(await pool.query("SELECT mm.public_id FROM member_media mm JOIN media_assets m ON m.id=mm.media_id WHERE mm.user_id<>$1 AND m.status='ready' LIMIT 1",[userId])).rows[0];
   assert.equal((await request(base,'POST',{...input,requestId:randomUUID(),media:[foreign?.public_id??'zzzzzzzzzz']},userToken)).status,400);
   const mixed:string[]=[];
   for(const kind of ['video','image','video','image'] as const){
    const token=createShortPublicId(),checksum=randomBytes(32).toString('hex'),key='2026/10/'+randomBytes(16).toString('hex');
    await insertMemberMedia(userId,token,checksum,'images-v1','mixed.'+(kind==='video'?'mp4':'webp'),checksum,{key:key+(kind==='video'?'.mp4':'.webp'),mime:kind==='video'?'video/mp4':'image/webp',size:100,width:320,height:180},{key:key+'-thumb.webp',mime:'image/webp',size:50,width:320,height:180},{kind,...(kind==='video'?{durationMs:1000}:{})});mixed.push(token);
   }
   const coverId=mixed.pop()!;
   const mixedEndpoint=endpoint;
   const link={url:'https://example.com/',title:'Example link',image:'',icon:'https://example.com/favicon.ico',coverMediaId:coverId,position:1};
   assert.equal((await request(mixedEndpoint,'PATCH',{version:1,value:{body:'Mixed media',category:slug,media:mixed,links:[link]}},userToken)).status,200);
   const readMixed=async()=>(await (await request(mixedEndpoint,'GET',undefined,userToken)).json()).publication.media as {id:string}[];
   assert.deepEqual((await readMixed()).map(item=>item.id),mixed);
   const own=(await (await request(mixedEndpoint,'GET',undefined,userToken)).json()).publication;
   assert.equal(own.links[0].title,link.title);assert.equal(own.links[0].coverMediaId,coverId);
   const presentation=(await readSitePresentation([String(post.id)]))[0];
   assert.deepEqual(presentation.media.map(item=>item.kind),['video','link','image','video']);
   const coverKey=presentation.media[1].image!.replace('/api/site-media/','').split('?')[0];
   assert.ok(await readPublicMediaFile(coverKey,false));
   const reversed=[...mixed].reverse();
   assert.equal((await request(mixedEndpoint,'PATCH',{version:2,value:{body:'Mixed media',category:slug,media:reversed,links:[{...link,position:3}]}},userToken)).status,200);
   assert.deepEqual((await readMixed()).map(item=>item.id),reversed);
   assert.equal((await request(base,'POST',{...input,requestId:randomUUID(),media:[mixed[0],mixed[0]]},userToken)).status,400);
   assert.equal((await request(base,'POST',{...input,requestId:randomUUID(),media:Array.from({length:10},()=>createShortPublicId())},userToken)).status,400);
   const replyInput={kind:'comment',requestId:randomUUID(),body:'Reply',target:{type:'post',publicId:first.publicId}};
   const replyResponse=await request(base,'POST',replyInput,otherToken);assert.equal(replyResponse.status,201);const reply=await replyResponse.json();
   const repeated=await request(base,'POST',replyInput,otherToken);assert.equal((await repeated.json()).publicId,reply.publicId);
   const notifications=await pool.query(`SELECT n.id FROM notifications n JOIN user_activities a ON a.id=n.activity_id JOIN public_comment_ids r ON r.comment_id=a.comment_id WHERE r.short_id=$1 AND n.recipient_id=$2 AND n.kind='reply'`,[reply.publicId,userId]);assert.equal(notifications.rowCount,1);
   const nested={kind:'comment',requestId:randomUUID(),body:'Nested',target:{type:'comment',publicId:reply.publicId}};
   assert.equal((await request(base,'POST',nested,userToken)).status,201);
   const otherResponse=await request(base,'POST',{...input,requestId:randomUUID(),body:'Other thread'},userToken);assert.equal(otherResponse.status,201);const other=await otherResponse.json();created.push(other.publicId);
   assert.equal((await request(base,'POST',{...nested,requestId:randomUUID(),target:{type:'post',publicId:other.publicId},replyTo:reply.publicId},userToken)).status,404);
   await pool.query("UPDATE comments SET thread_hidden=true WHERE id=(SELECT comment_id FROM public_comment_ids WHERE short_id=$1)",[reply.publicId]);
   assert.equal((await request(base,'POST',{...nested,requestId:randomUUID()},userToken)).status,404);
   assert.equal((await request(endpoint,'PATCH',{version:3,value:null},userToken)).status,200);
   assert.equal((await request(base,'POST',{...replyInput,requestId:randomUUID()},otherToken)).status,404);
   assert.equal((await request('/api/site/content/post/'+first.publicId)).status,404);
   assert.equal(await readPublicMediaFile(coverKey,false),undefined);
  }finally{
   await pool.query('DELETE FROM contents WHERE category_id=$1',[category]);
   await pool.query('DELETE FROM content_categories WHERE id=$1',[category]);
   await pool.query('DELETE FROM member_publications WHERE public_id=ANY($1::text[])',[created]);
  }
 });
 await commentAttachmentCases(t,request,userToken,otherToken,userId);
}
