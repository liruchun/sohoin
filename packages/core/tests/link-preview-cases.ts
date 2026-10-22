import test from 'node:test';
import assert from 'node:assert/strict';
import {publicLinkUrl,linkCardSchema} from '@sohoin/extension-api/link-preview';
import {memberPublicationChangeSchema,memberPublicationSchema} from '@sohoin/extension-api/content';
import {isPublicLinkAddress,parseLinkMetadata} from '../src/server/link-preview';

test('link previews reject private destinations and unsafe protocols',()=>{
 for(const url of ['http://127.1/','http://0x7f000001/','http://2130706433/','http://[::1]/','http://[::ffff:127.0.0.1]/','http://localhost/','http://host.local/','https://user:secret@example.com/','https://example.com:8080/','file:///etc/passwd','javascript:alert(1)'])assert.equal(publicLinkUrl(url),null,url);
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','0.0.0.0','224.0.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2002:7f00:1::','2001:db8::1'])assert.equal(isPublicLinkAddress(address),false,address);
 assert.equal(isPublicLinkAddress('8.8.8.8'),true);
 assert.equal(isPublicLinkAddress('2606:4700:4700::1111'),true);
 assert.equal(publicLinkUrl('https://example.com/a?x=1'),'https://example.com/a?x=1');
});
test('metadata uses relative assets, entity decoding and OG precedence without executing HTML',()=>{
 const metadata=parseLinkMetadata('<html><head><title>Fallback</title><meta property="og:title" content="A &amp; B"><meta property="og:image" content="/cover.jpg"><link rel="shortcut icon" href="icon.png"></head><body><script>throw new Error("must not execute")</script></body></html>',new URL('https://example.com/posts/1'));
 assert.deepEqual(metadata,{title:'A & B',image:'https://example.com/cover.jpg',icon:'https://example.com/posts/icon.png'});
 assert.equal(linkCardSchema.safeParse({url:'https://example.com',title:'Title',image:'javascript:alert(1)',position:0}).success,false);
});
test('mixed attachment contracts reject collisions, out-of-range positions and totals above nine',()=>{
 const link={url:'https://example.com/',title:'Example',position:0};
 const value={body:'Post',category:'general',media:['abcdefghij'],links:[link]};
 const valid=(input:unknown)=>memberPublicationChangeSchema.safeParse({version:0,value:input}).success;
 assert.equal(valid(value),true);
 assert.equal(valid({...value,links:[{...link,position:2}]}),false);
 assert.equal(valid({...value,links:[link,{...link,url:'https://example.org/'}]}),false);
 assert.equal(valid({...value,links:[link,{...link,position:1}]}),false);
 assert.equal(valid({...value,links:Array.from({length:9},(_,position)=>({...link,url:`https://example.com/${position}`,position}))}),false);
});


test('comment creation accepts mixed attachments and preserves text-only clients',()=>{
 const input={kind:'comment',requestId:'b8c1ff33-213a-4a98-97c1-1a145c76f904',body:'Reply',target:{type:'post',publicId:'abcdefghij'}};
 const parsed=memberPublicationSchema.parse(input);
 assert.deepEqual(parsed.media,[]);assert.deepEqual(parsed.links,[]);
 const link={url:'https://example.com/',title:'Example',position:1};
 const valid=(value:unknown)=>memberPublicationSchema.safeParse(value).success;
 assert.equal(valid({...input,media:['abcdefghij'],links:[link]}),true);
 assert.equal(valid({...input,media:['abcdefghij','abcdefghij']}),false);
 assert.equal(valid({...input,links:[link]}),false);
 assert.equal(valid({...input,media:['abcdefghij'],links:Array.from({length:9},(_,position)=>({...link,url:`https://example.com/${position}`,position}))}),false);
});
