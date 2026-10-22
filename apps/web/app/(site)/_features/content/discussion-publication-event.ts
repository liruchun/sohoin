export const discussionPublicationEvent="sohoin:discussion-publication";
export const discussionCountEvent="sohoin:discussion-count";
export type DiscussionCounts={publicId:string;count:number|undefined}[];
export type DiscussionPublicationAttempt={targetId:string;result:Promise<string|null>;handled:boolean};

export function beginDiscussionPublication(targetId:string){
 let complete!:(id:string|null)=>void;
 const result=new Promise<string|null>(resolve=>{complete=resolve;});
 const attempt:DiscussionPublicationAttempt={targetId,result,handled:false};
 window.dispatchEvent(new CustomEvent(discussionPublicationEvent,{detail:attempt}));
 return {complete,handled:attempt.handled};
}
