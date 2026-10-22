import "server-only";
import {cache} from "react";
import { createHash } from "node:crypto";
import { consumeLimit } from "@sohoin/database";
import { getAuth } from "./auth";
export class ServiceError extends Error {
  constructor(public status:number, public code:string, message:string,public retryAfter?:number) {super(message);}
}
const requireSession = cache(async (headers:Headers) => {
  const session = await getAuth().api.getSession({headers});
  if (!session) throw new ServiceError(401,"UNAUTHENTICATED","请先登录");
  if(session.user.banned)throw new ServiceError(403,"FORBIDDEN","当前账号已被禁用");
  return session;
});
export const requireAuthenticatedUser = cache(async (headers:Headers)=>{
  const session=await requireSession(headers);
  return {id:session.user.id,email:session.user.email,name:session.user.name,sessionId:session.session.id};
});
export const requireAdministrator = cache(async (headers:Headers) => {
  const session=await requireSession(headers);
  if (!session.user.role?.split(",").includes("admin")) throw new ServiceError(403,"FORBIDDEN","当前账号没有管理权限");
  return {id:session.user.id,email:session.user.email,name:session.user.name};
});
export async function enforceLimit(scope:string,identity:string,max:number,seconds:number) {
  const key=createHash("sha256").update(scope+":"+identity).digest("hex");
  const result=await consumeLimit(key,seconds,max);
  if (!result.allowed) throw new ServiceError(429,"RATE_LIMITED","操作过于频繁，请稍后重试",result.retryAfter);
}
export function checkWriteOrigin(request:Request) {
  const expected = new URL(process.env.BETTER_AUTH_URL!).origin;
  const origin = request.headers.get("origin");
  if (origin) { if (origin !== expected) throw new ServiceError(403,"INVALID_ORIGIN","请求来源不被允许"); return; }
  // Native clients may omit Origin only when authenticating without browser cookies.
  if (!request.headers.get("cookie") && /^Bearer \S+$/.test(request.headers.get("authorization")??"")) return;
  throw new ServiceError(403,"INVALID_ORIGIN","缺少有效请求来源");
}
export async function readJson(request:Request,maxBytes=16384):Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ServiceError(415,"UNSUPPORTED_MEDIA_TYPE","请使用 JSON 请求");
  if (Number(request.headers.get("content-length"))>maxBytes) throw new ServiceError(413,"BODY_TOO_LARGE","请求内容过大");
  const reader=request.body?.getReader(); if(!reader) throw new ServiceError(400,"INVALID_JSON","请求不能为空");
  const parts:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ServiceError(413,"BODY_TOO_LARGE","请求内容过大");}parts.push(value);}
  try{return JSON.parse(Buffer.concat(parts).toString("utf8"));}catch{throw new ServiceError(400,"INVALID_JSON","JSON 格式不正确");}
}
export function errorResponse(error:unknown) {
  if(error instanceof ServiceError) return Response.json({error:{code:error.code,message:error.message}},{status:error.status,headers:{"Cache-Control":"no-store",...(error.retryAfter?{"Retry-After":String(error.retryAfter)}:{})}});
  console.error("Request failed:",error instanceof Error ? error.name : "unknown");
  return Response.json({error:{code:"SERVICE_UNAVAILABLE",message:"服务暂时不可用，请稍后重试"}},{status:503,headers:{"Cache-Control":"no-store"}});
}
