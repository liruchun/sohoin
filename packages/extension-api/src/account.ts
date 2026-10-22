import {z} from "zod";
import {userIdSchema} from "./users";
export const sessionsQuerySchema=z.strictObject({before:userIdSchema.optional()});
export const sessionInfoSchema=z.strictObject({id:z.string(),createdAt:z.string(),expiresAt:z.string(),userAgent:z.string().nullable(),ipAddress:z.string().nullable(),current:z.boolean()});
export const sessionsPageSchema=z.strictObject({items:z.array(sessionInfoSchema).max(20),nextCursor:z.string().nullable()});
export const revokeSessionsSchema=z.discriminatedUnion("scope",[
  z.strictObject({scope:z.literal("session"),id:userIdSchema}),
  z.strictObject({scope:z.literal("others")}),
]);
export const changePasswordSchema=z.strictObject({currentPassword:z.string().min(1).max(128),newPassword:z.string().min(12).max(128)})
  .refine(value=>value.currentPassword!==value.newPassword,{message:"新密码不能与旧密码相同"});
export const revokeSessionsResultSchema=z.strictObject({revoked:z.number().int().nonnegative()});
export const changePasswordResultSchema=z.strictObject({reauthenticate:z.literal(true)});
export type SessionsPage=z.infer<typeof sessionsPageSchema>;
