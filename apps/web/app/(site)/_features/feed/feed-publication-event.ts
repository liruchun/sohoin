export const feedPublicationEvent="sohoin:feed-publication";
export type FeedPublication={id:string;result:Promise<string|null>};

/** Only mounted lists receive this attempt; no drafts or page data are cached. */
export function beginFeedPublication(){
 let complete!:(publicId:string|null)=>void;
 const result=new Promise<string|null>(resolve=>{complete=resolve;});
 window.dispatchEvent(new CustomEvent<FeedPublication>(feedPublicationEvent,{detail:{id:crypto.randomUUID(),result}}));
 return complete;
}
