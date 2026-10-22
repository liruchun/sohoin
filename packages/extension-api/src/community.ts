import {z} from "zod";
export const categoryMembershipSchema=z.strictObject({joined:z.boolean()});
export type CategoryMembership=z.infer<typeof categoryMembershipSchema>;
