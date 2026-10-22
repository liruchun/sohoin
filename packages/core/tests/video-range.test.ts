import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {streamVideo} from '../src/server/video-http';
test('stored video byte ranges',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'sohoin-video-range-'));
 const previous=process.env.MEDIA_STORAGE_DIR;
 const prepared={data:Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz')};
 try{
  const key='2026/10/0123456789abcdef0123456789abcdef.mp4';
  const target=path.join(directory,'images-v1',key);
  await mkdir(path.dirname(target),{recursive:true});await writeFile(target,prepared.data);
  process.env.MEDIA_STORAGE_DIR=directory;
  const file={storage_namespace:'images-v1',storage_key:key,mime_type:'video/mp4',byte_size:String(prepared.data.length)};
  const request=(range?:string,method='GET')=>new Request('http://localhost/video',{method,headers:range?{Range:range}:{}});
  await t.test('supports bounded, suffix and HEAD ranges; rejects invalid ranges',async()=>{
   const response=await streamVideo(request('bytes=0-15'),file);
   assert.equal(response.status,206);assert.equal(response.headers.get('content-length'),'16');
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),prepared.data.subarray(0,16));
   const suffix=await streamVideo(request('bytes=-8'),file);
   assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),prepared.data.subarray(-8));
   const head=await streamVideo(request(undefined,'HEAD'),file);assert.equal(head.status,200);assert.equal(head.body,null);
   for(const range of ['bytes=9-1','bytes=-0','bytes=999999999-','bytes=0-1,4-5','bad'])assert.equal((await streamVideo(request(range),file)).status,416);
   const full=await streamVideo(request(),file);assert.equal(full.status,200);assert.deepEqual(Buffer.from(await full.arrayBuffer()),prepared.data);
  });
 }finally{if(previous===undefined)delete process.env.MEDIA_STORAGE_DIR;else process.env.MEDIA_STORAGE_DIR=previous;await rm(directory,{recursive:true,force:true});}
});
