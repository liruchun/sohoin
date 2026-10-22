import {z} from "zod";
import {profileSchema,publicProfileSchema,profileUpdateSchema} from "./profiles";
import {notificationSchema,notificationPageSchema,notificationReadSchema,systemNotificationSchema} from "./notifications";
const security=[{bearerSession:[]},{sessionCookie:[]}];
const json=(schema:z.ZodType)=>({"application/json":{schema:z.toJSONSchema(schema,{target:"openapi-3.0",unrepresentable:"any"})}});
const result=(schema:z.ZodType)=>({200:{description:"成功",content:json(schema)},...Object.fromEntries([400,401,403,404,409,413,415,429,503].map(status=>[status,{description:"失败，返回 {error:{code,message}}"}]))});
const body=(schema:z.ZodType)=>({required:true,content:json(schema)}),id={name:"id",in:"path",required:true,schema:{type:"string"}};
export function communityAdminOpenApiPaths(){return {
 "/api/v1/account/profile":{get:{operationId:"getOwnProfile",security,responses:result(profileSchema)},patch:{operationId:"updateOwnProfile",summary:"当前用户修改个人介绍/HTTPS主页；版本校验；data省略保留，非空须符合注册Schema",security,requestBody:body(profileUpdateSchema),responses:result(profileSchema)}},
 "/api/v1/admin/users/{id}/profile":{parameters:[id],get:{operationId:"getAdminProfile",security,responses:result(profileSchema)},patch:{operationId:"updateAdminProfile",summary:"管理员编辑资料；不调整账号权限；记录字段名审计，不保存私密资料快照",security,requestBody:body(profileUpdateSchema),responses:result(profileSchema)}},
 "/api/v1/users/{id}/profile":{parameters:[id],get:{operationId:"getPublicProfile",summary:"公开资料与明确公开的扩展字段；禁用账号404；不返回邮箱、权限和私密扩展",responses:result(publicProfileSchema)}},
 "/api/v1/account/notifications":{get:{operationId:"listNotifications",security,summary:"当前账号可见通知，过滤后游标分页30条；无私信",parameters:[{name:"before",in:"query",schema:{type:"string"}},{name:"status",in:"query",schema:{type:"string",enum:["all","unread"]}}],responses:result(notificationPageSchema)}},
 "/api/v1/account/notifications/{id}":{parameters:[id],get:{operationId:"getNotification",security,summary:"点击时重新检查归属和目标可见性，不隐式标记已读",responses:result(notificationSchema)}},
 "/api/v1/account/notifications/unread-count":{get:{operationId:"getUnreadNotificationCount",security,responses:result(z.strictObject({count:z.number().int().nonnegative()}))}},
 "/api/v1/account/notifications/read":{patch:{operationId:"markNotificationsRead",security,summary:"标记自己的可见通知已读；ids最多100条，或through限定本次已查看的最新编号，避免吞掉新消息",requestBody:body(notificationReadSchema),responses:result(z.strictObject({updated:z.number().int().nonnegative()}))}},
 "/api/v1/admin/notifications":{post:{operationId:"sendSystemNotification",security,summary:"管理员向指定有效用户发送纯文本系统通知；key幂等，同key不同正文409；不支持私信或任意跳转地址",requestBody:body(systemNotificationSchema),responses:result(z.strictObject({id:z.string()}))}}
};}
