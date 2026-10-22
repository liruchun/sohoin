import {z} from "zod";
import {setFollowSchema,followBatchSchema,followBatchResultSchema,followPageSchema} from "./follows";
const json=(schema:z.ZodType)=>({"application/json":{schema:z.toJSONSchema(schema,{target:"openapi-3.0"})}});
const security=[{bearerSession:[]},{sessionCookie:[]}];
const response=(schema:z.ZodType)=>({200:{description:"成功",content:json(schema)},...Object.fromEntries([400,401,403,404,413,415,429,503].map(status=>[status,{description:"失败，返回 {error:{code,message}}"}]))});
const body=(schema:z.ZodType)=>({required:true,content:json(schema)});
export function followsOpenApiPaths(){return {
 "/api/v1/users/{id}/follow":{parameters:[{name:"id",in:"path",required:true,schema:{type:"string",maxLength:128}}],put:{operationId:"setFollow",security,summary:"设置当前用户是否关注目标，active=false 取消；幂等，禁止关注自己及新增关注禁用用户",requestBody:body(setFollowSchema),responses:response(setFollowSchema)}},
 "/api/v1/follows/summary":{post:{operationId:"getFollowStates",security,summary:"最多30个用户的当前登录用户关注/被关注/互关状态；无效或禁用用户省略，不含邮箱与角色",requestBody:body(followBatchSchema),responses:response(followBatchResultSchema)}},
 "/api/v1/account/follows/{direction}":{parameters:[{name:"direction",in:"path",required:true,schema:{type:"string",enum:["following","followers"]}}],get:{operationId:"getOwnFollows",security,summary:"当前用户自己的关注/粉丝列表，隐藏禁用账号；编号倒序游标分页30条，附互关状态，不含邮箱与权限",parameters:[{name:"before",in:"query",schema:{type:"string"}}],responses:response(followPageSchema)}}
};}
