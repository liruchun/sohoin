import "server-only";
import {writeFollow,readFollowStates,readOwnFollows,FollowStoreError,type FollowStateRow} from "@sohoin/database";
import {setFollowSchema,followBatchSchema,followQuerySchema,followDirectionSchema} from "@sohoin/extension-api/follows";
import {userIdSchema} from "@sohoin/extension-api/users";
import {requireAuthenticatedUser,enforceLimit,ServiceError} from "./security";
function parse<T>(schema:{safeParse:(input:unknown)=>{success:true;data:T}|{success:false}},input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw new ServiceError(400,"INVALID_FOLLOW_INPUT","关注参数无效");return result.data;}
async function access(headers:Headers,write=false){const user=await requireAuthenticatedUser(headers);await enforceLimit(write?"follows-write":"follows-read",user.id,write?60:120,60);return user;}
const state=(row:FollowStateRow)=>({id:row.id,following:row.following,followsMe:row.follows_me,mutual:row.following&&row.follows_me});
export async function setFollow(headers:Headers,id:unknown,input:unknown){const actor=await access(headers,true),target=parse(userIdSchema,id),value=parse(setFollowSchema,input);try{return await writeFollow(actor.id,target,value.active);}catch(error){if(error instanceof FollowStoreError){const map={forbidden:[403,"FORBIDDEN","当前账号无法操作"],missing:[404,"FOLLOW_TARGET_NOT_FOUND","用户不存在或不可关注"],self:[400,"CANNOT_FOLLOW_SELF","不能关注自己"]} as const;const [status,code,message]=map[error.code];throw new ServiceError(status,code,message);}throw error;}}
export async function getFollowStates(headers:Headers,input:unknown){const actor=await access(headers),query=parse(followBatchSchema,input);return {items:(await readFollowStates(actor.id,query.ids)).map(state)};}
export async function getOwnFollows(headers:Headers,direction:unknown,input:unknown){const actor=await access(headers),query=parse(followQuerySchema,input),rows=await readOwnFollows(actor.id,parse(followDirectionSchema,direction),query.before);return {items:rows.slice(0,30).map(row=>({...state(row),name:row.name,relationshipId:row.relationship_id,createdAt:row.created_at.toISOString()})),nextCursor:rows.length>30?rows[29].relationship_id:null};}
