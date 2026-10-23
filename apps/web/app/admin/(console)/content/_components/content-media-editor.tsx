"use client";
import {StatusMessage,Alert} from "@sohoin/ui/feedback";

import {Disclosure} from "@sohoin/admin-ui/disclosure";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {useState} from "react";
import type {AdminContentMedia} from "@sohoin/extension-api/content";
import type {MediaAsset,MediaPage} from "@sohoin/extension-api/media";
import {Button} from "@sohoin/admin-ui/button";
import {Input,Textarea} from "@sohoin/admin-ui/fields";
type Role=AdminContentMedia["role"];
const roles:{id:Role;name:string;max:number}[]=[{id:"cover",name:"封面",max:1},{id:"gallery",name:"图库",max:10},{id:"attachment",name:"附件",max:10}];
export function ContentMediaEditor({selected,onChange,disabled}:{selected:AdminContentMedia[];onChange:(items:AdminContentMedia[])=>void;disabled:boolean}){
 const [role,setRole]=useState<Role>("cover");const [page,setPage]=useState<MediaPage>();const [pending,setPending]=useState(false);const [error,setError]=useState("");
 async function load(before?:string){if(pending)return;setPending(true);setError("");try{const response=await fetch("/api/v1/admin/media?kind=image"+(before?"&before="+before:""));const data=await response.json();if(!response.ok){setError(data.error?.message??"媒体加载失败，请重试。");return;}setPage(data);}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}}
 function add(asset:MediaAsset){const item={mediaId:asset.id,role,altText:"",caption:"",name:asset.name,mimeType:asset.mimeType,width:asset.width,height:asset.height};onChange(role==="cover"?[...selected.filter(i=>i.role!=="cover"),item]:[...selected,item]);}
 function update(item:AdminContentMedia,patch:Partial<Pick<AdminContentMedia,"altText"|"caption">>){onChange(selected.map(i=>i.mediaId===item.mediaId&&i.role===item.role?{...i,...patch}:i));}
 function move(item:AdminContentMedia,direction:number){const group=selected.filter(i=>i.role===item.role);const index=group.findIndex(i=>i.mediaId===item.mediaId);[group[index],group[index+direction]]=[group[index+direction],group[index]];onChange([...selected.filter(i=>i.role!==item.role),...group]);}
 const group=roles.find(r=>r.id===role)!;
 return <fieldset className="content-media-editor" disabled={disabled}><legend>关联媒体</legend><p className="au-muted">封面 1 张，图库和附件各最多 10 项。选择图片作为封面、图库或附件，关联与内容一起保存。</p>
 <Disclosure label="从媒体库选择" className="media-picker" onOpenChange={open=>{if(open&&!page&&!pending)void load();}}><div className="media-picker-toolbar"><label>选择用途<NativeSelect className="au-input" value={role} onChange={e=>setRole(e.target.value as Role)}>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</NativeSelect></label><Link href="/admin/media" target="_blank" rel="noopener noreferrer">上传新图片</Link><Button size="sm" variant="outline" disabled={pending} onClick={()=>load()}>刷新媒体库</Button></div>
 {error&&<Alert variant="error">{error}</Alert>}{pending&&<StatusMessage variant="loading">正在加载媒体…</StatusMessage>}
 {page&&!pending&&!page.items.length&&<p className="au-muted">这一页没有图片，可前往媒体库上传。</p>}
 <div className="media-picker-options">{page?.items.map(asset=>{const chosen=selected.some(i=>i.mediaId===asset.id&&i.role===role);const full=role!=="cover"&&selected.filter(i=>i.role===role).length>=group.max;return <div className="media-picker-option" key={asset.id}><img src={asset.previewUrl} width="64" height="48" loading="lazy" decoding="async" alt=""/><span>{asset.name}<small className="au-muted">{asset.width} × {asset.height} · #{asset.id}</small></span><Button size="sm" variant="outline" disabled={pending||chosen||full} onClick={()=>add(asset)}>{chosen?"已选择":role==="cover"?"设为封面":"添加"}</Button></div>;})}</div>
 {page&&<nav className="media-picker-toolbar" aria-label="选择媒体分页"><Button size="sm" variant="ghost" disabled={pending} onClick={()=>load()}>返回首批</Button>{page.nextCursor&&<Button size="sm" variant="outline" disabled={pending} onClick={()=>load(page.nextCursor!)}>下一批</Button>}</nav>}
 </Disclosure>
 {roles.map(group=>{const items=selected.filter(i=>i.role===group.id);return <section className="content-media-group" key={group.id}><h3>{group.name}（{items.length}/{group.max}）</h3>{!items.length?<p className="au-muted">尚未选择{group.name}</p>:items.map((item,index)=><div className="content-media-item" key={item.mediaId}><div className="content-media-item-heading"><img src={`/api/v1/admin/media/${item.mediaId}/file?variant=thumbnail`} width="80" height="60" loading="lazy" decoding="async" alt=""/><Link href={"/admin/media/"+item.mediaId} target="_blank" rel="noopener noreferrer">{item.name}</Link></div><div className="content-media-item-fields"><label>替代文本<Input maxLength={500} value={item.altText} onChange={e=>update(item,{altText:e.target.value})} placeholder="描述图片内容，供无障碍阅读使用"/></label><label>说明<Textarea rows={2} maxLength={1000} value={item.caption} onChange={e=>update(item,{caption:e.target.value})}/></label></div><div className="content-media-item-actions">{group.id!=="cover"&&<><Button size="sm" variant="outline" disabled={index===0} aria-label={"上移"+group.name+"："+item.name} onClick={()=>move(item,-1)}>上移</Button><Button size="sm" variant="outline" disabled={index===items.length-1} aria-label={"下移"+group.name+"："+item.name} onClick={()=>move(item,1)}>下移</Button></>}<Button size="sm" variant="ghost" aria-label={"移除"+group.name+"："+item.name} onClick={()=>onChange(selected.filter(i=>i.mediaId!==item.mediaId||i.role!==item.role))}>移除关联</Button></div></div>)}</section>;})}
 </fieldset>;
}
