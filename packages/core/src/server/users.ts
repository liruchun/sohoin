import "server-only";
import {readManagedUsers,readManagedUser,persistManagedUser,type UserRecord} from "@sohoin/database";
import {usersQuerySchema,userIdSchema,updateUserSchema,type ManagedUser,type ManagedUsersPage} from "@sohoin/extension-api/users";
import {requireAdministrator,enforceLimit,ServiceError} from "./security";

function serialize(row:UserRecord):ManagedUser {
  return {id:row.id,name:row.name,email:row.email,emailVerified:row.emailVerified,
    role:row.role?.split(",").includes("admin")?"admin":"user",banned:row.banned??false,banReason:row.banReason,
    createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),version:row.admin_version};
}
function parseId(input:unknown){const parsed=userIdSchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,"INVALID_USER_ID","用户编号无效");return parsed.data;}
export async function listUsers(headers:Headers,input:unknown):Promise<ManagedUsersPage> {
  const actor=await requireAdministrator(headers);await enforceLimit("users-read",actor.id,120,60);
  const parsed=usersQuerySchema.safeParse(input);if(!parsed.success)throw new ServiceError(400,"INVALID_QUERY","搜索或分页参数无效");
  const rows=await readManagedUsers(parsed.data);const items=rows.slice(0,30).map(serialize);
  return {items,nextCursor:rows.length>30?items[items.length-1].id:null};
}
export async function getUser(headers:Headers,input:unknown):Promise<ManagedUser> {
  const actor=await requireAdministrator(headers);await enforceLimit("users-read",actor.id,120,60);
  const row=await readManagedUser(parseId(input));if(!row)throw new ServiceError(404,"USER_NOT_FOUND","用户不存在");return serialize(row);
}
export async function updateUser(headers:Headers,inputId:unknown,input:unknown):Promise<ManagedUser> {
  const actor=await requireAdministrator(headers);await enforceLimit("users-write",actor.id,30,60);
  const id=parseId(inputId);const parsed=updateUserSchema.safeParse(input);
  if(!parsed.success)throw new ServiceError(400,"INVALID_USER_UPDATE","修改参数无效，请检查状态、权限及禁用原因");
  // Editing your own access is never exposed as an administrative action.
  if(actor.id===id)throw new ServiceError(409,"SELF_UPDATE","不能在用户管理中调整自己的权限或状态");
  const result=await persistManagedUser(actor.id,id,parsed.data.version,parsed.data.patch);
  if("user" in result)return serialize(result.user);
  const errors={forbidden:[403,"FORBIDDEN","当前账号没有管理权限"],missing:[404,"USER_NOT_FOUND","用户不存在"],conflict:[409,"VERSION_CONFLICT","用户已被其他管理员修改，请刷新后重试"],self:[409,"SELF_UPDATE","不能禁用自己或移除自己的管理员权限"],last_admin:[409,"LAST_ADMIN","必须保留至少一位启用的管理员"]} as const;
  const [status,code,message]=errors[result.error];throw new ServiceError(status,code,message);
}
