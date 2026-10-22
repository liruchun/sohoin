import 'server-only';
import {lookup} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {DOMParser} from '@xmldom/xmldom';
import {linkPreviewRequestSchema,publicLinkUrl,type LinkPreview} from '@sohoin/extension-api/link-preview';
import {requireAuthenticatedUser,enforceLimit,ServiceError} from './security';

const blocked=new BlockList();
for(const [network,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]] as const)blocked.addSubnet(network,bits,'ipv4');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
for(const [network,bits] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]] as const)blocked.addSubnet(network,bits,'ipv6');
const unsafe=()=>new ServiceError(400,'UNSAFE_LINK','请填写可公开访问的 HTTP 或 HTTPS 网址');
export function isPublicLinkAddress(address:string){const version=isIP(address);return version===4?!blocked.check(address,'ipv4'):version===6&&globalV6.check(address,'ipv6')&&!blocked.check(address,'ipv6');}
async function resolve(url:URL,signal:AbortSignal){
 if(!publicLinkUrl(url.href))throw unsafe();
 let stop:()=>void=()=>{};
 const deadline=new Promise<never>((_,reject)=>{stop=()=>reject(new Error('Timed out'));signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();});
 try{
  const addresses=await Promise.race([lookup(url.hostname,{all:true,verbatim:true}),deadline]);
  if(!addresses.length||addresses.some(item=>!isPublicLinkAddress(item.address)))throw unsafe();
  return addresses[0];
 }finally{signal.removeEventListener('abort',stop);}
}

/** DNS is checked and pinned for each hop; no cookies, proxy env, or automatic redirects. */
async function download(start:URL,signal:AbortSignal,json=false){
 let url=start;
 for(let hop=0;hop<4;hop++){
  const address=await resolve(url,signal);
  const result=await new Promise<{location?:string;body?:Buffer;type:string}>((accept,reject)=>{
   const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{
    agent:false,signal,maxHeaderSize:16384,
    lookup:(_hostname,options,callback)=>{if(options.all)callback(null,[address]);else callback(null,address.address,address.family);},
    headers:{Accept:json?'application/json':'text/html,application/xhtml+xml','Accept-Encoding':'identity','User-Agent':'sohoin-LinkPreview/1.0'},
   },response=>{
    const status=response.statusCode??0,type=response.headers['content-type']??'';
    if([301,302,303,307,308].includes(status)&&response.headers.location){accept({location:response.headers.location,type});response.destroy();return;}
    if(status!==200||!new RegExp(json?'^application/json':'^(text/html|application/xhtml\\+xml)','i').test(type)||(response.headers['content-encoding']&&response.headers['content-encoding']!=='identity')){response.destroy();reject(new Error('Unsupported response'));return;}
    const max=json?65536:524288;
    if(Number(response.headers['content-length'])>max){response.destroy();reject(new Error('Response too large'));return;}
    const chunks:Buffer[]=[];let size=0;
    response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>max){response.destroy(new Error('Response too large'));return;}chunks.push(chunk);});
    response.on('error',reject);response.on('aborted',()=>reject(new Error('Response aborted')));
    response.on('end',()=>accept({body:Buffer.concat(chunks),type}));
   });
   request.on('error',reject);request.end();
  });
  if(result.location){if(json)throw new Error('Unexpected API redirect');url=new URL(result.location,url);continue;}
  return {body:result.body!,type:result.type,url};
 }
 throw new Error('Too many redirects');
}
const clean=(value:unknown,max=300)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const asset=(value:unknown,base:URL)=>{try{return typeof value==='string'&&value?publicLinkUrl(new URL(value,base).href)??'':'';}catch{return '';}};
export function parseLinkMetadata(html:string,base:URL){
 // Only the bounded head is needed. xmldom does not run scripts or load external resources.
 const head=html.split(/<\/head\s*>/i,1)[0];
 const doc=new DOMParser({onError:()=>{}}).parseFromString(head,'text/html');
 const meta=new Map<string,string>();
 for(const node of Array.from(doc.getElementsByTagName('meta'))){const key=(node.getAttribute('property')||node.getAttribute('name')||'').toLowerCase();if(!meta.has(key))meta.set(key,node.getAttribute('content')??'');}
 const baseHref=doc.getElementsByTagName('base')[0]?.getAttribute('href');
 const resolved=baseHref?asset(baseHref,base):'';const origin=resolved?new URL(resolved):base;
 const icons=Array.from(doc.getElementsByTagName('link'));
 const icon=icons.find(node=>(node.getAttribute('rel')??'').toLowerCase().split(/\s+/).includes('icon'))??icons.find(node=>(node.getAttribute('rel')??'').toLowerCase()==='apple-touch-icon');
 return {title:clean(meta.get('og:title')||meta.get('twitter:title')||doc.getElementsByTagName('title')[0]?.textContent),image:asset(meta.get('og:image')||meta.get('twitter:image'),origin),icon:asset(icon?.getAttribute('href'),origin)};
}
const cache=new Map<string,{until:number;value:LinkPreview}>();
const pending=new Map<string,Promise<LinkPreview>>();
async function retrieve(url:URL):Promise<LinkPreview>{
 let values={title:'',image:'',icon:''},source:LinkPreview['source']='manual';
 try{
  const page=await download(url,AbortSignal.timeout(6000));
  const charset=page.type.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1]??page.body.subarray(0,4096).toString('ascii').match(/charset\s*=\s*["']?([^\s;"'/>]+)/i)?.[1]??'utf-8';
  values=parseLinkMetadata(new TextDecoder(charset).decode(page.body),page.url);
  if(values.title||values.image)source='page';
 }catch(error){if(error instanceof ServiceError)throw error;}
 if(!values.title||!values.image){
  try{
   // Shared database limiter caps the free fallback across workers and users.
   await enforceLimit('link-preview-microlink','site',25,86400);
   const endpoint=new URL('https://api.microlink.io/');endpoint.searchParams.set('url',url.href);
   const result=await download(endpoint,AbortSignal.timeout(10000),true);
   const data=JSON.parse(result.body.toString('utf8'));
   if(data.status==='success'&&data.data){
    const extra={title:clean(data.data.title),image:asset(data.data.image?.url,url),icon:asset(data.data.logo?.url,url)};
    if((!values.title&&extra.title)||(!values.image&&extra.image)||(!values.icon&&extra.icon))source='microlink';
    values={title:values.title||extra.title,image:values.image||extra.image,icon:values.icon||extra.icon};
   }
  }catch{/* Keep useful fields and allow manual completion, including quota exhaustion. */}
 }
 return {url:url.href,...values,title:values.title||url.hostname,icon:values.icon||new URL('/favicon.ico',url).href,source};
}
export async function getLinkPreview(headers:Headers,input:unknown){
 const actor=await requireAuthenticatedUser(headers);
 await enforceLimit('link-preview-user',actor.id,12,60);
 const parsed=linkPreviewRequestSchema.safeParse(input);if(!parsed.success)throw unsafe();
 const url=new URL(parsed.data.url);url.hash='';
 await resolve(url,AbortSignal.timeout(3000));
 const cached=cache.get(url.href);if(cached&&cached.until>Date.now())return cached.value;
 const existing=pending.get(url.href);if(existing)return existing;
 await enforceLimit('link-preview-site','site',60,60);
 const task=retrieve(url).then(value=>{
  if(cache.size>=500)cache.delete(cache.keys().next().value!);
  cache.set(url.href,{value,until:Date.now()+(value.source==='manual'?300000:86400000)});return value;
 }).finally(()=>pending.delete(url.href));
 pending.set(url.href,task);return task;
}
