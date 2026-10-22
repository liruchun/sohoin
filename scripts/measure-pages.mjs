import vm from "node:vm";
import fs from 'node:fs';
import zlib from 'node:zlib';
process.loadEnvFile('apps/web/.env.local');
const base=process.env.MEASURE_BASE_URL??'http://127.0.0.1:3194';
const authOrigin=new URL(process.env.BETTER_AUTH_URL??base).origin;
const output=process.argv[2]??'.local/performance/admin-ui-after.json';
const login=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:authOrigin},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
if(!login.ok)throw new Error('Measurement login failed: '+login.status);
const cookies=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
try{
 const report={capturedAt:new Date().toISOString(),note:'Local production HTML and linked asset sizes; gzip estimates, not user-network or TTFB benchmarks.',routes:{}};
 const routes=['/','/?feed=latest','/admin/login','/admin','/admin/audit','/admin/audit?type=users','/admin/audit?type=account','/admin/account','/admin/users','/admin/content','/admin/content/new','/admin/taxonomies/categories','/admin/taxonomies/tags','/admin/audit?type=content','/?feed=articles'];
 routes.push('/admin/notifications', '/admin/media','/admin/audit?type=media','/admin/comments','/admin/audit?type=comments');
 for(const [api,prefix] of [['media','/admin/media/'],['content','/admin/content/'],['comments','/admin/comments/']]){const r=await fetch(base+'/api/v1/admin/'+api,{headers:{Cookie:cookies}});if(!r.ok)throw new Error('Measurement lookup failed: '+api);const page=await r.json();if(page.items[0])routes.push(prefix+page.items[0].id);}
 const usersResponse=await fetch(base+'/api/v1/admin/users',{headers:{Cookie:cookies}});
 if(!usersResponse.ok)throw new Error('User measurement lookup failed: '+usersResponse.status);
 const users=await usersResponse.json();
 if(users.items[0])routes.push('/admin/users/'+encodeURIComponent(users.items[0].id));
 for(const route of routes){
  const response=await fetch(base+route,{headers:{Cookie:cookies}});const html=await response.text();if(!response.ok)throw new Error(route+': '+response.status);
  const urls=[...new Set([...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map(match=>match[1]).filter(url=>url.includes('/_next/')))];
  const assets=await Promise.all(urls.map(async url=>{const response=await fetch(new URL(url.replaceAll('&amp;','&'),base));if(!response.ok)throw new Error('Missing asset: '+url);const buffer=Buffer.from(await response.arrayBuffer());return {url,bytes:buffer.length,gzipBytes:zlib.gzipSync(buffer).length};}));
  report.routes[route]={htmlBytes:Buffer.byteLength(html),htmlGzipBytes:zlib.gzipSync(html).length,js:assets.filter(asset=>/\.js(?:\?|$)/.test(asset.url)),css:assets.filter(asset=>/\.css(?:\?|$)/.test(asset.url))};
 }
 const manifestContext={};
 vm.runInNewContext(fs.readFileSync('apps/web/.next/server/app/(site)/page_client-reference-manifest.js','utf8'),manifestContext);
 const publicModules=Object.keys(manifestContext.__RSC_MANIFEST['/(site)/page'].clientModules);
 // Shared Radix primitives are valid public UI dependencies; admin modules are not.
 const backendModules=publicModules.filter(name=>/admin-ui|[\\/]app[\\/]admin[\\/]/.test(name));
 if(backendModules.length)throw new Error('Backend client boundary leaked into public route');
 report.publicClientIsolation={passed:true,backendModules};
 fs.mkdirSync('.local/performance',{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(report.routes).map(([route,data])=>[route,{htmlBytes:data.htmlBytes,jsRequests:data.js.length,jsBytes:data.js.reduce((sum,a)=>sum+a.bytes,0),jsGzipBytes:data.js.reduce((sum,a)=>sum+a.gzipBytes,0),cssRequests:data.css.length,cssBytes:data.css.reduce((sum,a)=>sum+a.bytes,0)}])),null,2));
}finally{await fetch(base+'/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json',Origin:authOrigin,Cookie:cookies},body:'{}'});}
