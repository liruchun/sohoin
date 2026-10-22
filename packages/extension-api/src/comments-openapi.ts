import {z} from "zod";
import {commentPageSchema,commentContextSchema,commentSchema,moderateCommentSchema,commentAuditPageSchema} from "./comments";
const json=(schema:z.ZodType)=>({"application/json":{schema:z.toJSONSchema(schema,{target:"openapi-3.0"})}});
const security=[{bearerSession:[]},{sessionCookie:[]}];
const errors=Object.fromEntries([400,401,403,404,409,413,415,429,503].map(status=>[status,{description:"失败，返回 {error:{code,message}}"}]));
const response=(schema:z.ZodType)=>({200:{description:"成功",content:json(schema)},...errors});
const before={name:"before",in:"query",schema:{type:"string"}};
export function commentsOpenApiPaths(){return {
 "/api/v1/admin/comments":{get:{operationId:"listAdminComments",security,summary:"管理员评论列表：每页30条，正文只返回120字符摘要；单条状态和整串隐藏分别显示",parameters:[before,{name:"contentId",in:"query",schema:{type:"string"}},{name:"status",in:"query",schema:{type:"string",enum:["all","visible","hidden","deleted"]}}],responses:response(commentPageSchema)}},
 "/api/v1/admin/comments/{id}":{parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],get:{operationId:"getCommentContext",security,summary:"管理员查看评论、一级归属、直接回复目标和该串二级回复分页；不返回已删除正文",parameters:[before],responses:response(commentContextSchema)},patch:{operationId:"moderateComment",security,summary:"版本校验；hide/restore作用于单条，hide_thread/show_thread只作用于一级开关，delete清空正文且不可恢复，保留关系",requestBody:{required:true,content:json(moderateCommentSchema)},responses:response(commentSchema)}},
 "/api/v1/admin/audit/comments":{get:{operationId:"listCommentAudit",security,summary:"只读评论管理记录，最多30条，不保存正文快照",parameters:[before],responses:response(commentAuditPageSchema)}}
};}
