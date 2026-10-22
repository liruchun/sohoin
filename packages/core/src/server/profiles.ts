import "server-only";
import {readProfile,writeProfile,ProfileStoreError,type ProfileRow} from "@sohoin/database";
import {profileUpdateSchema,type UserProfileExtensionDefinition,type UserProfile} from "@sohoin/extension-api/profiles";
import {userIdSchema} from "@sohoin/extension-api/users";
import {checkExtensionDefinition,prepareContentData,publicContentData} from "./content-data";
import {requireAuthenticatedUser,requireAdministrator,enforceLimit,ServiceError} from "./security";
function id(value:unknown){const result=userIdSchema.safeParse(value);if(!result.success)throw new ServiceError(400,"INVALID_USER_ID","用户编号无效");return result.data;}
const serialize=(row:ProfileRow):UserProfile=>({userId:row.user_id,bio:row.bio,homepage:row.homepage,data:row.data,dataSchemaVersion:row.schema_version,version:row.version});
export function createProfileService(definition?:UserProfileExtensionDefinition){checkExtensionDefinition(definition);
 async function required(target:string,publicOnly=false){const row=await readProfile(target,publicOnly);if(!row)throw new ServiceError(404,"PROFILE_NOT_FOUND","用户资料不存在或不可访问");return row;}
 async function update(headers:Headers,target:unknown,input:unknown,admin=false){const actor=admin?await requireAdministrator(headers):await requireAuthenticatedUser(headers);await enforceLimit("profiles-write",actor.id,30,60);const userId=admin?id(target):actor.id;const parsed=profileUpdateSchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,"INVALID_PROFILE","资料格式无效，请检查介绍和主页地址");
 const value=parsed.data;const extension=value.data===undefined?undefined:prepareContentData(definition,value.data,true);
 try{return serialize(await writeProfile(actor.id,userId,value,admin,extension));}catch(error){if(error instanceof ProfileStoreError){const map={forbidden:[403,"FORBIDDEN","当前账号无法修改此资料"],missing:[404,"PROFILE_NOT_FOUND","用户不存在"],conflict:[409,"PROFILE_CONFLICT","资料或扩展版本已改变，请刷新后重试"]} as const;const [status,code,message]=map[error.code];throw new ServiceError(status,code,message);}throw error;}}
 return {async readOwn(headers:Headers){const actor=await requireAuthenticatedUser(headers);await enforceLimit("profiles-read",actor.id,120,60);return serialize(await required(actor.id));},async readAdmin(headers:Headers,target:unknown){const actor=await requireAdministrator(headers);await enforceLimit("profiles-read",actor.id,120,60);return serialize(await required(id(target)));},async readPublic(target:unknown){const row=await required(id(target),true);return {userId:row.user_id,bio:row.bio,homepage:row.homepage,data:publicContentData(definition,row.data,row.schema_version)};},updateOwn:(headers:Headers,input:unknown)=>update(headers,undefined,input),updateAdmin:(headers:Headers,target:unknown,input:unknown)=>update(headers,target,input,true)};
}
