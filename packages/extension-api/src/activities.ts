import {z} from "zod";
import {contentIdSchema} from "./content";
export const activityKindSchema=z.enum(["content_published","comment_created","content_reacted","comment_reacted"]);
export const activityQuerySchema=z.strictObject({before:contentIdSchema.optional()});
export const activitySchema=z.strictObject({id:z.string(),kind:activityKindSchema,actor:z.strictObject({id:z.string(),name:z.string()}),content:z.strictObject({id:z.string(),type:z.string(),title:z.string(),excerpt:z.string()}),comment:z.strictObject({id:z.string(),excerpt:z.string(),replyToId:z.string().nullable()}).nullable(),reaction:z.strictObject({code:z.string(),label:z.string(),emoji:z.string()}).nullable(),createdAt:z.string()});
export const activityPageSchema=z.strictObject({items:z.array(activitySchema).max(30),nextCursor:z.string().nullable()});
export type Activity=z.infer<typeof activitySchema>;
export type ActivityPage=z.infer<typeof activityPageSchema>;
