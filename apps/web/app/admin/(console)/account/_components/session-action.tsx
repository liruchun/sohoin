"use client";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {useConfirmation} from "@sohoin/admin-ui/confirmation";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@sohoin/admin-ui/button";
export function SessionAction({id}:{id?:string}){
 const {notify}=useToast();
 const confirm=useConfirmation();
 const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");
 async function revoke(){
  if(!await confirm(id?"确定退出这处登录吗？":"确定退出其他所有登录吗？当前登录会保留。"))return;
  setPending(true);setError("");
  try{const response=await fetch("/api/v1/account/sessions/revoke",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{scope:"session",id}:{scope:"others"})});const data=await response.json();
   if(!response.ok){setError(data.error?.message??"退出失败，请重试。");return;}
   notify({variant:data.revoked?"success":"info",message:data.revoked?"已退出所选登录。":"没有其他登录需要退出。"});router.refresh();
  }catch{setError("网络连接失败，请重试。");}finally{setPending(false);}
 }
 return <div className="session-action"><Button variant="outline" size={id?"sm":"default"} disabled={pending} onClick={revoke}>{pending?"正在退出…":id?"退出此登录":"退出其他所有登录"}</Button>{error&&<Alert variant="error">{error}</Alert>}</div>;
}
