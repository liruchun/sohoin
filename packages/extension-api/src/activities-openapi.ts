import {z} from "zod";
import {activityPageSchema} from "./activities";
export function activitiesOpenApiPaths(){return {
 "/api/v1/account/activities":{get:{operationId:"getFollowingActivities",summary:"当前关注用户的可见活动；历史活动按首次记录编号倒序，游标分页30条；不含私密收藏，取消关注后立即排除",security:[{bearerSession:[]},{sessionCookie:[]}],parameters:[{name:"before",in:"query",schema:{type:"string"},description:"上一页返回的 nextCursor"}],responses:{200:{description:"关注动态，不含全文、邮箱或存储路径",content:{"application/json":{schema:z.toJSONSchema(activityPageSchema,{target:"openapi-3.0"})}}},...Object.fromEntries([400,401,403,429,503].map(status=>[status,{description:"失败，返回 {error:{code,message}}"}]))}}}
};}
