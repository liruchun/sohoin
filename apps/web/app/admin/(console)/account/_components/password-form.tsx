"use client";
import {Alert,FieldError} from "@sohoin/ui/feedback";

import {useState,type FormEvent} from "react";
import {Input} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {useUnsavedChanges} from "../../../_hooks/use-unsaved-changes";
export function PasswordForm(){
 const [pending,setPending]=useState(false);const [error,setError]=useState("");const [dirty,setDirty]=useState(false);
 const [fieldError,setFieldError]=useState<{field:"newPassword"|"confirmation";message:string}|null>(null);
 useUnsavedChanges(dirty&&!pending);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;const fields=new FormData(form);
  const currentPassword=String(fields.get("currentPassword"));const newPassword=String(fields.get("newPassword"));
  setError("");setFieldError(null);
  if(newPassword!==fields.get("confirmation")){setFieldError({field:"confirmation",message:"两次输入的新密码不一致。"});return;}
  if(newPassword===currentPassword){setFieldError({field:"newPassword",message:"新密码不能与旧密码相同。"});return;}
  setPending(true);setError("");
  try{const response=await fetch("/api/v1/account/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});const data=await response.json();
   if(!response.ok){setError(data.error?.message??"修改失败，请重试。");setPending(false);return;}
   form.reset();window.location.replace("/admin/login?reason=password-changed");
  }catch{setError("网络连接失败，请重试。");setPending(false);}
 }
 return <form className="account-password-form" onSubmit={submit} onInput={()=>{setDirty(true);setFieldError(null);}}>
  <fieldset disabled={pending}><label>当前密码<Input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128}/></label>
   <label>新密码<Input type="password" name="newPassword" autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={fieldError?.field==="newPassword"} aria-describedby={fieldError?.field==="newPassword"?"password-requirements new-password-error":"password-requirements"}/></label>
   {fieldError?.field==="newPassword"&&<FieldError id="new-password-error">{fieldError.message}</FieldError>}
   <label>确认新密码<Input type="password" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={fieldError?.field==="confirmation"} aria-describedby={fieldError?.field==="confirmation"?"confirmation-error":undefined}/></label>
   {fieldError?.field==="confirmation"&&<FieldError id="confirmation-error">{fieldError.message}</FieldError>}
  </fieldset><p id="password-requirements" className="au-muted">12–128 个字符。修改后全部登录失效，请使用新密码重新登录。</p>
  {error&&<Alert variant="error">{error}</Alert>}<Button type="submit" disabled={pending}>{pending?"正在修改…":"修改密码并退出登录"}</Button>
 </form>;
}
