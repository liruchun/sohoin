import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareVideo} from '../src/server/member-video';

test('video processing uses temporary files only',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'sohoin-video-test-'));
 try{
  const source=path.join(directory,'source.mp4');
  await promisify(execFile)(process.env.FFMPEG_PATH||'ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p',source],{timeout:30000,windowsHide:true});
  const prepared=await prepareVideo(await readFile(source),'video/mp4');
  assert.equal(prepared.hasAudio,false);
  assert.equal(prepared.width,320);assert.equal(prepared.height,180);
  assert.ok(prepared.durationMs>0&&prepared.durationMs<=1100);
  assert.equal(prepared.cover.data.toString('ascii',8,12),'WEBP');
  assert.ok(prepared.data.indexOf(Buffer.from('moov'))<prepared.data.indexOf(Buffer.from('mdat')));
  await t.test('converts incompatible MP4 video and audio to browser-compatible streams',async()=>{
   const incompatible=path.join(directory,'incompatible.mp4');
   await promisify(execFile)(process.env.FFMPEG_PATH||'ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=red:s=320x180:r=10','-f','lavfi','-i','sine=frequency=440','-t','1','-c:v','mpeg4','-c:a','libmp3lame',incompatible],{timeout:30000,windowsHide:true});
   const result=await prepareVideo(await readFile(incompatible),'video/mp4');
   const converted=path.join(directory,'converted.mp4');await writeFile(converted,result.data);
   const probe=await promisify(execFile)(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,pix_fmt','-of','json',converted],{timeout:30000,windowsHide:true});
   const streams=JSON.parse(probe.stdout).streams;
   assert.equal(streams.find((s:{codec_type:string})=>s.codec_type==='video').codec_name,'h264');
   assert.equal(streams.find((s:{codec_type:string})=>s.codec_type==='video').pix_fmt,'yuv420p');
   assert.equal(streams.find((s:{codec_type:string})=>s.codec_type==='audio').codec_name,'aac');
   assert.equal(result.hasAudio,true);
   assert.equal(result.width,320);assert.equal(result.height,180);
   assert.equal(result.cover.data.toString('ascii',8,12),'WEBP');
  });
  await t.test('rejects corrupt input and a mismatched container',async()=>{
   await assert.rejects(prepareVideo(Buffer.from('#EXTM3U\nhttp://127.0.0.1/private'),'video/mp4'),{code:'INVALID_VIDEO'});
   await assert.rejects(prepareVideo(await readFile(source),'video/webm'),{code:'INVALID_VIDEO'});
  });

 }finally{await rm(directory,{recursive:true,force:true});}
});
