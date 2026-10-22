import {z} from "zod";

export const userIdSchema=z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const usersQuerySchema=z.strictObject({
  q:z.string().trim().max(100).default(""),
  role:z.enum(["all","admin","user"]).default("all"),
  status:z.enum(["all","active","banned"]).default("all"),
  before:userIdSchema.optional(),
});
export const managedUserSchema=z.strictObject({
  id:z.string(),name:z.string(),email:z.string(),emailVerified:z.boolean(),
  role:z.enum(["admin","user"]),banned:z.boolean(),banReason:z.string().nullable(),
  createdAt:z.string(),updatedAt:z.string(),version:z.number().int().nonnegative(),
});
export const managedUsersPageSchema=z.strictObject({items:z.array(managedUserSchema).max(30),nextCursor:z.string().nullable()});
export const updateUserSchema=z.strictObject({
  version:z.number().int().nonnegative(),
  patch:z.strictObject({role:z.enum(["admin","user"]).optional(),banned:z.boolean().optional(),banReason:z.string().trim().max(500).optional()})
    .refine(p=>p.role!==undefined||p.banned!==undefined,{message:"请选择要修改的状态或权限"})
    .refine(p=>p.banReason===undefined||p.banned===true,{message:"禁用原因须与禁用操作一起提交"}),
});
export type UsersQuery=z.infer<typeof usersQuerySchema>;
export type ManagedUser=z.infer<typeof managedUserSchema>;
export type ManagedUsersPage=z.infer<typeof managedUsersPageSchema>;
export type UserUpdate=z.infer<typeof updateUserSchema>;
