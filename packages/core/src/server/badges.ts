import {avatarUrl} from "./avatar-url";
import "server-only";
import {readMedalCollection,writeWornBadge} from "@sohoin/database";
import {wearBadgeSchema,type MedalCollection} from "@sohoin/extension-api/badges";
import {publicRoutes} from "./public-routes";
import {readBadgeDefinition,readBadgeOptions,readBadgeRecipients,readUserBadgeDetails} from "@sohoin/database";
import {createManagedBadgeSchema,manualBadgeSchema,manualRevokeBadgeSchema,badgeRecipientsQuerySchema,badgeOptionsQuerySchema} from "@sohoin/extension-api/badges";
import {
  writeBadgeDefinition,writeUserBadge,readBadgeDefinitions,readUserBadges,readManagedUserBadges,readBadgeAudit,
  BadgeStoreError,type BadgeActor,
} from "@sohoin/database";
import {
  createBadgeSchema,updateBadgeSchema,grantBadgeSchema,revokeBadgeSchema,
  badgeKeySchema,badgeQuerySchema,badgeAuditQuerySchema,badgeSystemIdSchema,
} from "@sohoin/extension-api/badges";
import {userIdSchema} from "@sohoin/extension-api/users";
import {requireAdministrator,requireAuthenticatedUser,enforceLimit,ServiceError} from "./security";

function parse<T>(schema:{safeParse:(input:unknown)=>{success:true;data:T}|{success:false}},input:unknown):T{
  const result=schema.safeParse(input);
  if(!result.success)throw new ServiceError(400,"INVALID_BADGE_INPUT","勋章参数无效");
  return result.data;
}
async function mapped<T>(work:()=>Promise<T>):Promise<T>{
  try{return await work();}catch(error){
    if(error instanceof BadgeStoreError){
      const errors={
        invalid_icon:[400,"BADGE_INVALID_ICON","请选择媒体库中可用的图片"],
        forbidden:[403,"FORBIDDEN","当前账号没有管理权限"],
        missing:[404,"BADGE_NOT_FOUND","勋章不存在"],
        user_missing:[404,"BADGE_USER_NOT_FOUND","用户不存在"],
        disabled:[409,"BADGE_DISABLED","该勋章已停用"],
        exists:[409,"BADGE_ALREADY_EXISTS","勋章标识已存在"],
        conflict:[409,"BADGE_REVISION_CONFLICT","勋章状态已变化，请刷新后重试"],
        idempotency_conflict:[409,"BADGE_IDEMPOTENCY_CONFLICT","相同业务标识的勋章参数不一致"],
        award_missing:[404,"BADGE_AWARD_NOT_FOUND","用户尚未获得该勋章"],
      } as const;
      const [status,code,message]=errors[error.code];
      throw new ServiceError(status,code,message);
    }
    throw error;
  }
}
function page<T>(rows:T[],cursor:(row:T)=>string){
  return {items:rows.slice(0,30),nextCursor:rows.length>30?cursor(rows[29]):null};
}
function awards(resolveActor:()=>Promise<BadgeActor>){
  return {
    async grant(input:unknown){
      const actor=await resolveActor(),value=parse(grantBadgeSchema,input);
      return mapped(()=>writeUserBadge(actor,{...value,operation:"grant"}));
    },
    async revoke(input:unknown){
      const actor=await resolveActor(),value=parse(revokeBadgeSchema,input);
      return mapped(()=>writeUserBadge(actor,{...value,operation:"revoke"}));
    },
    async listUserBadges(userId:unknown,input:unknown={}){
      const actor=await resolveActor(),id=parse(userIdSchema,userId),query=parse(badgeQuerySchema,input);
      return mapped(async()=>page(await readManagedUserBadges(actor,id,query.before),row=>row.badgeKey));
    },
  };
}

/** Privileged server-only capability. Do not select this identity from HTTP input. */
export function createSystemBadgeService(systemId:string){
  const id=parse(badgeSystemIdSchema,systemId);
  return awards(async()=>({kind:"system",id}));
}

export function createAdminBadgeService(headers:Headers){
  const access=async():Promise<BadgeActor>=>{
    const actor=await requireAdministrator(headers);
    await enforceLimit("badges-admin",actor.id,120,60);
    return {kind:"admin",id:actor.id};
  };
  return {
    ...awards(access),
    async createManagedDefinition(input:unknown){
      const actor=await access(),value=parse(createManagedBadgeSchema,input);
      const {requestId,...definition}=value;
      return mapped(()=>writeBadgeDefinition(actor,{...definition,key:"badge-"+requestId.replaceAll("-","")}));
    },
    async grantManually(input:unknown){
      const actor=await access(),value=parse(manualBadgeSchema,input);
      return mapped(()=>writeUserBadge(actor,{userId:value.userId,badgeKey:value.badgeKey,reason:value.reason,
        idempotencyKey:"manual:"+value.requestId,sourceType:"manual",sourceId:value.requestId,operation:"grant"}));
    },
    async revokeManually(input:unknown){
      const actor=await access(),value=parse(manualRevokeBadgeSchema,input);
      return mapped(()=>writeUserBadge(actor,{userId:value.userId,badgeKey:value.badgeKey,reason:value.reason,revision:value.revision,
        idempotencyKey:"manual:"+value.requestId,sourceType:"manual",sourceId:value.requestId,operation:"revoke"}));
    },
    async getDefinition(key:unknown){
      const actor=await access(),id=parse(badgeKeySchema,key);
      return mapped(()=>readBadgeDefinition(actor,id));
    },
    async listOptions(userId:unknown,input:unknown={}){
      const actor=await access(),id=parse(userIdSchema,userId),query=parse(badgeOptionsQuerySchema,input);
      return mapped(async()=>page((await readBadgeOptions(actor,id,query.before,query.key)).map(({icon_media_id,...row})=>({...row,iconMediaId:icon_media_id})),row=>row.key));
    },
    async listRecipients(key:unknown,input:unknown={}){
      const actor=await access(),id=parse(badgeKeySchema,key),query=parse(badgeRecipientsQuerySchema,input);
      return mapped(async()=>page(await readBadgeRecipients(actor,id,query.before),row=>row.userId));
    },
    async listUserDetails(userId:unknown,input:unknown={}){
      const actor=await access(),id=parse(userIdSchema,userId),query=parse(badgeQuerySchema,input);
      return mapped(async()=>page(await readUserBadgeDetails(actor,id,query.before),row=>row.badgeKey));
    },
    async listUserAudit(userId:unknown,input:unknown={}){
      const actor=await access(),id=parse(userIdSchema,userId),query=parse(badgeAuditQuerySchema,input);
      return mapped(async()=>page(await readBadgeAudit(actor,null,query.before,id),row=>row.id));
    },
    async createDefinition(input:unknown){
      const actor=await access(),value=parse(createBadgeSchema,input);
      return mapped(()=>writeBadgeDefinition(actor,value));
    },
    async updateDefinition(input:unknown){
      const actor=await access(),value=parse(updateBadgeSchema,input);
      return mapped(()=>writeBadgeDefinition(actor,value));
    },
    async listDefinitions(input:unknown={}){
      const actor=await access(),query=parse(badgeQuerySchema,input);
      return mapped(async()=>page(await readBadgeDefinitions(actor,query.before),row=>row.key));
    },
    async listAudit(badgeKey:unknown,input:unknown={}){
      const actor=await access(),key=parse(badgeKeySchema,badgeKey),query=parse(badgeAuditQuerySchema,input);
      return mapped(async()=>page(await readBadgeAudit(actor,key,query.before),row=>row.id));
    },
  };
}

/** Only the current user's active awards, without internal sources or actor identities. */
export async function listOwnBadges(headers:Headers,input:unknown={}){
  const user=await requireAuthenticatedUser(headers),query=parse(badgeQuerySchema,input);
  await enforceLimit("badges-read",user.id,120,60);
  return page(await readUserBadges(user.id,query.before),row=>row.key);
}

export async function getOwnMedals(headers:Headers,input:unknown={}):Promise<MedalCollection>{
 const user=await requireAuthenticatedUser(headers),query=parse(badgeQuerySchema,input);
 await enforceLimit("medals-read",user.id,120,60);
 const row=await mapped(()=>readMedalCollection(user.id,query.before));
 const ids=await publicRoutes([],[user.id]);
 return {user:{publicId:ids.get("user:"+user.id)!,name:row.name,
  avatar:avatarUrl(row.image)},
  ...page(row.items,item=>item.key),total:row.total,earned:row.earned,worn:row.worn,revision:row.revision};
}
export async function getSiteMedals(headers:Headers){
 try{return await getOwnMedals(headers);}catch(error){
  if(error instanceof ServiceError&&(error.status===401||error.status===403))return null;
  throw error;
 }
}
export async function wearOwnBadge(headers:Headers,input:unknown){
 const user=await requireAuthenticatedUser(headers),value=parse(wearBadgeSchema,input);
 await enforceLimit("medals-write",user.id,30,60);
 return mapped(()=>writeWornBadge(user.id,value));
}
