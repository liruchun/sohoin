import {getAuth,checkWriteOrigin,readJson,enforceLimit,errorResponse,ServiceError} from "@sohoin/core/server";
export const dynamic="force-dynamic";
async function handler(request:Request){try{
 const endpoint=new URL(request.url).pathname.replace(/^\/api\/auth\//,"");
 if(!((request.method==="GET"&&endpoint==="get-session")||(request.method==="POST"&&["sign-in/email","sign-out"].includes(endpoint))))throw new ServiceError(404,"NOT_FOUND","接口不存在");
 if(request.method==="POST"){
  if(endpoint!=="sign-in/email"||request.headers.get("origin")||request.headers.get("cookie"))checkWriteOrigin(request);
  const input=await readJson(request,4096);
  if(endpoint==="sign-in/email"){
   await enforceLimit("login-global","all",120,60);
   const email=typeof input==="object"&&input!==null&&"email" in input&&typeof input.email==="string"?input.email.slice(0,254).trim().toLowerCase():"invalid";
   await enforceLimit("login-account",email,10,60);
  }
  request=new Request(request.url,{method:request.method,headers:request.headers,body:JSON.stringify(input)});
 }
 const response=await getAuth().handler(request);
 response.headers.set("Cache-Control","no-store");return response;
}catch(error){return errorResponse(error);}}
export {handler as GET,handler as POST};
