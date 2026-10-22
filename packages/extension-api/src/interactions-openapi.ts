import {z} from "zod";
import {siteCommentActionSchema,setSiteReactionSchema,siteInteractionSchema,setReactionSchema,setBookmarkSchema,interactionBatchSchema,interactionBatchResultSchema,bookmarkPageSchema,reactionTypeSchema,updateReactionTypeSchema} from "./interactions";
const json=(schema:z.ZodType)=>({"application/json":{schema:z.toJSONSchema(schema,{target:"openapi-3.0"})}});
const security=[{bearerSession:[]},{sessionCookie:[]}];
const response=(schema:z.ZodType)=>({200:{description:"成功",content:json(schema)},...Object.fromEntries([400,401,403,404,409,413,415,429,503].map(status=>[status,{description:"失败，返回 {error:{code,message}}"}]))});
const body=(schema:z.ZodType)=>({required:true,content:json(schema)});
const kind={name:"kind",in:"path",required:true,schema:{type:"string",enum:["content","comments"]}};
const id={name:"id",in:"path",required:true,schema:{type:"string"}};
export function interactionsOpenApiPaths(){return {
 "/api/site/interactions/{id}/comments/reaction":{parameters:[id],put:{operationId:"setSiteCommentReaction",security,summary:"主帖公开 ID 与绑定主帖的 commentToken：添加或取消评论表情，最多 5 个",requestBody:body(siteCommentActionSchema.extend({value:setSiteReactionSchema})),responses:response(siteInteractionSchema)}},
 "/api/site/interactions/{id}/comments/bookmark":{parameters:[id],put:{operationId:"setSiteCommentBookmark",security,summary:"主帖公开 ID 与绑定主帖的 commentToken：设置自己的私密评论收藏",requestBody:body(siteCommentActionSchema.extend({value:setBookmarkSchema})),responses:response(siteInteractionSchema)}},
 "/api/site/interactions/{id}/reaction":{parameters:[id],put:{operationId:"setSiteReaction",security,summary:"公开 ID：独立添加或取消自己的表情，每篇最多 5 个（含 like），幂等；返回最新计数及自己的状态",requestBody:body(setSiteReactionSchema),responses:response(siteInteractionSchema)}},
 "/api/site/interactions/{id}/bookmark":{parameters:[id],put:{operationId:"setSiteBookmark",security,summary:"公开 ID：设置自己的私密收藏，独立于表情；返回最新计数及自己的状态",requestBody:body(setBookmarkSchema),responses:response(siteInteractionSchema)}},
 "/api/v1/reaction-types":{get:{operationId:"getReactionTypes",summary:"表情目录；包含停用类型以解释历史记录，前台仅允许选择 enabled 类型",responses:response(z.strictObject({items:z.array(reactionTypeSchema.omit({version:true}))}))}},
 "/api/v1/admin/reaction-types":{get:{operationId:"getAdminReactionTypes",security,summary:"管理员读取表情配置和版本",responses:response(z.strictObject({items:z.array(reactionTypeSchema)}))}},
 "/api/v1/admin/reaction-types/{code}":{parameters:[{name:"code",in:"path",required:true,schema:{type:"string"}}],patch:{operationId:"updateReactionType",security,summary:"调整已有表情的启用状态、排序；版本校验并记入设置审计",requestBody:body(updateReactionTypeSchema),responses:response(reactionTypeSchema)}},
 "/api/v1/interactions/{kind}/{id}/reaction":{parameters:[kind,id],put:{operationId:"setReaction",security,summary:"设置自己的单个表情；切换替换原值，code=null 取消；幂等",requestBody:body(setReactionSchema),responses:response(setReactionSchema)}},
 "/api/v1/interactions/{kind}/{id}/bookmark":{parameters:[kind,id],put:{operationId:"setBookmark",security,summary:"设置自己的私密收藏，active=false 取消；幂等，不能操作他人收藏",requestBody:body(setBookmarkSchema),responses:response(setBookmarkSchema)}},
 "/api/v1/interactions/{kind}/summary":{parameters:[kind],post:{operationId:"getInteractionBatch",security,summary:"批量读取最多30个可见对象的表情计数、自己的表情及收藏状态；不可见对象省略；不返回收藏人数或收藏用户",requestBody:body(interactionBatchSchema),responses:response(interactionBatchResultSchema)}},
 "/api/v1/account/bookmarks/{kind}":{parameters:[kind],get:{operationId:"getOwnBookmarks",security,summary:"仅当前用户自己的收藏；不可见对象暂不展示；编号游标分页每页30条，不含全文",parameters:[{name:"before",in:"query",schema:{type:"string"}}],responses:response(bookmarkPageSchema)}}
};}
