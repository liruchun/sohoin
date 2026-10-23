"use client";
import {useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import type {BadgeDefinition} from "@sohoin/extension-api/badges";
import type {MediaPage} from "@sohoin/extension-api/media";
import {MAX_MEDIA_BYTES} from "@sohoin/extension-api/media-limits";
import {Button} from "@sohoin/admin-ui/button";
import {Input,Textarea} from "@sohoin/admin-ui/fields";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";
import {useUnsavedChanges} from "../../_hooks/use-unsaved-changes";
import styles from "./badges.module.css";

export function BadgeEditor({initial}:{initial?:BadgeDefinition}){
  const router=useRouter(),{notify}=useToast();
  const [name,setName]=useState(initial?.name??""),[description,setDescription]=useState(initial?.description??"");
  const [enabled,setEnabled]=useState(initial?.enabled??true),[iconMediaId,setIcon]=useState(initial?.iconMediaId??null);
  const [reason,setReason]=useState(""),[pending,setPending]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[conflict,setConflict]=useState(false),[saved,setSaved]=useState(false),[media,setMedia]=useState<MediaPage>();
  const [existingKey,setExistingKey]=useState("");
  const requestId=useRef("");
  const dirty=name!==(initial?.name??"")||description!==(initial?.description??"")||enabled!==(initial?.enabled??true)||iconMediaId!==(initial?.iconMediaId??null)||!!reason;
  useUnsavedChanges(dirty&&!pending&&!saved);
  async function load(before?:string){
    setBusy(true);setError("");
    try{const response=await fetch("/api/v1/admin/media?kind=image"+(before?"&before="+encodeURIComponent(before):""));const data=await response.json();if(!response.ok)throw new Error(data.error?.message??"媒体加载失败");setMedia(data);}
    catch(e){setError(e instanceof Error?e.message:"媒体加载失败");}finally{setBusy(false);}
  }
  async function upload(file:File){
    if(!["image/png","image/jpeg","image/webp","image/svg+xml"].includes(file.type)||file.size===0||file.size>MAX_MEDIA_BYTES){setError("请选择不超过 10 MiB 的 PNG、JPEG、WebP 或静态 SVG 图片。");return;}
    setBusy(true);setError("");
    try{const response=await fetch("/api/v1/admin/media?purpose=badge",{method:"POST",headers:{"Content-Type":file.type,"X-File-Name":encodeURIComponent(file.name)},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error?.message??"上传失败");setIcon(data.id);setMedia(undefined);}
    catch(e){setError(e instanceof Error?e.message:"上传失败");}finally{setBusy(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();if(pending||busy)return;setPending(true);setError("");
    requestId.current||=crypto.randomUUID();
    try{
      const response=await fetch("/api/v1/admin/badges"+(initial?"/"+initial.key:""),{method:initial?"PATCH":"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name,description,enabled,iconMediaId,reason,...(initial?{revision:initial.revision}:{requestId:requestId.current})})});
      const data=await response.json();
      if(!response.ok){setConflict(data.error?.code==="BADGE_REVISION_CONFLICT");if(!initial&&data.error?.code==="BADGE_ALREADY_EXISTS")setExistingKey("badge-"+requestId.current.replaceAll("-",""));throw new Error(data.error?.message??"保存失败");}
      setSaved(true);notify({variant:"success",message:"勋章已保存。"});
      if(!initial)router.replace("/admin/badges/"+data.key,{transitionTypes:["page-switch"]});else router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"网络连接失败，请重试。");}finally{setPending(false);}
  }
  return <form className={styles.form} onSubmit={save}>
    <fieldset disabled={pending||busy||conflict||saved}>
      <label>名称<Input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>说明<Textarea rows={3} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <div className={styles.picker}><strong>勋章图标</strong>
        <div className={styles.preview}>{iconMediaId?<img src={`/api/v1/admin/media/${iconMediaId}/file?variant=thumbnail`} width={80} height={80} alt="勋章图标预览"/>:<span className={styles.muted}>未设置图标</span>}
          <div className={styles.actions}><Button variant="outline" onClick={()=>void load()}>从媒体库选择</Button>{iconMediaId&&<Button variant="ghost" onClick={()=>setIcon(null)}>移除图标</Button>}</div></div>
        <label>上传图标<Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void upload(file);}}/></label>
        <p className={styles.muted}>建议使用方形透明底图片；上传后统一转为 WebP，保存勋章后生效。</p>
        {media&&<section className={styles.picker} aria-label="图标媒体库">{media.items.filter(item=>(item.mimeType==="image/webp"||item.mimeType==="image/svg+xml")).map(item=><div key={item.id} className={styles.option}>
          <img className={styles.icon} src={item.previewUrl} width={48} height={48} alt="" loading="lazy"/><span>{item.name}</span>
          <Button size="sm" variant="outline" onClick={()=>{setIcon(item.id);setMedia(undefined);}}>选择</Button></div>)}
          {!media.items.some(item=>(item.mimeType==="image/webp"||item.mimeType==="image/svg+xml"))&&<p>本批没有可用图片，可上传图片或查看下一批。</p>}
          <div className={styles.actions}><Button variant="ghost" onClick={()=>void load()}>返回首批</Button>{media.nextCursor&&<Button variant="outline" onClick={()=>void load(media.nextCursor!)}>下一批</Button>}<Button variant="ghost" onClick={()=>setMedia(undefined)}>收起</Button></div>
        </section>}
      </div>
      <label>状态<NativeSelect value={String(enabled)} onChange={e=>setEnabled(e.target.value==="true")}><option value="true">启用</option><option value="false">停用</option></NativeSelect></label>
      <p className={styles.muted}>停用后不再新授予，已获得的勋章继续保留。</p>
      <label>{initial?"修改原因":"创建原因"}<Textarea required maxLength={500} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </fieldset>
    {busy&&<p role="status">正在处理图片…</p>}{error&&<Alert variant="error">{error}</Alert>}
    {existingKey&&<Link href={"/admin/badges/"+existingKey}>查看该请求已创建的勋章</Link>}
    {conflict?<Button variant="outline" onClick={()=>window.location.reload()}>重新加载最新资料</Button>:<Button type="submit" disabled={pending||busy||saved||!dirty}>{pending?"正在保存…":"保存勋章"}</Button>}
  </form>;
}
