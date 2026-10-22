"use client";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {useConfirmation} from "@sohoin/admin-ui/confirmation";
import {useState,useRef,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {Input,Textarea} from "@sohoin/admin-ui/fields";
import {useUnsavedChanges} from "../../../_hooks/use-unsaved-changes";
import {Button} from "@sohoin/admin-ui/button";
export function SystemNotificationForm({recipient=""}:{recipient?:string}){
 const {notify}=useToast();
 const confirm=useConfirmation();const router=useRouter(),[recipientId,setRecipient]=useState(recipient),[title,setTitle]=useState(""),[body,setBody]=useState(""),[pending,setPending]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");useUnsavedChanges(Boolean(title||body||recipientId!==recipient)&&!pending&&!message);const attempt=useRef({signature:"",key:""});async function send(event:FormEvent){event.preventDefault();if(!await confirm("确定向这位用户发送系统通知吗？"))return;const value={recipientId,title,body},signature=JSON.stringify(value);if(attempt.current.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};setPending(true);setError("");setMessage("");try{const response=await fetch("/api/v1/admin/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...value,key:attempt.current.key})});const result=await response.json();if(!response.ok){setError(result.error?.message??"发送失败");return;}setMessage("已发送");notify({variant:"success",message:"系统通知已发送。"});router.refresh();}catch{setError("网络连接失败，可重试发送。");}finally{setPending(false);}}return <form className="profile-editor" onSubmit={send}><fieldset className="content-fields" disabled={pending}><label>接收用户编号<Input required maxLength={128} value={recipientId} onChange={e=>{setRecipient(e.target.value);setMessage("");}}/></label><label>通知标题<Input required maxLength={120} value={title} onChange={e=>{setTitle(e.target.value);setMessage("");}}/></label><label>通知正文<Textarea rows={4} maxLength={1000} value={body} onChange={e=>{setBody(e.target.value);setMessage("");}}/></label><p className="au-muted">向指定用户发送纯文本系统通知。可从用户详情进入并自动填入接收人。</p></fieldset>{error&&<Alert variant="error">{error}</Alert>}<Button type="submit" disabled={pending}>{pending?"正在发送…":"发送系统通知"}</Button></form>;}
