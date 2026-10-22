"use client";
import {StatusMessage,Alert} from "@sohoin/ui/feedback";

import {useState} from "react";
import type {SiteSettings} from "@sohoin/extension-api/settings";
import type {MediaPage} from "@sohoin/extension-api/media";
import {MAX_MEDIA_BYTES} from "@sohoin/extension-api/media-limits";
import {Button} from "@sohoin/admin-ui/button";
import {Input} from "@sohoin/admin-ui/fields";

type Variant=keyof SiteSettings["logo"];
const variants=[{key:"normal",title:"普通 Logo",help:"用于浅色背景。"},{key:"dark",title:"暗黑模式 Logo",help:"用于深色背景；留空时沿用普通 Logo。"}] as const;
export function LogoSettings({value,onChange,disabled,onBusyChange}:{value:SiteSettings["logo"];onChange:(value:SiteSettings["logo"])=>void;disabled:boolean;onBusyChange:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[uploading,setUploading]=useState<Variant|null>(null),[error,setError]=useState(""),[page,setPage]=useState<MediaPage>(),[target,setTarget]=useState<Variant>("normal");
 function pending(next:boolean){setBusy(next);onBusyChange(next);}
 async function upload(variant:Variant,file:File){
  if(busy||disabled)return;setError("");
  const mime=file.type||(/\.svg$/i.test(file.name)?"image/svg+xml":"");
  if(!["image/png","image/jpeg","image/webp","image/svg+xml"].includes(mime)){setError("请选择 SVG、PNG、JPEG 或 WebP 静态图片。");return;}
  if(!file.size||file.size>MAX_MEDIA_BYTES||(mime==="image/svg+xml"&&file.size>1024*1024)){setError("图片不超过 10 MiB，SVG 不超过 1 MiB，且不能为空。");return;}
  pending(true);setUploading(variant);
  try{const response=await fetch("/api/v1/admin/media?purpose=logo",{method:"POST",headers:{"Content-Type":mime,"X-File-Name":encodeURIComponent(file.name)},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error?.message??"上传失败，请重试。");onChange({...value,[variant]:data.id});setPage(undefined);}catch(e){setError(e instanceof Error?e.message:"上传失败，请重试。");}finally{pending(false);setUploading(null);}
 }
 async function load(before?:string){if(busy||disabled)return;pending(true);setError("");try{const response=await fetch("/api/v1/admin/media?kind=image"+(before?"&before="+encodeURIComponent(before):""));const data=await response.json();if(!response.ok)throw new Error(data.error?.message??"媒体加载失败，请重试。");setPage(data);}catch(e){setError(e instanceof Error?e.message:"媒体加载失败，请重试。");}finally{pending(false);}}
 return <div className="logo-settings" aria-busy={busy}>
  <p className="au-muted" id="logo-upload-help">支持 SVG、PNG、JPEG、WebP；图片不超过 10 MiB，SVG 不超过 1 MiB。SVG 保留矢量并直接展示，仅另生成媒体缩略图；脚本、动画、外部资源及不支持的元素会被拒绝。支持 SVG 内部的深浅配色规则，普通多色 SVG 不会自动反色。点击“保存设置”后公开展示。</p>
  <div className="logo-settings-grid">{variants.map(({key,title,help})=>{const id=value[key]??(key==="dark"?value.normal:null);return <section className="logo-setting" key={key} aria-labelledby={"logo-title-"+key}>
   <h3 id={"logo-title-"+key}>{title}</h3><p className="au-muted">{help}</p>
   <div className={"logo-preview"+(key==="dark"?" logo-preview-dark":"")}>{id?<img key={id} src={`/api/v1/admin/media/${id}/file?variant=logo`} width="200" height="80" alt={title+"预览"}/>:<span>尚未设置</span>}</div>
   <label htmlFor={"logo-file-"+key}>上传{title}<Input id={"logo-file-"+key} type="file" accept="image/svg+xml,.svg,image/png,image/jpeg,image/webp" aria-describedby="logo-upload-help" disabled={disabled||busy} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void upload(key,file);}}/></label>
   <div className="logo-setting-actions"><Button variant="outline" size="sm" disabled={disabled||busy} onClick={()=>{setTarget(key);void load();}}>从媒体库选择</Button><Button variant="ghost" size="sm" disabled={disabled||busy||!value[key]} aria-label={"移除"+title} onClick={()=>onChange({...value,[key]:null})}>移除</Button></div>
  </section>;})}</div>
  {busy&&<StatusMessage variant="loading">{uploading?"正在上传并处理 Logo…":"正在加载媒体…"}</StatusMessage>}{error&&<Alert variant="error">{error}</Alert>}
  {page&&<section className="logo-media-picker" aria-label="Logo 媒体选择"><div className="media-picker-toolbar"><strong>选择{target==="normal"?"普通":"暗黑模式"} Logo</strong><Button variant="ghost" size="sm" disabled={busy} onClick={()=>setPage(undefined)}>收起</Button></div><div className="media-picker-options">{page.items.map(asset=><div className="media-picker-option" key={asset.id}><img src={asset.previewUrl} width="64" height="48" alt="" loading="lazy"/><span>{asset.name}</span><Button variant="outline" size="sm" disabled={disabled||busy} onClick={()=>{onChange({...value,[target]:asset.id});setPage(undefined);}}>选择</Button></div>)}</div>{!page.items.length&&<p className="au-muted">暂无图片，请先上传 Logo。</p>}<nav className="media-picker-toolbar" aria-label="Logo 媒体分页"><Button variant="ghost" size="sm" disabled={disabled||busy} onClick={()=>load()}>返回首批</Button>{page.nextCursor&&<Button variant="outline" size="sm" disabled={disabled||busy} onClick={()=>load(page.nextCursor!)}>下一批</Button>}</nav></section>}
 </div>;
}
