"use client";
import {Alert} from "@sohoin/ui/feedback";

import {useConfirmation} from "@sohoin/admin-ui/confirmation";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@sohoin/admin-ui/button";
export function DeleteRecord({url,version,label,returnTo}:{url:string;version:number;label:string;returnTo?:string}){
 const confirm=useConfirmation();
 const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");
 async function remove(){if(!await confirm("确定永久删除“"+label+"”吗？此操作不可恢复。"))return;setPending(true);setError("");try{const response=await fetch(url,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({version})});const data=await response.json();if(!response.ok){setError(data.error?.message??"删除失败，请重试。");return;}if(returnTo)router.replace(returnTo);router.refresh();}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}}
 return <div className="delete-record"><Button size="sm" variant="outline" disabled={pending} onClick={remove}>{pending?"正在删除…":"删除"}</Button>{error&&<Alert variant="error">{error}</Alert>}</div>;
}
