"use client";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {useConfirmation} from "@sohoin/admin-ui/confirmation";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {useUnsavedChanges} from "../../../_hooks/use-unsaved-changes";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import type {ManagedUser} from "@sohoin/extension-api/users";
import {Card} from "@sohoin/admin-ui/card";
import {Button} from "@sohoin/admin-ui/button";
import {Textarea} from "@sohoin/admin-ui/fields";

export function UserEditor({initial,isSelf}:{initial:ManagedUser;isSelf:boolean}) {
 const {notify}=useToast();
 const confirm=useConfirmation();
  const router=useRouter();const [user,setUser]=useState(initial);
  const [role,setRole]=useState(user.role);const [banned,setBanned]=useState(user.banned);const [reason,setReason]=useState(user.banReason??"");
  const [pending,setPending]=useState(false);const [error,setError]=useState("");const [conflict,setConflict]=useState(false);
  const dirty=role!==user.role||banned!==user.banned||(banned&&reason!==(user.banReason??""));
  useUnsavedChanges(dirty);
  async function save(event:FormEvent){event.preventDefault();if(isSelf||!dirty||pending||conflict)return;
    if(!await confirm("确定修改此用户的权限或状态吗？该用户的现有登录将失效，需要重新登录。"))return;
    setPending(true);setError("");
    try{const response=await fetch("/api/v1/admin/users/"+encodeURIComponent(user.id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:user.version,patch:{role,banned,...(banned?{banReason:reason}:{})}})});
      const data=await response.json();if(!response.ok){setError(data.error?.message??"修改失败，请重试。");if(data.error?.code==="VERSION_CONFLICT")setConflict(true);return;}
      setUser(data);setRole(data.role);setBanned(data.banned);setReason(data.banReason??"");notify({variant:"success",message:"修改已保存，该用户的现有登录已失效。"});router.refresh();
    }catch{setError("网络连接失败，请重试。");}finally{setPending(false);}
  }
  return <Card><h2 className="user-section-title">权限与状态</h2><p className="au-muted user-editor-description">修改后会撤销该用户的现有登录。{isSelf?"当前账号的状态与权限不可在此修改。":"请确认用户身份后再授予管理员权限。"}</p>
    <form onSubmit={save} className="user-editor"><fieldset disabled={pending||isSelf||conflict}>
      <label>账号角色<NativeSelect className="au-input" value={role} onChange={e=>setRole(e.target.value as ManagedUser["role"])}><option value="user">普通用户</option><option value="admin">管理员</option></NativeSelect></label>
      <label>账号状态<NativeSelect className="au-input" value={banned?"banned":"active"} onChange={e=>setBanned(e.target.value==="banned")}><option value="active">启用</option><option value="banned">禁用</option></NativeSelect></label>
      {banned&&<label>禁用原因（选填）<Textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={3}/></label>}
    </fieldset>
    {error&&<Alert variant="error">{error}</Alert>}
    {conflict?<Button variant="outline" type="button" onClick={()=>window.location.reload()}>重新加载最新资料</Button>:<Button type="submit" disabled={pending||isSelf||!dirty}>{pending?"正在保存…":"保存修改"}</Button>}
    </form>
  </Card>;
}
