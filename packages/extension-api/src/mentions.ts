export type MentionMember={id:string;name:string;avatar?:string|null;label:string};
export const mentionPattern=()=>/<@((?=[a-z0-9]*[a-z])[a-z0-9]{10})\|([^<>\r\n]+)>/g;
export function plainMentionText(body:string){return body.replace(/<@[^|>]+\|([^>]+)>/g,'@$1');}
export function mentionName(name:string){return name.replace(/[<>|@\r\n]/g,'').trim().slice(0,80)||'用户';}

/** Labels stay unambiguous even when two selected members share a display name. */
export function mentionLabel(name:string,id:string,known:MentionMember[]){
 const clean=mentionName(name);
 return known.some(member=>member.id!==id&&member.label===clean)?`${clean}·${id}`:clean;
}
export function decodeMentionDraft(body:string){
 const members:MentionMember[]=[];
 const text=body.replace(mentionPattern(),(_,id:string,name:string)=>{
  let member=members.find(item=>item.id===id);
  if(!member){member={id,name,label:mentionLabel(name,id,members)};members.push(member);}
  return '@'+member.label;
 });
 return {text,members};
}
export function encodeMentionDraft(text:string,members:MentionMember[]){
 if(!members.length)return text;
 const sorted=[...members].sort((a,b)=>b.label.length-a.label.length);
 const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(`@(${sorted.map(item=>escape(item.label)).join('|')})(?=$|\\s|[，。！？、,!?;；:：])`,'g');
 return text.replace(pattern,(_,label:string)=>{
  const member=sorted.find(item=>item.label===label)!;
  return `<@${member.id}|${mentionName(member.name)}>`;
 });
}
