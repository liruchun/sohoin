"use client";
import {useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@sohoin/admin-ui/button";
import {Input,Textarea} from "@sohoin/admin-ui/fields";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@sohoin/admin-ui/alert-dialog";
import {Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";
import styles from "./badges.module.css";
type User={id:string;name:string;email:string};
type Option={key:string;name:string;enabled:boolean;owned:boolean};
type Page<T>={items:T[];nextCursor:string|null};
export function BadgeAction({user,badge,revokeRevision}:{user?:{id:string;name:string};badge?:{key:string;name:string};revokeRevision?:number}){
 const router=useRouter(),{notify}=useToast(),attempt=useRef({signature:"",key:""});
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [conflict,setConflict]=useState(false);
 const [reason,setReason]=useState(""),[q,setQ]=useState(""),[users,setUsers]=useState<Page<User>>(),[options,setOptions]=useState<Page<Option>>();
 const [userId,setUser]=useState(user?.id??""),[badgeKey,setBadge]=useState(badge?.key??"");
 const revoke=revokeRevision!==undefined;
 async function load(kind:"users"|"badges",before?:string,target?:string){
  if(loading)return;setLoading(true);setError("");
  const params=new URLSearchParams();if(kind==="users")params.set("q",q);else params.set("userId",user?.id??target??userId);if(before)params.set("before",before);if(kind==="badges"&&badge)params.set("key",badge.key);
  try{const response=await fetch((kind==="users"?"/api/v1/admin/users?":"/api/v1/admin/badges/options?")+params);const data=await response.json();if(!response.ok)throw new Error(data.error?.message??"加载失败");if(kind==="users"){setUsers(data);setUser("");setOptions(undefined);}else{setOptions(data);setBadge(badge?.key??"");}}
  catch(e){setError(e instanceof Error?e.message:"加载失败，请重试。");}finally{setLoading(false);}
 }
 async function submit(event:FormEvent){
  event.preventDefault();if(pending||loading)return;
  const value={userId,badgeKey,reason,...(revoke?{revision:revokeRevision}:{})},signature=JSON.stringify(value);
  if(attempt.current.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};
  setPending(true);setError("");
  try{const response=await fetch("/api/v1/admin/badges/grants",{method:revoke?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...value,requestId:attempt.current.key})});const data=await response.json();if(!response.ok){setConflict(data.error?.code==="BADGE_REVISION_CONFLICT");throw new Error(data.error?.message??"操作失败");}
   notify({variant:"success",message:data.replayed?"该请求已处理，请查看最新状态。":data.changed?(revoke?"勋章已撤销。":"勋章已授予。"):(revoke?"该勋章已撤销。":"用户已拥有该勋章。")});
   setOpen(false);setReason("");attempt.current={signature:"",key:""};router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"网络连接失败，可重试当前操作。");}finally{setPending(false);}
 }
 const selectedUser=user?.name??users?.items.find(item=>item.id===userId)?.name;
 const selectedBadge=badge?.name??options?.items.find(item=>item.key===badgeKey)?.name;
 const owned=!revoke&&options?.items.some(item=>item.key===badgeKey&&item.owned);
 return <AlertDialog open={open} onOpenChange={next=>{if(pending||loading)return;setOpen(next);if(next){setError("");if(!badge)void load("badges");}}}>
  <AlertDialogTrigger asChild><Button variant="outline" size="sm">{revoke?"撤销":"授予勋章"}</Button></AlertDialogTrigger>
  <AlertDialogContent className={styles.dialog}><AlertDialogHeader><AlertDialogTitle>{revoke?"撤销勋章":"授予勋章"}</AlertDialogTitle><AlertDialogDescription>{revoke?"撤销只影响这位用户，历史记录会保留。":"选择用户与勋章，并填写本次授予原因。"}</AlertDialogDescription></AlertDialogHeader>
   <form className={styles.form} onSubmit={submit}><fieldset disabled={pending||loading}>
    {user?<p>用户：{user.name}</p>:<><label>搜索用户<Input maxLength={100} placeholder="姓名或邮箱前缀" value={q} onChange={e=>{setQ(e.target.value);setUser("");setUsers(undefined);setOptions(undefined);}}/></label><Button variant="outline" onClick={()=>void load("users")}>查找用户</Button>
     {users&&<><label>选择用户<NativeSelect required value={userId} onChange={e=>{setUser(e.target.value);setOptions(undefined);if(e.target.value)void load("badges",undefined,e.target.value);}}><option value="">请选择用户</option>{users.items.map(item=><option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</NativeSelect></label>{!users.items.length&&<p>没有匹配的用户。</p>}<div className={styles.actions}><Button variant="ghost" onClick={()=>void load("users")}>返回首批</Button>{users.nextCursor&&<Button variant="outline" onClick={()=>void load("users",users.nextCursor!)}>下一批用户</Button>}</div></>}
    </>}
    {badge?<p>勋章：{badge.name}</p>:<><label>选择勋章<NativeSelect required value={badgeKey} onChange={e=>setBadge(e.target.value)}><option value="">请选择勋章</option>{options?.items.map(item=><option key={item.key} value={item.key} disabled={!item.enabled||item.owned}>{item.name}{item.owned?"（已拥有）":!item.enabled?"（已停用）":""}</option>)}</NativeSelect></label>
     {options?.items.length===0&&<p>还没有可选勋章，请先到勋章管理创建。</p>}<div className={styles.actions}><Button variant="ghost" onClick={()=>void load("badges")}>返回首批</Button>{options?.nextCursor&&<Button variant="outline" onClick={()=>void load("badges",options.nextCursor!)}>下一批勋章</Button>}</div></>}
    <label>{revoke?"撤销原因":"授予原因"}<Textarea required maxLength={500} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    {selectedUser&&selectedBadge&&<p className={styles.muted}>{revoke?"将撤销":"将授予"}「{selectedUser}」的「{selectedBadge}」。</p>}
   </fieldset>{owned&&<p role="status">这位用户已拥有该勋章。</p>}{loading&&<p role="status">正在加载…</p>}{error&&<Alert variant="error">{error}</Alert>}
    <AlertDialogFooter><AlertDialogCancel disabled={pending||loading}>取消</AlertDialogCancel>{conflict?<Button variant="outline" onClick={()=>{setOpen(false);setConflict(false);router.refresh();}}>刷新最新状态</Button>:<Button type="submit" variant={revoke?"destructive":"default"} disabled={pending||loading||owned||!userId||!badgeKey||!reason.trim()}>{pending?"正在处理…":revoke?"确认撤销":"确认授予"}</Button>}</AlertDialogFooter>
   </form>
  </AlertDialogContent>
 </AlertDialog>;
}
