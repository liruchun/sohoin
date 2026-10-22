import "server-only";
import {readSettingsAudit,readUserAudit,readAccountAudit,readContentAudit,readMediaAudit} from "@sohoin/database";
import type {MediaAuditPage} from "@sohoin/extension-api/media";
import {auditQuerySchema,type SettingsAuditPage,type UserAuditPage,type AccountAuditPage,type ContentAuditPage} from "@sohoin/extension-api/admin";
import {requireAdministrator,enforceLimit,ServiceError} from "./security";
async function parseQuery(headers:Headers,input:unknown){
 const actor=await requireAdministrator(headers);await enforceLimit("audit-read",actor.id,120,60);
 const parsed=auditQuerySchema.safeParse(input);
 if(!parsed.success)throw new ServiceError(400,"INVALID_CURSOR","分页参数无效，请返回最新记录");
 return parsed.data;
}
export async function listMediaAudit(headers:Headers,input:unknown):Promise<MediaAuditPage>{const query=await parseQuery(headers,input);const rows=await readMediaAudit(query.before);return {items:rows.slice(0,30).map(row=>({id:row.id,mediaId:row.media_id,label:row.label,action:row.action,createdAt:row.created_at.toISOString(),actorName:row.actor_name?.slice(0,100)??"已删除的账号",actorEmail:row.actor_email})),nextCursor:rows.length>30?rows[29].id:null};}
export async function listSettingsAudit(headers:Headers,input:unknown):Promise<SettingsAuditPage> {
 const query=await parseQuery(headers,input);
 const rows=await readSettingsAudit(query.before);const page=rows.slice(0,30);
 return {items:page.map(row=>({id:row.id,actorName:row.actor_name?.slice(0,100)??"已删除的账号",actorEmail:row.actor_email,createdAt:row.created_at.toISOString(),changedFields:row.changed_fields})),nextCursor:rows.length>30?page[page.length-1].id:null};
}
export async function listUserAudit(headers:Headers,input:unknown):Promise<UserAuditPage> {
 const query=await parseQuery(headers,input);const rows=await readUserAudit(query.before);const page=rows.slice(0,30);
 return {items:page.map(row=>({id:row.id,actorName:row.actor_name?.slice(0,100)??"已删除的账号",actorEmail:row.actor_email,targetId:row.target_id,targetName:row.target_name?.slice(0,100)??"已删除的账号",targetEmail:row.target_email,createdAt:row.created_at.toISOString(),changedFields:row.changed_fields})),nextCursor:rows.length>30?page[page.length-1].id:null};
}
export async function listAccountAudit(headers:Headers,input:unknown):Promise<AccountAuditPage> {
 const query=await parseQuery(headers,input);const rows=await readAccountAudit(query.before);const page=rows.slice(0,30);
 return {items:page.map(row=>({id:row.id,actorName:row.actor_name?.slice(0,100)??"已删除的账号",actorEmail:row.actor_email,createdAt:row.created_at.toISOString(),action:row.action,affectedSessions:row.affected_sessions})),nextCursor:rows.length>30?page[page.length-1].id:null};
}
export async function listContentAudit(headers:Headers,input:unknown):Promise<ContentAuditPage>{
 const query=await parseQuery(headers,input);const rows=await readContentAudit(query.before);const page=rows.slice(0,30);
 return {items:page.map(row=>({id:row.id,kind:row.kind,objectId:row.object_id,label:row.label,action:row.action,actorName:row.actor_name?.slice(0,100)??"已删除的账号",actorEmail:row.actor_email,createdAt:row.created_at.toISOString()})),nextCursor:rows.length>30?page[page.length-1].id:null};
}
