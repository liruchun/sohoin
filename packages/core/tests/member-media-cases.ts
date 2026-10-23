import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import sharp from 'sharp';
import {randomBytes} from 'node:crypto';
import {insertMemberMedia} from '@sohoin/database';
import {createShortPublicId} from '../src/server/public-id';
import {listMedia,getAdminMediaResponse} from '../src/server/media';
import {getOwnMediaResponse} from '../src/server/video-http';
import {getPool,readMemberContacts,readMemberMediaFile,tombstoneMedia,MediaStoreError} from '@sohoin/database';
import {getMemberImage,getOwnMemberDetails,listOwnMedia,saveMemberDetails,uploadOwnMedia} from '../src/server/member-profiles';
import {ServiceError} from '../src/server/security';
import {loadMediaBytes} from '../src/server/media-storage';

export async function memberMediaCases(t:TestContext,userToken:string,adminToken:string,userId:string,adminId:string){
 await t.test('member uploads persist responsive files and deduplicate their variants',async()=>{
  const bytes=await sharp({create:{width:1600,height:800,channels:3,background:'#3581a9'}}).png().toBuffer();
  const upload=()=>uploadOwnMedia(new Request('http://127.0.0.1/api/v1/account/media',{method:'POST',headers:{authorization:'Bearer '+userToken,'content-type':'image/png','x-file-name':'responsive.png'},body:new Uint8Array(bytes)}));
  const first=await upload(),again=await upload();
  assert.equal(first.id,again.id);
  const asset=await readMemberMediaFile(userId,first.id);assert.ok(asset);
  const variants=(await getPool().query(`SELECT variant_key,width,height,storage_namespace,storage_key,byte_size FROM media_variants WHERE media_id=$1 AND status='ready' ORDER BY width`,[asset.id])).rows;
  assert.equal(variants.length,4);
  const responsive=variants.filter(v=>v.variant_key!=='thumbnail');
  assert.deepEqual(responsive.map(v=>[v.variant_key,v.width,v.height]),[['w480',480,240],['w960',960,480],['w1440',1440,720]]);
  for(const variant of responsive){
   const file=await loadMediaBytes(variant.storage_namespace,variant.storage_key,Number(variant.byte_size));
   const metadata=await sharp(file).metadata();
   assert.equal(metadata.format,'webp');assert.equal(metadata.width,variant.width);assert.equal(metadata.height,variant.height);
  }
 });
 await t.test('video libraries filter by type and owner and preserve media permissions',async()=>{
  const headers=new Headers({authorization:'Bearer '+userToken}),adminHeaders=new Headers({authorization:'Bearer '+adminToken});
  const publicId=createShortPublicId(),checksum=randomBytes(32).toString('hex'),key='2026/10/'+randomBytes(16).toString('hex');
  const video=await insertMemberMedia(userId,publicId,checksum,'images-v1','library-video.mp4',checksum,{key:key+'.mp4',mime:'video/mp4',size:20*1024*1024,width:320,height:180},{key:key+'-thumb.webp',mime:'image/webp',size:100,width:320,height:180},{kind:'video',durationMs:1234});
  assert.ok(!(await listOwnMedia(headers)).items.some(item=>item.id===publicId));
  const own=(await listOwnMedia(headers,undefined,'video')).items.find(item=>item.id===publicId);
  assert.equal(own?.durationMs,1234);
  assert.equal(own?.file.type,'video/mp4');
  assert.ok(!(await listOwnMedia(adminHeaders,undefined,'video')).items.some(item=>item.id===publicId));
  assert.ok((await listMedia(adminHeaders,{kind:'video'})).items.some(item=>item.id===video.id));
  assert.ok(!(await listMedia(adminHeaders,{kind:'image'})).items.some(item=>item.id===video.id));
  await assert.rejects(()=>listOwnMedia(headers,undefined,'invalid'),e=>e instanceof ServiceError&&e.status===400);
  await assert.rejects(()=>getOwnMediaResponse(new Request('http://localhost/api/v1/account/media/'+publicId,{headers:adminHeaders}),publicId),e=>e instanceof ServiceError&&e.status===404);
  await assert.rejects(()=>getAdminMediaResponse(new Request('http://localhost/api/v1/admin/media/'+video.id+'/file',{headers}),video.id),e=>e instanceof ServiceError&&e.status===403);
  const details=await getOwnMemberDetails(headers);
  await assert.rejects(()=>saveMemberDetails(headers,{version:details.version,name:details.name,bio:details.bio,region:details.region,visibility:details.visibility,avatarId:publicId,contacts:[]}),e=>e instanceof ServiceError&&e.status===404);
 });
 await t.test('member images persist, deduplicate and enforce mutual-contact privacy',async()=>{
  const headers=new Headers({authorization:'Bearer '+userToken}),other=new Headers({authorization:'Bearer '+adminToken});
  await getPool().query('DELETE FROM user_follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)',[userId,adminId]);
  const bytes=await sharp({create:{width:24,height:24,channels:3,background:'#41a377'}}).png().toBuffer();
  const upload=(token:string,mime='image/png')=>uploadOwnMedia(new Request('http://127.0.0.1/api/v1/account/media',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':mime,'x-file-name':'member.png'},body:new Uint8Array(bytes)}));
  await assert.rejects(()=>listOwnMedia(new Headers()),e=>e instanceof ServiceError&&e.status===401);
  const first=await upload(userToken),again=await upload(userToken);
  assert.equal(first.id,again.id);assert.match(first.id,/^(?=.*[a-z])[a-z0-9]{10}$/);
  assert.ok((await listOwnMedia(headers)).items.some(m=>m.id===first.id));
  const combined=(await listOwnMedia(headers,undefined,'all')).items;
  assert.ok(combined.some(item=>item.id===first.id));
  assert.ok(combined.some(item=>item.file.type==='video/mp4'));
  assert.ok((await listOwnMedia(headers,undefined,'image')).items.every(item=>item.file.type.startsWith('image/')));
  assert.ok((await listOwnMedia(headers,undefined,'video')).items.every(item=>item.file.type.startsWith('video/')));
  const foreign=await upload(adminToken);assert.notEqual(first.id,foreign.id);
  await assert.rejects(()=>upload(userToken,'image/jpeg'),e=>e instanceof ServiceError&&e.status===415);
  await assert.rejects(()=>getMemberImage(other,first.id,'own'),e=>e instanceof ServiceError&&e.status===404);
  await assert.rejects(()=>getMemberImage(new Headers(),first.id,'avatar'),e=>e instanceof ServiceError&&e.status===404);
  const details=await getOwnMemberDetails(headers);
  const input={version:details.version,name:'Member media test',bio:'Saved profile',region:'上海',visibility:'friends',avatarId:null,contacts:[{kind:'wechat',text:'',mediaId:first.id}]};
  await assert.rejects(()=>saveMemberDetails(headers,{...input,avatarId:foreign.id}),e=>e instanceof ServiceError&&e.status===404);
  await saveMemberDetails(headers,input);
  await assert.rejects(()=>saveMemberDetails(headers,input),e=>e instanceof ServiceError&&e.status===409);
  assert.equal((await getOwnMemberDetails(headers)).contacts[0].media?.id,first.id);
  assert.equal((await readMemberContacts(userId,null)).length,0);
  assert.ok((await getMemberImage(headers,first.id,'contact')).bytes.length);
  await assert.rejects(()=>getMemberImage(other,first.id,'contact'),e=>e instanceof ServiceError&&e.status===404);
  const db=getPool();
  await db.query('DELETE FROM user_follows WHERE (follower_id=$1 AND following_id=$2) OR (follower_id=$2 AND following_id=$1)',[userId,adminId]);
  await db.query('INSERT INTO user_follows(follower_id,following_id) VALUES($1,$2)',[userId,adminId]);
  assert.equal((await readMemberContacts(userId,adminId)).length,0);
  await db.query('INSERT INTO user_follows(follower_id,following_id) VALUES($2,$1)',[userId,adminId]);
  assert.equal((await readMemberContacts(userId,adminId)).length,1);
  assert.ok((await getMemberImage(other,first.id,'contact')).bytes.length);
  const asset=await readMemberMediaFile(userId,first.id);assert.ok(asset);
  await assert.rejects(()=>tombstoneMedia(adminId,asset.id,1),e=>e instanceof MediaStoreError&&e.code==='in_use');
  await db.query('DELETE FROM user_follows WHERE follower_id=$2 AND following_id=$1',[userId,adminId]);
  await assert.rejects(()=>getMemberImage(other,first.id,'contact'),e=>e instanceof ServiceError&&e.status===404);
  await saveMemberDetails(headers,{...input,version:details.version+1,visibility:'public'});
  assert.ok((await getMemberImage(new Headers(),first.id,'contact')).bytes.length);
  await saveMemberDetails(headers,{...input,version:details.version+2,visibility:'hidden'});
  await assert.rejects(()=>getMemberImage(new Headers(),first.id,'contact'),e=>e instanceof ServiceError&&e.status===404);
  assert.ok((await getMemberImage(headers,first.id,'contact')).bytes.length);
  // An avatar is public only while currently used; contact settings stay independent.
  await saveMemberDetails(headers,{...input,version:details.version+3,avatarId:first.id,contacts:[],visibility:'hidden'});
  assert.ok((await getMemberImage(new Headers(),first.id,'avatar',true)).bytes.length);
  await assert.rejects(()=>getMemberImage(other,first.id,'contact'),e=>e instanceof ServiceError&&e.status===404);
 });
}
