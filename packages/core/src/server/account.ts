import "server-only";
import {readOwnSessions,revokeOwnSessions} from "@sohoin/database";
import {sessionsQuerySchema,revokeSessionsSchema,changePasswordSchema,type SessionsPage} from "@sohoin/extension-api/account";
import {requireAuthenticatedUser,enforceLimit,ServiceError} from "./security";
import {getAuth} from "./auth";

export async function listAccountSessions(headers:Headers,input:unknown):Promise<SessionsPage> {
  const actor=await requireAuthenticatedUser(headers);await enforceLimit("account-read",actor.id,120,60);
  const parsed=sessionsQuerySchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,"INVALID_CURSOR","分页参数无效");
  const rows=await readOwnSessions(actor.id,parsed.data.before);const page=rows.slice(0,20);
  return {items:page.map(row=>({id:row.id,createdAt:row.createdAt.toISOString(),expiresAt:row.expiresAt.toISOString(),userAgent:row.userAgent?.slice(0,500).trim()||null,ipAddress:row.ipAddress?.slice(0,100).trim()||null,current:row.id===actor.sessionId})),nextCursor:rows.length>20?page[page.length-1].id:null};
}
export async function revokeAccountSessions(headers:Headers,input:unknown) {
  const actor=await requireAuthenticatedUser(headers);await enforceLimit("account-write",actor.id,30,60);
  const parsed=revokeSessionsSchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,"INVALID_SESSION","请选择要退出的登录");
  const value=parsed.data;
  if(value.scope==="session"&&value.id===actor.sessionId)throw new ServiceError(409,"CURRENT_SESSION","请使用退出登录按钮退出当前登录");
  const revoked=await revokeOwnSessions(actor.id,actor.sessionId,value.scope,value.scope==="session"?value.id:undefined);
  if(value.scope==="session"&&!revoked)throw new ServiceError(404,"SESSION_NOT_FOUND","该登录已失效或不存在");
  return {revoked};
}
export async function changeAccountPassword(headers:Headers,input:unknown):Promise<{reauthenticate:true}> {
  const actor=await requireAuthenticatedUser(headers);await enforceLimit("account-password",actor.id,5,900);
  const parsed=changePasswordSchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,"INVALID_PASSWORD_INPUT","新密码须为 12–128 个字符，且不能与旧密码相同");
  // The pinned auth library verifies the old password, hashes the new password and
  // atomically revokes existing sessions. Its replacement token is never exposed.
  const response=await getAuth().api.changePassword({headers,body:{...parsed.data,revokeOtherSessions:true},asResponse:true});
  if(!response.ok){
    if(response.status===401||response.status===403)throw new ServiceError(401,"REAUTHENTICATE","登录已过期，请重新登录后修改密码");
    if(response.status===400)throw new ServiceError(400,"PASSWORD_CHANGE_FAILED","旧密码不正确，或当前账号无法修改密码");
    throw new ServiceError(503,"PASSWORD_CHANGE_UNAVAILABLE","暂时无法修改密码，请稍后重试");
  }
  await revokeOwnSessions(actor.id,actor.sessionId,"password");
  return {reauthenticate:true};
}
