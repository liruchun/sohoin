"use client";
import {Alert} from "@sohoin/ui/feedback";

import {useState} from "react";
import {X} from "lucide-react";
import {Input} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {Checkbox} from "@sohoin/admin-ui/checkbox";
import {Disclosure} from "@sohoin/admin-ui/disclosure";
import {RadioGroup,RadioGroupItem} from "@sohoin/admin-ui/radio-group";
type Choice={id:string;name:string;slug:string};
export function TermPicker({kind,choices,nextCursor,selected,onChange,disabled,single=false,lazy=false}:{kind:"categories"|"tags";choices:Choice[];nextCursor?:string|null;selected:Choice[];onChange:(values:Choice[])=>void;disabled?:boolean;single?:boolean;lazy?:boolean}){
 const [q,setQ]=useState("");const [results,setResults]=useState(choices);const [cursor,setCursor]=useState<string|null>(nextCursor??null);const [pending,setPending]=useState(false);const [error,setError]=useState("");const [loaded,setLoaded]=useState(!lazy);
 async function search(before?:string){setPending(true);setError("");try{const params=new URLSearchParams({q,...(before?{before}:{})});const response=await fetch("/api/v1/admin/taxonomies/"+kind+"?"+params);const data=await response.json();if(!response.ok){setError(data.error?.message??"查询失败");return;}setResults(data.items);setCursor(data.nextCursor);setLoaded(true);}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}}
 const multiple=kind==="tags"&&!single;const title=kind==="tags"?"标签":"主分类";
 function choose(item:Choice){onChange(multiple?(selected.some(value=>value.id===item.id)?selected.filter(value=>value.id!==item.id):[...selected,item]):[item]);}
 return <fieldset className="term-picker" disabled={disabled||pending}><legend>{title}{multiple?"（最多 10 个）":""}</legend>
  <div className="term-selected">{selected.length?selected.map(item=><Button key={item.id} size="sm" variant="outline" aria-label={"移除"+title+"："+item.name} onClick={()=>onChange(selected.filter(value=>value.id!==item.id))}>{item.name}<X aria-hidden="true"/></Button>):<span className="au-muted">暂未选择{title}</span>}</div>
  <Disclosure label={"选择"+title} onOpenChange={open=>{if(open&&lazy&&!loaded&&!pending)void search();}}><div className="term-search"><Input aria-label={"搜索"+title} value={q} onChange={e=>{setQ(e.target.value);setCursor(null);}} onKeyDown={event=>{if(event.key==="Enter"&&!event.nativeEvent.isComposing){event.preventDefault();if(!pending)void search();}}} placeholder="输入名称前缀" maxLength={100}/><Button variant="outline" onClick={()=>search()}>搜索</Button></div>
   <div className="term-options">{multiple?results.map(item=>{const checked=selected.some(value=>value.id===item.id);return <label key={item.id}><Checkbox checked={checked} disabled={disabled||pending||(!checked&&selected.length>=10)} onCheckedChange={()=>choose(item)}/><span>{item.name}</span></label>;}):<RadioGroup aria-label={title} value={selected[0]?.id??""} disabled={disabled||pending} onValueChange={id=>{const item=results.find(item=>item.id===id);if(item)choose(item);}}>{results.map(item=><label key={item.id}><RadioGroupItem value={item.id}/><span>{item.name}</span></label>)}</RadioGroup>}</div>
   {pending&&<p role="status" className="au-muted">正在加载…</p>}{loaded&&!pending&&!results.length&&<p className="au-muted">没有匹配的{title}，可先到对应管理页新增。</p>}
   {cursor&&<Button size="sm" variant="ghost" onClick={()=>search(cursor)}>下一页</Button>}
  </Disclosure>{error&&<Alert variant="error">{error}</Alert>}
 </fieldset>;
}
