import {linkCardSchema} from './link-preview';
import {z} from "zod";
export const contentIdSchema=z.string().regex(/^[1-9][0-9]{0,18}$/).refine(v=>/^[1-9][0-9]{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n);
const text=(max:number)=>z.string().trim().max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),"含有无效控制字符");
export const typeIdSchema=z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const memberPublicId=z.string().regex(/^(?=.*[a-z])[a-z0-9]{10}$/);
const publicationBody=text(5000).min(1);
const publicationLinks=z.array(linkCardSchema).max(9).default([]);
const validAttachments=(value:{media:string[];links:{url:string;position:number}[]})=>value.media.length+value.links.length<=9&&new Set(value.links.map(link=>link.url)).size===value.links.length&&new Set(value.links.map(link=>link.position)).size===value.links.length&&value.links.every(link=>link.position<value.media.length+value.links.length);
export const memberPublicationChangeSchema=z.strictObject({version:z.number().int().nonnegative(),value:z.strictObject({body:publicationBody,category:z.string().min(1).max(80).optional(),media:z.array(memberPublicId).max(9).refine(ids=>new Set(ids).size===ids.length).default([]),links:publicationLinks}).refine(validAttachments).nullable()});
export const memberPublicationSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('post'),requestId:z.uuid(),body:publicationBody,category:z.string().min(1).max(80),media:z.array(memberPublicId).max(9).refine(ids=>new Set(ids).size===ids.length),links:publicationLinks}).refine(validAttachments),
 z.strictObject({kind:z.literal('comment'),requestId:z.uuid(),body:publicationBody,target:z.strictObject({type:z.enum(['post','article','comment']),publicId:memberPublicId}),replyTo:memberPublicId.optional(),media:z.array(memberPublicId).max(9).refine(ids=>new Set(ids).size===ids.length).default([]),links:publicationLinks}).refine(validAttachments)
]);
export const termKindSchema=z.enum(["categories","tags"]);
export const termSchema=z.strictObject({id:z.string(),name:z.string(),slug:z.string(),description:z.string(),version:z.number().int().nonnegative(),iconMediaId:z.string().nullable()});
export const termInputSchema=z.strictObject({name:text(60).min(1),slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),description:text(300),iconMediaId:contentIdSchema.nullable().optional()});
export const updateTermSchema=z.strictObject({version:z.number().int().nonnegative(),value:termInputSchema});
export const deleteContentSchema=z.strictObject({version:z.number().int().nonnegative()});
export const termsQuerySchema=z.strictObject({q:text(100).default(""),before:contentIdSchema.optional()});
export const termsPageSchema=z.strictObject({items:z.array(termSchema).max(30),nextCursor:z.string().nullable()});
export const contentDataSchema=z.record(z.string().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/).refine(key=>!["constructor","prototype"].includes(key)),z.union([z.string().max(2000),z.number().finite(),z.boolean()])).refine(value=>Object.keys(value).length<=20);
export const contentMediaInputSchema=z.strictObject({mediaId:contentIdSchema,role:z.enum(["cover","gallery","attachment"]),altText:text(500),caption:text(1000)});
export const contentMediaInputsSchema=z.array(contentMediaInputSchema).max(21).refine(items=>items.filter(i=>i.role==="cover").length<=1&&items.filter(i=>i.role==="gallery").length<=10&&items.filter(i=>i.role==="attachment").length<=10,"最多1张封面、10张图库图片和10个附件").refine(items=>new Set(items.map(i=>i.role+":"+i.mediaId)).size===items.length,"同一用途不能重复引用媒体");
export const adminContentMediaSchema=contentMediaInputSchema.extend({name:z.string(),mimeType:z.string(),width:z.number().nullable(),height:z.number().nullable()});
export const contentValueSchema=z.strictObject({type:typeIdSchema,title:text(160),excerpt:text(500),body:text(50000),categoryId:contentIdSchema.nullable(),tagIds:z.array(contentIdSchema).max(10).refine(ids=>new Set(ids).size===ids.length),status:z.enum(["draft","published","archived"]),data:contentDataSchema.optional(),media:contentMediaInputsSchema.optional(),featured:z.boolean().optional(),pinLevel:z.number().int().min(0).max(3).optional()})
 .refine(v=>v.type==="post"||v.title.length>0,"文章及其他类型须填写标题")
 .refine(v=>v.type!=="post"||v.body.length>0,"帖子须填写正文")
 .refine(v=>v.status!=="published"||(v.categoryId!==null&&v.body.length>0),"发布前须选择分类并填写正文");
export const updateContentSchema=z.strictObject({version:z.number().int().nonnegative(),value:contentValueSchema});
export const contentSortSchema=z.enum(["latest","published","updated","priority"]);
export const contentCursorSchema=z.strictObject({sort:contentSortSchema,id:contentIdSchema,at:z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/).refine(v=>Number.isFinite(Date.parse(v))),pin:z.number().int().min(0).max(3)});
export const publicContentQuerySchema=z.strictObject({before:z.union([contentIdSchema,z.string().regex(/^[A-Za-z0-9_-]{20,256}$/)]).optional(),sort:contentSortSchema.default("latest"),featured:z.enum(["all","yes","no"]).default("all"),pinned:z.enum(["all","yes","no"]).default("all"),q:text(100).default(""),type:typeIdSchema.optional(),categoryId:contentIdSchema.optional(),tagId:contentIdSchema.optional()});
export const adminContentQuerySchema=publicContentQuerySchema.extend({status:z.enum(["all","draft","published","archived"]).default("all")});
const referenceSchema=z.strictObject({id:z.string(),name:z.string(),slug:z.string()});
export const contentSummarySchema=z.strictObject({id:z.string(),type:z.string(),title:z.string(),excerpt:z.string(),category:referenceSchema.nullable(),tags:z.array(referenceSchema).max(10),publishedAt:z.string().nullable(),featured:z.boolean(),featuredAt:z.string().nullable(),pinLevel:z.number().int().min(0).max(3)});
export const publicContentSchema=contentSummarySchema.extend({body:z.string(),data:contentDataSchema});
export const adminContentSummarySchema=contentSummarySchema.extend({status:z.enum(["draft","published","archived"]),version:z.number().int(),updatedAt:z.string()});
export const adminContentSchema=adminContentSummarySchema.extend({body:z.string(),data:contentDataSchema,dataSchemaVersion:z.number().int().nonnegative(),media:z.array(adminContentMediaSchema).max(21)});
export const publicContentPageSchema=z.strictObject({items:z.array(contentSummarySchema).max(30),nextCursor:z.string().nullable()});
export const adminContentPageSchema=z.strictObject({items:z.array(adminContentSummarySchema).max(30),nextCursor:z.string().nullable()});
export type Term=z.infer<typeof termSchema>;
export type TermInput=z.infer<typeof termInputSchema>;
export type TermKind=z.infer<typeof termKindSchema>;
export type ContentValue=z.infer<typeof contentValueSchema>;
export type ContentSummary=z.infer<typeof contentSummarySchema>;
export type PublicContent=z.infer<typeof publicContentSchema>;
export type AdminContent=z.infer<typeof adminContentSchema>;
export type ContentQuery=z.infer<typeof adminContentQuerySchema>;
export type ContentData=z.infer<typeof contentDataSchema>;
export type ContentMediaInput=z.infer<typeof contentMediaInputSchema>;
export type AdminContentMedia=z.infer<typeof adminContentMediaSchema>;
export type ContentFieldDefinition=({kind:"text";maxLength:number}|{kind:"number";min?:number;max?:number;integer?:boolean}|{kind:"boolean"}|{kind:"enum";options:readonly string[]})&{required?:boolean;public?:boolean};
export interface ContentExtensionDefinition {schemaVersion:number;fields:Readonly<Record<string,ContentFieldDefinition>>}
