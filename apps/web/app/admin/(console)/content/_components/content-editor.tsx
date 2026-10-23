"use client";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {useConfirmation} from "@sohoin/admin-ui/confirmation";
import {Checkbox} from "@sohoin/admin-ui/checkbox";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import type {AdminContent,ContentValue} from "@sohoin/extension-api/content";
import {Card} from "@sohoin/admin-ui/card";
import {Input,Textarea} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {ContentMediaEditor} from "./content-media-editor";
import {TermPicker} from "./term-picker";
import {DeleteRecord} from "../../../_components/shared/delete-record";
import {useUnsavedChanges} from "../../../_hooks/use-unsaved-changes";
type Choice={id:string;name:string;slug:string};
function editable(value:AdminContent):ContentValue{return {media:value.media.map(({mediaId,role,altText,caption})=>({mediaId,role,altText,caption})),data:value.data,type:value.type,title:value.title,excerpt:value.excerpt,body:value.body,categoryId:value.category?.id??null,tagIds:value.tags.map(tag=>tag.id),status:value.status,featured:value.featured,pinLevel:value.pinLevel};}
export function ContentEditor({initial,types,categories,tags,categoriesCursor,tagsCursor}:{initial?:AdminContent;types:{id:string;label:string}[];categories:Choice[];tags:Choice[];categoriesCursor?:string|null;tagsCursor?:string|null}){
 const {notify}=useToast();
 const confirm=useConfirmation();
 const router=useRouter();const [selectedMedia,setSelectedMedia]=useState(initial?.media??[]);const [baseline,setBaseline]=useState(initial);const [value,setValue]=useState<ContentValue>(initial?editable(initial):{type:"article",title:"",excerpt:"",body:"",categoryId:null,tagIds:[],media:[],status:"draft",featured:false,pinLevel:0});const [category,setCategory]=useState<Choice[]>(initial?.category?[initial.category]:[]);const [selectedTags,setSelectedTags]=useState<Choice[]>(initial?.tags??[]);
 const [pending,setPending]=useState(false);const [error,setError]=useState("");const [conflict,setConflict]=useState(false);
 const dirty=baseline?JSON.stringify(value)!==JSON.stringify(editable(baseline)):Boolean(value.media?.length||value.title||value.excerpt||value.body||value.categoryId||value.tagIds.length||value.type!=="article"||value.status!=="draft"||value.featured||value.pinLevel);useUnsavedChanges(dirty&&!pending);
 function change<K extends keyof ContentValue>(key:K,next:ContentValue[K]){setValue(current=>({...current,[key]:next}));}
 async function save(event:FormEvent){event.preventDefault();if(value.status==="published"&&(!value.categoryId||!value.body.trim())){setError("发布前请选择主分类并填写正文。");return;}
  if(value.status!==baseline?.status&&value.status!=="draft"&&!await confirm(value.status==="published"?"确定发布这篇内容吗？发布后可在前台访问。":"确定下架这篇内容吗？下架后前台将无法访问。"))return;
  setPending(true);setError("");try{const response=await fetch("/api/v1/admin/content"+(baseline?"/"+baseline.id:""),{method:baseline?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(baseline?{version:baseline.version,value}:value)});const data=await response.json();if(!response.ok){setError(data.error?.message??"保存失败，请重试。");if(response.status===409)setConflict(true);return;}setBaseline(data);setSelectedMedia(data.media);setValue(editable(data));setCategory(data.category?[data.category]:[]);setSelectedTags(data.tags);notify({variant:"success",message:"内容已保存。"});if(!baseline)router.replace("/admin/content/"+data.id,{transitionTypes:["page-switch"]});router.refresh();}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}
 }
 return <form className="content-editor" onSubmit={save}><div className="content-editor-main"><Card><fieldset className="content-fields" disabled={pending||conflict}><label>{value.type==="post"?"标题（选填）":"标题"}<Input required={value.type!=="post"} maxLength={160} value={value.title} onChange={e=>change("title",e.target.value)}/></label><label>摘要<Textarea rows={3} maxLength={500} value={value.excerpt} onChange={e=>change("excerpt",e.target.value)}/></label><label>正文<Textarea className="content-body-input" required={value.type==="post"||value.status==="published"} rows={12} maxLength={50000} value={value.body} onChange={e=>change("body",e.target.value)} aria-describedby="content-format-note"/></label><p id="content-format-note" className="au-muted">当前正文为纯文本，按换行展示，不执行 HTML 或脚本。最多 50,000 个字符。</p></fieldset></Card><Card><ContentMediaEditor selected={selectedMedia} disabled={pending||conflict} onChange={items=>{setSelectedMedia(items);change("media",items.map(({mediaId,role,altText,caption})=>({mediaId,role,altText,caption})));}}/></Card></div>
  <div className="content-editor-side"><Card><fieldset className="content-fields" disabled={pending||conflict}><label>内容类型<NativeSelect className="au-input" value={value.type} onChange={async e=>{const nextType=e.target.value;if(Object.keys(value.data??{}).length&&!await confirm("切换类型将清空原类型的扩展字段，保存后生效。确定切换吗？"))return;setValue(current=>({...current,type:nextType,data:{}}));}}>{!types.some(type=>type.id===value.type)&&<option value={value.type}>已停用：{value.type}</option>}{types.map(type=><option key={type.id} value={type.id}>{type.label}</option>)}</NativeSelect></label><label>状态<NativeSelect className="au-input" value={value.status} onChange={e=>change("status",e.target.value as ContentValue["status"])}><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已下架</option></NativeSelect></label>
    <label className="editorial-check"><Checkbox checked={value.featured??false} onCheckedChange={checked=>change("featured",checked===true)}/>精选内容</label><label>置顶级别<NativeSelect value={value.pinLevel??0} onChange={e=>change("pinLevel",Number(e.target.value))}><option value={0}>不置顶</option><option value={1}>一级置顶</option><option value={2}>二级置顶</option><option value={3}>三级置顶（最高）</option></NativeSelect></label><p className="au-muted">精选与置顶独立。按置顶优先排序时，级别越高越靠前。</p>
    <TermPicker kind="categories" choices={categories} nextCursor={categoriesCursor} selected={category} onChange={items=>{setCategory(items);change("categoryId",items[0]?.id??null);}}/><TermPicker kind="tags" choices={tags} nextCursor={tagsCursor} selected={selectedTags} onChange={items=>{setSelectedTags(items);change("tagIds",items.map(item=>item.id));}}/>
   </fieldset></Card><Card className="content-save-actions">{error&&<Alert variant="error">{error}</Alert>}{conflict?<Button type="button" variant="outline" onClick={()=>window.location.reload()}>重新加载最新内容</Button>:<Button type="submit" disabled={pending||!dirty}>{pending?"正在保存…":"保存内容"}</Button>}
   {baseline?<Link href={"/admin/content/"+baseline.id+"/preview"} target="_blank" rel="noopener noreferrer" prefetch={false}>预览已保存版本</Link>:<p className="au-muted">保存草稿后可预览。</p>}
   {baseline?.status==="published"&&<Link href={"/content/"+baseline.id} target="_blank" rel="noopener noreferrer">查看前台内容</Link>}
   {baseline&&baseline.status!=="published"&&!dirty&&<DeleteRecord url={"/api/v1/admin/content/"+baseline.id} version={baseline.version} label={baseline.title||"这篇帖子"} returnTo="/admin/content"/>}
  </Card></div>
 </form>;
}
