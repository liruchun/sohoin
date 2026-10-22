"use client";

import {useEffect} from 'react';

const key='sohoin:recent-mention-members';
const publicId=/^(?=[a-z0-9]*[a-z])[a-z0-9]{10}$/;
type Visit={id:string;at:number};
function read():Visit[]{
 try{
  const data:unknown=JSON.parse(localStorage.getItem(key)??'[]');
  if(!Array.isArray(data))return [];
  const cutoff=Date.now()-30*24*60*60*1000;
  return data.filter((item):item is Visit=>!!item&&typeof item.id==='string'&&publicId.test(item.id)&&typeof item.at==='number'&&item.at>cutoff&&item.at<=Date.now()).slice(0,20);
 }catch{return [];}
}
export function recentMentionIds(){return read().map(item=>item.id);}
/** Shared by visits and confirmed interactions; only public member IDs are stored. */
export function rememberMentionMember(id?:string){
 if(!id||!publicId.test(id))return;
 try{localStorage.setItem(key,JSON.stringify([{id,at:Date.now()},...read().filter(item=>item.id!==id)].slice(0,20)));}catch{}
}
/** Record actual detail visits, never feed impressions or route prefetches. */
export function RecentMentionVisit({id}:{id?:string}){
 useEffect(()=>{rememberMentionMember(id);},[id]);
 return null;
}
