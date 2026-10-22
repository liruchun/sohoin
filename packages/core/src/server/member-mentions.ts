import 'server-only';
import {searchMentionMembers,readMentionMembers} from '@sohoin/database';
import {mentionName,mentionPattern} from '@sohoin/extension-api/mentions';
import {requireAuthenticatedUser,enforceLimit,ServiceError} from './security';
import {publicRoutes} from './public-routes';
import {avatarUrl} from './avatar-url';

export async function searchMemberMentions(headers:Headers,input:string,recent:string=""){
 const actor=await requireAuthenticatedUser(headers);
 await enforceLimit('mention-search',actor.id,120,60);
 const query=input.trim();
 if(query.length>80||/[\u0000-\u001f]/.test(query))throw new ServiceError(400,'INVALID_QUERY','搜索内容过长或含有无效字符');
 if(!query){
  if(!recent)return {items:[]};
  if(recent.length>219)throw new ServiceError(400,'INVALID_QUERY','最近访问用户参数无效');
  const ids=[...new Set(recent.split(','))];
  if(ids.length>20||ids.some(id=>!/^(?=[a-z0-9]*[a-z])[a-z0-9]{10}$/.test(id)))throw new ServiceError(400,'INVALID_QUERY','最近访问用户参数无效');
  const rows=await readMentionMembers(ids),members=new Map(rows.map(row=>[row.id,row]));
  return {items:ids.flatMap(id=>{const row=members.get(id);return row?[{id:row.id,name:mentionName(row.name),avatar:avatarUrl(row.image)}]:[];}).slice(0,8)};
 }
 const rows=await searchMentionMembers(query);
 const routes=await publicRoutes([],rows.map(row=>row.id));
 return {items:rows.map(row=>({id:routes.get('user:'+row.id)!,name:mentionName(row.name),avatar:avatarUrl(row.image)}))};
}

/** Names from the client never establish another member's identity. */
export async function normalizeMemberMentions(body:string){
 const ids=[...new Set(Array.from(body.matchAll(mentionPattern()),match=>match[1]))];
 if(ids.length>20)throw new ServiceError(400,'MENTION_LIMIT','每次最多提及 20 位用户');
 if(!ids.length)return body;
 const members=await readMentionMembers(ids),names=new Map(members.map(member=>[member.id,mentionName(member.name)]));
 if(names.size!==ids.length)throw new ServiceError(400,'MENTION_UNAVAILABLE','提及的用户已不可用，请删除后重试');
 const normalized=body.replace(mentionPattern(),(_,id:string)=>`<@${id}|${names.get(id)!}>`);
 if(normalized.length>5000)throw new ServiceError(400,'INVALID_PUBLICATION','正文最多 5000 字，请缩短后重试');
 return normalized;
}
