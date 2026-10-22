"use client";
import {Alert} from "@sohoin/ui/feedback";

import {useConfirmation} from "@sohoin/admin-ui/confirmation";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@sohoin/admin-ui/button";
import type {ModerateComment} from "@sohoin/extension-api/comments";
export function CommentActions({id,version,status,threadHidden,mode="single"}:{id:string;version:number;status:string;threadHidden:boolean;mode?:"single"|"thread"}){
 const confirm=useConfirmation();
 const router=useRouter();const [pending,setPending]=useState(false),[error,setError]=useState("");
 async function run(action:ModerateComment["action"]){
  if(action==="delete"&&!await confirm("确定删除这条讨论的正文吗？正文将被清空且不可恢复，已有回复及回复关系会保留。"))return;
  if(action==="hide_thread"&&!await confirm("确定隐藏整个讨论串吗？这会影响一级讨论及全部回复，各条讨论原有状态会保留。"))return;
  setPending(true);setError("");try{const response=await fetch("/api/v1/admin/comments/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({version,action})});const data=await response.json();if(!response.ok){setError(data.error?.message??"操作失败，请刷新后重试。");return;}router.refresh();}catch{setError("网络连接失败，请重试。");}finally{setPending(false);}
 }
 return <div className="comment-actions">{mode==="thread"?<Button variant="outline" disabled={pending} onClick={()=>run(threadHidden?"show_thread":"hide_thread")}>{threadHidden?"恢复整串显示":"隐藏整个讨论串"}</Button>:status!=="deleted"?<><Button variant="outline" disabled={pending} onClick={()=>run(status==="hidden"?"restore":"hide")}>{status==="hidden"?"恢复单条显示":"隐藏这条讨论"}</Button><Button variant="outline" disabled={pending} onClick={()=>run("delete")}>删除正文</Button></>:<p className="au-muted">正文已删除，回复关系仍保留。</p>}{pending&&<span role="status">正在处理…</span>}{error&&<Alert variant="error">{error} <Button variant="outline" size="sm" onClick={()=>router.refresh()}>刷新状态</Button></Alert>}</div>;
}
