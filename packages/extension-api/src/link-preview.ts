import {z} from 'zod';

/** Shared syntax check; the server also checks DNS before making any request. */
export function publicLinkUrl(value:string):string|null{
 try{
  if(value.length>2048||/[\u0000-\u0020\u007f]/.test(value))return null;
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase();
  if(!host.includes('.')||host.endsWith('.')||host.includes(':')||/^[\d.]+$/.test(host)||['localhost','local','internal','test','invalid'].some(s=>host.endsWith('.'+s)))return null;
  return url.href;
 }catch{return null;}
}
const url=z.string().max(2048).refine(value=>publicLinkUrl(value)!==null).transform(value=>publicLinkUrl(value)!);
export const linkPreviewRequestSchema=z.strictObject({url});
export const linkCardSchema=z.strictObject({
 url,title:z.string().trim().min(1).max(300).refine(value=>!/[\u0000-\u001f\u007f]/.test(value)),
 image:z.union([url,z.literal('')]).default(''),icon:z.union([url,z.literal('')]).default(''),
 coverMediaId:z.string().regex(/^(?=.*[a-z])[a-z0-9]{10}$/).optional(),
 position:z.number().int().min(0).max(8),
});
export type LinkCard=z.infer<typeof linkCardSchema>;
export type LinkPreview={url:string;title:string;image:string;icon:string;source:'page'|'microlink'|'manual'};
