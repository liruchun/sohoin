"use client";
import {Alert} from "@sohoin/ui/feedback";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@sohoin/admin-ui/button";
export function NotificationReadAction({id,through}:{id?:string;through?:string}){const router=useRouter(),[pending,setPending]=useState(false),[error,setError]=useState("");async function mark(){setPending(true);setError("");try{const response=await fetch("/api/v1/account/notifications/read",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{ids:[id]}:{through})});const value=await response.json();if(!response.ok){setError(value.error?.message??"操作失败");return;}router.refresh();}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}}return <div className="notification-read"><Button variant="outline" size="sm" disabled={pending} onClick={mark}>{pending?"正在处理…":id?"标为已读":"全部标为已读"}</Button>{error&&<Alert variant="error">{error}</Alert>}</div>;}
