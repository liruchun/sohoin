import {z} from "zod";
import {userIdSchema} from "./users";
import {contentIdSchema} from "./content";
export const setFollowSchema=z.strictObject({active:z.boolean()});
export const followDirectionSchema=z.enum(["following","followers"]);
export type FollowDirection=z.infer<typeof followDirectionSchema>;
export const followQuerySchema=z.strictObject({before:contentIdSchema.optional()});
export const followBatchSchema=z.strictObject({ids:z.array(userIdSchema).min(1).max(30).refine(ids=>new Set(ids).size===ids.length,"用户编号不能重复")});
export const followStateSchema=z.strictObject({id:z.string(),following:z.boolean(),followsMe:z.boolean(),mutual:z.boolean()});
export const followBatchResultSchema=z.strictObject({items:z.array(followStateSchema).max(30)});
export const followPageSchema=z.strictObject({items:z.array(followStateSchema.extend({name:z.string(),relationshipId:z.string(),createdAt:z.string()})).max(30),nextCursor:z.string().nullable()});

export type FollowState=z.infer<typeof followStateSchema>;
export type FollowPage=z.infer<typeof followPageSchema>;
export type FollowBatch=z.infer<typeof followBatchResultSchema>;
