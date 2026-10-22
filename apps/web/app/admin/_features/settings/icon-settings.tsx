"use client";
import {StatusMessage,Alert} from "@sohoin/ui/feedback";

import {useState} from "react";
import type {SiteSettings} from "@sohoin/extension-api/settings";
import {MAX_MEDIA_BYTES} from "@sohoin/extension-api/media-limits";
import {Button} from "@sohoin/admin-ui/button";
import {Input} from "@sohoin/admin-ui/fields";
import styles from "./icon-settings.module.css";

type Kind=keyof SiteSettings["icons"];
const kinds=[{key:"favicon",title:"浏览器图标",help:"用于浏览器标签页和收藏夹，自动生成 32×32 PNG。",variant:"favicon"},{key:"app",title:"App 图标",help:"用于添加到主屏幕和安装后的应用，自动生成 Apple 180、App 192/512 及安全留白版图标。",variant:"app-512"}] as const;
type Props={value:SiteSettings["icons"];logo:string|null;disabled:boolean;onChange:(value:SiteSettings["icons"])=>void;onBusyChange:(busy:boolean)=>void};

export function IconSettings({value,logo,disabled,onChange,onBusyChange}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 function pending(next:boolean){setBusy(next);onBusyChange(next);}
 async function result(response:Response){const body=await response.json();if(!response.ok)throw new Error(body.error?.message??"图标生成失败，请重试。");return body as {id:string};}
 async function generate(){
  if(disabled||busy||!logo)return;pending(true);setError("");
  try{const asset=await result(await fetch("/api/v1/admin/site-icons/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mediaId:logo})}));onChange({favicon:asset.id,app:asset.id});}
  catch(e){setError(e instanceof Error?e.message:"图标生成失败，请重试。");}finally{pending(false);}
 }
 async function upload(kind:Kind,file:File){
  if(disabled||busy)return;setError("");
  const mime=file.type||(/\.svg$/i.test(file.name)?"image/svg+xml":"");
  if(!["image/svg+xml","image/png","image/jpeg","image/webp"].includes(mime)){setError("请选择 SVG、PNG、JPEG 或 WebP。");return;}
  if(!file.size||file.size>MAX_MEDIA_BYTES||(mime==="image/svg+xml"&&file.size>1024*1024)){setError("图片不超过 10 MiB，SVG 不超过 1 MiB，且不能为空。");return;}
  pending(true);
  try{const asset=await result(await fetch("/api/v1/admin/media?purpose=icon",{method:"POST",headers:{"Content-Type":mime,"X-File-Name":encodeURIComponent(file.name)},body:file}));onChange({...value,[kind]:asset.id});}
  catch(e){setError(e instanceof Error?e.message:"图标上传失败，请重试。");}finally{pending(false);}
 }
 return <div className={styles.root} aria-busy={busy}>
  <p className="au-muted">可分别上传，也可从普通 Logo 一键生成。推荐正方形的简洁图形；生成时保持比例，不裁切主体。App 图标使用白色方形背景并保留安全留白。</p>
  <div><Button variant="outline" disabled={disabled||busy||!logo} onClick={generate}>从普通 Logo 一键生成</Button>{!logo&&<p className="au-muted">先上传或选择普通 Logo，再生成图标。</p>}</div>
  <div className={styles.grid}>{kinds.map(({key,title,help,variant})=><section className={styles.item} key={key} aria-labelledby={"icon-title-"+key}>
   <h3 id={"icon-title-"+key}>{title}</h3><p className="au-muted">{help}</p>
   <div className={styles.preview}>{value[key]?<img key={value[key]} src={`/api/v1/admin/media/${value[key]}/file?variant=${variant}`} width={key==="favicon"?32:96} height={key==="favicon"?32:96} className={key==="favicon"?styles.favicon:styles.app} alt={title+"预览"}/>:<span>尚未设置</span>}</div>
   <label htmlFor={"icon-file-"+key}>上传{title}<Input id={"icon-file-"+key} type="file" accept="image/svg+xml,.svg,image/png,image/jpeg,image/webp" disabled={disabled||busy} onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void upload(key,file);}}/></label>
   <div><Button variant="ghost" size="sm" disabled={disabled||busy||!value[key]} onClick={()=>onChange({...value,[key]:null})}>移除{title}</Button></div>
  </section>)}</div>
  <p className="au-muted">点击“保存设置”后应用。已安装应用的图标刷新时间由浏览器和系统决定。</p>
  {busy&&<StatusMessage variant="loading">正在生成图标，请稍候…</StatusMessage>}{error&&<Alert variant="error">{error}</Alert>}
 </div>;
}
