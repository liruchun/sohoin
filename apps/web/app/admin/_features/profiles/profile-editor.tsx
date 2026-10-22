"use client";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {Input,Textarea} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {useUnsavedChanges} from "../../_hooks/use-unsaved-changes";
export function ProfileEditor({initial,url}:{initial:{bio:string;homepage:string;version:number};url:string}){
 const {notify}=useToast();
 const router=useRouter(),[baseline,setBaseline]=useState(initial),[bio,setBio]=useState(initial.bio),[homepage,setHomepage]=useState(initial.homepage),[pending,setPending]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false);
 const dirty=bio!==baseline.bio||homepage!==baseline.homepage;useUnsavedChanges(dirty&&!pending);
 async function save(event:FormEvent){event.preventDefault();setPending(true);setError("");try{const response=await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:baseline.version,bio,homepage})});const result=await response.json();if(!response.ok){setError(result.error?.message??"资料保存失败");setConflict(response.status===409);return;}setBaseline(result);setBio(result.bio);setHomepage(result.homepage);notify({variant:"success",message:"资料已保存。"});router.refresh();}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}}
 return <form className="profile-editor" onSubmit={save}><fieldset className="content-fields" disabled={pending||conflict}><label>个人介绍<Textarea rows={4} maxLength={500} value={bio} onChange={e=>{setBio(e.target.value);}}/></label><label>个人主页<Input type="url" maxLength={500} placeholder="https://" value={homepage} onChange={e=>{setHomepage(e.target.value);}}/></label><p className="au-muted">介绍和主页是公开资料。主页仅支持 HTTPS 地址；扩展资料保持原值。</p></fieldset>{error&&<Alert variant="error">{error}</Alert>}{conflict?<Button variant="outline" onClick={()=>window.location.reload()}>重新加载最新资料</Button>:<Button type="submit" disabled={pending||!dirty}>{pending?"正在保存…":"保存资料"}</Button>}</form>;
}
