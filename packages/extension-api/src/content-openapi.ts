import {z} from "zod";
import {termSchema,termInputSchema,updateTermSchema,termsPageSchema,contentValueSchema,updateContentSchema,adminContentSchema,publicContentSchema,adminContentPageSchema,publicContentPageSchema,deleteContentSchema} from "./content";
import {contentAuditPageSchema} from "./admin";
const security=[{bearerSession:[]},{sessionCookie:[]}];
const json=(value:z.ZodType)=>({"application/json":{schema:z.toJSONSchema(value,{target:"openapi-3.0",unrepresentable:"any"})}});
const result=(value:z.ZodType,status=200)=>({[status]:{description:"成功",content:json(value)},...Object.fromEntries([400,401,403,404,409,413,415,429,503].map(status=>[status,{description:"请求失败；错误体为 {error:{code,message}}"}]))});
const body=(value:z.ZodType)=>({required:true,content:json(value)});
const id={name:"id",in:"path",required:true,schema:{type:"string",pattern:"^[1-9][0-9]{0,18}$"}};
const before={name:"before",in:"query",description:"上一页的 nextCursor，空值须省略",schema:{type:"string"}};
const filters=[before,{name:"sort",in:"query",schema:{type:"string",enum:["latest","published","updated","priority"]}},{name:"featured",in:"query",schema:{type:"string",enum:["all","yes","no"]}},{name:"pinned",in:"query",schema:{type:"string",enum:["all","yes","no"]}},{name:"q",in:"query",description:"标题前缀",schema:{type:"string",maxLength:100}},{name:"type",in:"query",schema:{type:"string"}},{name:"categoryId",in:"query",schema:{type:"string"}},{name:"tagId",in:"query",schema:{type:"string"}}];
const deleted=z.strictObject({deleted:z.literal(true)});
export function contentOpenApiPaths(){return {
 "/api/v1/content-types":{get:{operationId:"listContentTypes",summary:"已注册内容类型（只返回 id 和 label）",responses:result(z.array(z.strictObject({id:z.string(),label:z.string()}))) }},
 "/api/v1/content":{get:{operationId:"listPublishedContent",summary:"只列已发布内容，最多30条，不含正文",parameters:filters,responses:result(publicContentPageSchema)}},
 "/api/v1/content/{id}":{parameters:[id],get:{operationId:"getPublishedContent",summary:"公开内容详情；草稿和下架均返回404，正文为纯文本",responses:result(publicContentSchema)}},
 "/api/v1/admin/content":{get:{operationId:"listAdminContent",security,parameters:[...filters,{name:"status",in:"query",schema:{type:"string",enum:["all","draft","published","archived"]}}],responses:result(adminContentPageSchema)},post:{operationId:"createContent",summary:"创建文章或帖子；可关联1张封面、10张图库图片、10个图片附件。媒体说明和顺序与正文同事务保存",security,requestBody:body(contentValueSchema),responses:result(adminContentSchema,201)}},
 "/api/v1/admin/content/{id}":{parameters:[id],get:{operationId:"getAdminContent",security,responses:result(adminContentSchema)},patch:{operationId:"updateContent",summary:"按version更新内容；media省略保留原关联，空数组清空，非空数组完整替换并按各用途的数组顺序排序；featured/pinLevel省略保留原值；精选和置顶独立；扩展类型须显式提交完整data",security,requestBody:body(updateContentSchema),responses:result(adminContentSchema)},delete:{operationId:"deleteContent",summary:"按version删除草稿或已下架内容；已发布内容须先下架",security,requestBody:body(deleteContentSchema),responses:result(deleted)}},
 "/api/v1/admin/taxonomies/{kind}":{parameters:[{name:"kind",in:"path",required:true,schema:{type:"string",enum:["categories","tags"]}}],get:{operationId:"listTerms",security,parameters:[before,{name:"q",in:"query",description:"名称前缀",schema:{type:"string",maxLength:100}}],responses:result(termsPageSchema)},post:{operationId:"createTerm",security,requestBody:body(termInputSchema),responses:result(termSchema,201)}},
 "/api/v1/admin/taxonomies/{kind}/{id}":{parameters:[id,{name:"kind",in:"path",required:true,schema:{type:"string",enum:["categories","tags"]}}],get:{operationId:"getTerm",security,responses:result(termSchema)},patch:{operationId:"updateTerm",security,requestBody:body(updateTermSchema),responses:result(termSchema)},delete:{operationId:"deleteTerm",summary:"仅删除未被引用的分类或标签",security,requestBody:body(deleteContentSchema),responses:result(deleted)}},
 "/api/v1/admin/audit/content":{get:{operationId:"listContentAudit",security,parameters:[before],responses:result(contentAuditPageSchema)}}
};}
