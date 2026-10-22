import {z} from "zod";
import {contentDataSchema,type ContentExtensionDefinition} from "./content";
const text=(max:number)=>z.string().trim().max(max).refine(v=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v));
export const homepageSchema=text(500).refine(value=>{if(value==="")return true;try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password&&!/[\s\\]/.test(value);}catch{return false;}},"主页须为不含账号密码的 HTTPS 地址");
export const profileUpdateSchema=z.strictObject({version:z.number().int().nonnegative(),bio:text(500),homepage:homepageSchema,data:contentDataSchema.optional()});
export const profileSchema=z.strictObject({userId:z.string(),bio:z.string(),homepage:z.string(),data:contentDataSchema,dataSchemaVersion:z.number().int(),version:z.number().int().nonnegative()});
export const publicProfileSchema=profileSchema.omit({version:true,dataSchemaVersion:true});
export type UserProfile=z.infer<typeof profileSchema>;
export type UserProfileExtensionDefinition=ContentExtensionDefinition;

export const memberMediaIdSchema=z.string().regex(/^(?=.*[a-z])[a-z0-9]{10}$/);
export const contactKindSchema=z.enum(['wechat','line','qq','feishu','whatsapp','email','discord','telegram','phone']);
export type ContactKind=z.infer<typeof contactKindSchema>;
export type MemberMedia={id:string;file:{name:string;type:string;size:number};url:string;width:number;height:number;durationMs?:number|null};
const memberContactSchema=z.strictObject({kind:contactKindSchema,text:text(200),mediaId:memberMediaIdSchema.nullable()}).superRefine((v,ctx)=>{
 const qr=['wechat','line','qq','feishu'].includes(v.kind);
 if(qr?(!v.mediaId||v.text!==''):(v.mediaId!==null||!v.text))ctx.addIssue({code:'custom',message:'联系方式格式无效'});
 if(v.kind==='email'&&!z.email().safeParse(v.text).success)ctx.addIssue({code:'custom',message:'邮箱格式无效'});
});
export const memberProfileUpdateSchema=z.strictObject({version:z.number().int().nonnegative(),name:text(80).min(1),bio:text(500),region:text(100),visibility:z.enum(['public','friends','hidden']),avatarId:memberMediaIdSchema.nullable(),contacts:z.array(memberContactSchema).max(9).refine(v=>new Set(v.map(c=>c.kind)).size===v.length)});
export type MemberProfileUpdate=z.infer<typeof memberProfileUpdateSchema>;
export type MemberProfileDetails={name:string;bio:string;avatar:string|null;version:number;region:string;visibility:MemberProfileUpdate['visibility'];contacts:{kind:ContactKind;text:string;media:MemberMedia|null}[]};
