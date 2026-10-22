import {z} from "zod";
import {userIdSchema} from "./users";

const text=(max:number)=>z.string().trim().min(1).max(max).refine(value=>!value.includes("\0"));
export const pointsEntryIdSchema=z.string().regex(/^[1-9][0-9]{0,18}$/)
  .refine(value=>/^[1-9][0-9]{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n);
const source={
  accountId:userIdSchema,
  idempotencyKey:text(200),
  sourceType:text(64),
  sourceId:text(200),
  reason:text(500),
};
export const pointsMutationSchema=z.strictObject({
  ...source,amount:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
export const pointsReverseSchema=z.strictObject({...source,entryId:pointsEntryIdSchema});
export const pointsQuerySchema=z.strictObject({before:pointsEntryIdSchema.optional()});
export const pointsSystemIdSchema=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export type PointsMutation=z.infer<typeof pointsMutationSchema>;
export type PointsReverse=z.infer<typeof pointsReverseSchema>;
export type PointsQuery=z.infer<typeof pointsQuerySchema>;
export type PointsActor={kind:"system"|"admin";id:string};
export type PointsEntry={
  id:string;accountId:string;kind:"credit"|"debit"|"reverse";amount:number;balanceAfter:number;
  idempotencyKey:string;sourceType:string;sourceId:string;reason:string;
  actor:PointsActor;reversalOf:string|null;createdAt:string;
};
