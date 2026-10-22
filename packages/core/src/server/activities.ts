import "server-only";
import {readFollowingActivities} from "@sohoin/database";
import {activityQuerySchema,type ActivityPage} from "@sohoin/extension-api/activities";
import {requireAuthenticatedUser,enforceLimit,ServiceError} from "./security";
export async function getFollowingActivities(headers:Headers,input:unknown={}):Promise<ActivityPage>{
 const actor=await requireAuthenticatedUser(headers);await enforceLimit("following-activities-read",actor.id,120,60);
 const parsed=activityQuerySchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,"INVALID_ACTIVITY_QUERY","动态分页参数无效");
 const rows=await readFollowingActivities(actor.id,parsed.data.before);
 return {items:rows.slice(0,30).map(row=>({id:row.id,kind:row.kind,actor:{id:row.actor_id,name:row.actor_name},content:{id:row.content_id,type:row.content_type,title:row.content_title,excerpt:row.content_excerpt},comment:row.comment_id?{id:row.comment_id,excerpt:row.comment_excerpt??"",replyToId:row.reply_to_id}:null,reaction:row.reaction_code?{code:row.reaction_code,label:row.reaction_label!,emoji:row.reaction_emoji!}:null,createdAt:row.created_at.toISOString()})),nextCursor:rows.length>30?rows[29].id:null};
}
