"use client";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import type {Term,TermKind} from "@sohoin/extension-api/content";
import type {MediaPage} from "@sohoin/extension-api/media";
import {Button} from "@sohoin/admin-ui/button";
import {Input,Textarea} from "@sohoin/admin-ui/fields";
import {useUnsavedChanges} from "../../../_hooks/use-unsaved-changes";
export function TermForm({kind,initial}:{kind:TermKind;initial?:Term}){
 const {notify}=useToast();
 const router=useRouter();const [name,setName]=useState(initial?.name??"");const [slug,setSlug]=useState(initial?.slug??"");const [description,setDescription]=useState(initial?.description??"");const [iconMediaId,setIconMediaId]=useState<string|null>(initial?.iconMediaId??null);const [picker,setPicker]=useState<MediaPage>();const [mediaPending,setMediaPending]=useState(false);const [mediaError,setMediaError]=useState("");const [pending,setPending]=useState(false);const [error,setError]=useState("");const [conflict,setConflict]=useState(false);
 const dirty=name!==(initial?.name??"")||slug!==(initial?.slug??"")||description!==(initial?.description??"")||(kind==="categories"&&iconMediaId!==(initial?.iconMediaId??null));useUnsavedChanges(dirty&&!pending);
 async function loadMedia(before?:string){
  if(mediaPending)return;setMediaPending(true);setMediaError("");
  try{const response=await fetch("/api/v1/admin/media"+(before?"?before="+encodeURIComponent(before):""));const data=await response.json();if(!response.ok){setMediaError(data.error?.message??"媒体加载失败，请重试。");return;}setPicker(data);}
  catch{setMediaError("媒体加载失败，请重试。");}
  finally{setMediaPending(false);}
 }
 async function save(event:FormEvent){event.preventDefault();setPending(true);setError("");try{const value={name,slug,description,...(kind==="categories"?{iconMediaId}:{})};const response=await fetch("/api/v1/admin/taxonomies/"+kind+(initial?"/"+initial.id:""),{method:initial?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(initial?{version:initial.version,value}:value)});const data=await response.json();if(!response.ok){setError(data.error?.message??"保存失败");setConflict(Boolean(initial&&response.status===409));return;}if(!initial){setName("");setSlug("");setDescription("");setIconMediaId(null);setPicker(undefined);}notify({variant:"success",message:"已保存。"});router.refresh();}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}}
 return <form className="content-form" onSubmit={save}><fieldset disabled={pending||conflict}><label>名称<Input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><label>标识<Input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={slug} onChange={e=>setSlug(e.target.value)} aria-describedby="term-slug-help"/></label><p id="term-slug-help" className="au-muted">使用小写字母、数字和连字符，同类中须唯一。名称可以使用中文。</p><label>说明<Textarea maxLength={300} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  {kind==="categories"&&<div className="taxonomy-icon-field"><span>分类图标</span><div className="taxonomy-icon-preview">{iconMediaId?<img src={`/api/v1/admin/media/${iconMediaId}/file?variant=thumbnail`} width="64" height="64" alt="分类图标预览"/>:<span>未设置</span>}</div><div className="taxonomy-icon-actions"><Button type="button" variant="outline" size="sm" disabled={mediaPending} onClick={()=>picker?setPicker(undefined):void loadMedia()}>{picker?"收起媒体库":"从媒体库选择"}</Button>{iconMediaId&&<Button type="button" variant="ghost" size="sm" onClick={()=>setIconMediaId(null)}>移除图标</Button>}<Link href="/admin/media" target="_blank" rel="noopener noreferrer">上传图片</Link></div>{mediaError&&<Alert variant="error">{mediaError}</Alert>}{mediaPending&&<p className="au-muted">正在加载媒体…</p>}{picker&&<section className="media-picker" aria-label="分类图标媒体选择"><div className="media-picker-options">{picker.items.filter(asset=>asset.mimeType==="image/webp").map(asset=><div className="media-picker-option" key={asset.id}><img src={asset.previewUrl} width="64" height="48" alt="" loading="lazy" decoding="async"/><span>{asset.name}</span><Button type="button" variant="outline" size="sm" disabled={mediaPending} onClick={()=>{setIconMediaId(asset.id);setPicker(undefined);}}>{asset.id===iconMediaId?"已选择":"选择"}</Button></div>)}</div>{!picker.items.some(asset=>asset.mimeType==="image/webp")&&<p className="au-muted">媒体库暂无 WebP 图片，请先上传。</p>}<nav className="media-picker-toolbar" aria-label="分类图标媒体分页"><Button type="button" variant="ghost" size="sm" disabled={mediaPending} onClick={()=>loadMedia()}>返回首批</Button>{picker.nextCursor&&<Button type="button" variant="outline" size="sm" disabled={mediaPending} onClick={()=>loadMedia(picker.nextCursor!)}>下一批</Button>}</nav></section>}</div>}
  </fieldset>
  {error&&<Alert variant="error">{error}</Alert>}{conflict?<Button type="button" variant="outline" onClick={()=>window.location.reload()}>重新加载最新资料</Button>:<Button type="submit" disabled={pending||!dirty}>{pending?"正在保存…":initial?"保存修改":"新增"}</Button>}
 </form>;
}
