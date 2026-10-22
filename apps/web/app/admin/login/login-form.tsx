"use client";
import {Alert} from "@sohoin/ui/feedback";

import {useState,type FormEvent} from "react";
import {Button} from "@sohoin/admin-ui/button";
import {Input} from "@sohoin/admin-ui/fields";
export function LoginForm(){
 const [pending,setPending]=useState(false);const [error,setError]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setPending(true);setError("");const data=new FormData(event.currentTarget);
 try{const response=await fetch("/api/auth/sign-in/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:data.get("email"),password:data.get("password"),rememberMe:false})});
 if(!response.ok){setError(response.status===429?"尝试次数过多，请稍后再试。":response.status>=500?"登录服务暂时不可用，请稍后再试。":"邮箱或密码不正确，或账号无法登录。");return;}
 window.location.assign("/admin");
 }catch{setError("网络连接失败，请重试。");}finally{setPending(false);}}
 return <form onSubmit={submit} className="console-login-form"><label>管理员邮箱<Input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>密码<Input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label>{error&&<Alert variant="error">{error}</Alert>}<Button disabled={pending} type="submit">{pending?"正在登录…":"登录"}</Button></form>;
}
