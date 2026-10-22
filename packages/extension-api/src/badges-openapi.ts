import {z} from "zod";
import {createManagedBadgeSchema,updateBadgeSchema,manualBadgeSchema,manualRevokeBadgeSchema,wearBadgeSchema} from "./badges";
const security=[{bearerSession:[]},{sessionCookie:[]}];
const json=(schema:z.ZodType)=>({"application/json":{schema:z.toJSONSchema(schema,{target:"openapi-3.0",unrepresentable:"any"})}});
const errors=Object.fromEntries([400,401,403,404,409,413,415,429,503].map(status=>[status,{description:"失败，返回 {error:{code,message}}"}]));
const body=(schema:z.ZodType)=>({required:true,content:json(schema)});
const definition=z.object({key:z.string(),name:z.string(),description:z.string(),enabled:z.boolean(),revision:z.number().int(),iconMediaId:z.string().nullable(),createdAt:z.string(),updatedAt:z.string()});
const state=z.object({userId:z.string(),badgeKey:z.string(),active:z.boolean(),revision:z.number().int(),awardedAt:z.string(),revokedAt:z.string().nullable()});
const mutation=z.object({state,auditId:z.string(),changed:z.boolean(),replayed:z.boolean()});
const result=(schema:z.ZodType,status=200)=>({[status]:{description:"成功；private no-store",content:json(schema)},...errors});
const before={name:"before",in:"query",schema:{type:"string",maxLength:64}};
const worn=z.object({key:z.string(),name:z.string(),iconUrl:z.string().nullable()});
const collection=z.object({user:z.object({publicId:z.string(),name:z.string(),avatar:z.string().nullable()}),items:z.array(worn.extend({description:z.string(),awardedAt:z.string().nullable()})),nextCursor:z.string().nullable(),total:z.number().int(),earned:z.number().int(),worn:worn.nullable(),revision:z.number().int()});
export function badgeOpenApiPaths(){return {
 "/api/v1/account/medals/check":{post:{operationId:"checkOwnAchievements",summary:"核对当前账户的真实成就并一次性授予；不恢复手动撤销；Origin及128字节上限检查",security,requestBody:body(z.object({}).strict()),responses:result(z.object({awarded:z.array(z.string()),collection}))}},
 "/api/v1/account/medals":{
  get:{operationId:"getOwnMedals",summary:"当前账户勋章，每页30枚；仅含启用定义，返回真实获得记录和佩戴状态",security,parameters:[before],responses:result(z.object({
   user:z.object({publicId:z.string(),name:z.string(),avatar:z.string().nullable()}),
   items:z.array(worn.extend({description:z.string(),awardedAt:z.string().nullable()})),nextCursor:z.string().nullable(),
   total:z.number().int(),earned:z.number().int(),worn:worn.nullable(),revision:z.number().int(),
  }))},
  patch:{operationId:"wearOwnBadge",summary:"佩戴或取消当前账户勋章；每次一枚，null取消；revision冲突409；Origin及1024字节上限检查",security,requestBody:body(wearBadgeSchema),responses:result(z.object({badgeKey:z.string().nullable(),revision:z.number().int()}))},
 },
 "/api/v1/admin/badges":{
  get:{operationId:"listAdminBadges",summary:"管理员分页读取勋章定义，每页30条",security,parameters:[before],responses:result(z.object({items:z.array(definition),nextCursor:z.string().nullable()}))},
  post:{operationId:"createAdminBadge",summary:"创建勋章；requestId生成稳定标识，重复创建409；8192字节上限",security,requestBody:body(createManagedBadgeSchema),responses:result(definition,201)},
 },
 "/api/v1/admin/badges/{key}":{
  parameters:[{name:"key",in:"path",required:true,schema:{type:"string",pattern:"^[a-z][a-z0-9_-]*$",maxLength:64}}],
  get:{operationId:"getAdminBadge",security,responses:result(definition)},
  patch:{operationId:"updateAdminBadge",summary:"版本校验；iconMediaId省略保留，null移除；启停不撤销已授予勋章",security,requestBody:body(updateBadgeSchema.omit({key:true})),responses:result(definition)},
 },
 "/api/v1/admin/badges/options":{
  get:{operationId:"listAdminBadgeOptions",summary:"管理员选章列表，标记用户已拥有及停用状态",security,parameters:[{name:"userId",in:"query",required:true,schema:{type:"string",maxLength:128}},{name:"key",in:"query",schema:{type:"string",maxLength:64}},before],
   responses:result(z.object({items:z.array(z.object({key:z.string(),name:z.string(),enabled:z.boolean(),owned:z.boolean(),iconMediaId:z.string().nullable()})),nextCursor:z.string().nullable()}))},
 },
 "/api/v1/admin/badges/grants":{
  post:{operationId:"grantAdminBadge",summary:"管理员手动授予；身份与来源由服务端固定；requestId防重；重放返回历史结果",security,requestBody:body(manualBadgeSchema),responses:result(mutation)},
  patch:{operationId:"revokeAdminBadge",summary:"管理员撤销观察到的授予版本；旧版本409；requestId防重",security,requestBody:body(manualRevokeBadgeSchema),responses:result(mutation)},
 },
};}
