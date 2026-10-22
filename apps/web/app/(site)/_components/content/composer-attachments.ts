import type {LinkCard} from '@sohoin/extension-api/link-preview';
import type {LocalMedia} from '../../_features/media/media-library';
export type ComposerLink=Omit<LinkCard,'position'>&{id:string;kind:'link';coverUrl?:string};
export type ComposerAttachment=LocalMedia|ComposerLink;
export const isComposerLink=(item:ComposerAttachment):item is ComposerLink=>'kind' in item&&item.kind==='link';
export function attachmentPayload(items:ComposerAttachment[]){
 return {media:items.filter((item):item is LocalMedia=>!isComposerLink(item)).map(item=>item.id),links:items.flatMap((item,position)=>isComposerLink(item)?[{url:item.url,title:item.title,image:item.image,icon:item.icon,...(item.coverMediaId?{coverMediaId:item.coverMediaId}:{}),position}]:[])};
}
export function restoreAttachments(media:LocalMedia[]=[],links:(LinkCard&{coverUrl?:string})[]=[]):ComposerAttachment[]{
 const items:ComposerAttachment[]=[...media];
 for(const link of [...links].sort((a,b)=>a.position-b.position))items.splice(link.position,0,{...link,kind:'link',id:'link:'+link.url});
 return items;
}
