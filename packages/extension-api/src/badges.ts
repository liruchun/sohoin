import {z} from "zod";
import {userIdSchema} from "./users";

const text=(max:number)=>z.string().trim().min(1).max(max).refine(value=>!value.includes("\0"));
export const badgeKeySchema=z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/);
const revision=z.number().int().min(1).max(2147483647);
const definition={
  key:badgeKeySchema,name:text(60),
  description:z.string().trim().max(500).refine(value=>!value.includes("\0")),
  enabled:z.boolean(),reason:text(500),
  iconMediaId:z.string().regex(/^[1-9][0-9]{0,18}$/).refine(v=>/^[1-9][0-9]{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n).nullable().optional(),
};
export const createBadgeSchema=z.strictObject(definition);
export const updateBadgeSchema=z.strictObject({...definition,revision});
const mutation={
  userId:userIdSchema,badgeKey:badgeKeySchema,idempotencyKey:text(200),
  sourceType:text(64),sourceId:text(200),reason:text(500),
};
export const grantBadgeSchema=z.strictObject(mutation);
// Revoke the observed award, not a later re-award of the same badge.
export const revokeBadgeSchema=z.strictObject({...mutation,revision});
export const badgeQuerySchema=z.strictObject({before:badgeKeySchema.optional()});
export const badgeOptionsQuerySchema=badgeQuerySchema.extend({key:badgeKeySchema.optional()});
export const badgeAuditQuerySchema=z.strictObject({
  before:z.string().regex(/^[1-9][0-9]{0,18}$/)
    .refine(value=>/^[1-9][0-9]{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n).optional(),
});
export const badgeSystemIdSchema=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const createManagedBadgeSchema=createBadgeSchema.omit({key:true}).extend({requestId:z.string().uuid()});
export const manualBadgeSchema=z.strictObject({userId:userIdSchema,badgeKey:badgeKeySchema,reason:text(500),requestId:z.string().uuid()});
export const manualRevokeBadgeSchema=manualBadgeSchema.extend({revision});
export const badgeRecipientsQuerySchema=z.strictObject({before:userIdSchema.optional()});
export type BadgeDefinition={key:string;name:string;description:string;enabled:boolean;revision:number;createdAt:string;updatedAt:string;iconMediaId:string|null};
export type UserBadgeState={userId:string;badgeKey:string;active:boolean;revision:number;awardedAt:string;revokedAt:string|null};
export type BadgeGrant=z.infer<typeof grantBadgeSchema>;
export type BadgeRevoke=z.infer<typeof revokeBadgeSchema>;
export const wearBadgeSchema=z.strictObject({badgeKey:badgeKeySchema.nullable(),revision:z.number().int().min(0).max(2147483646)});
export type WornBadge={key:string;name:string;iconUrl:string|null};
export type MedalItem=WornBadge&{description:string;awardedAt:string|null};
export type MedalCollection={
  user:{publicId:string;name:string;avatar:string|null};
  items:MedalItem[];nextCursor:string|null;total:number;earned:number;
  worn:WornBadge|null;revision:number;
};
