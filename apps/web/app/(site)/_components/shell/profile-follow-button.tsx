"use client";
import {useEffect,useRef,useState} from "react";
import {useTranslations} from "next-intl";
import {Plus} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {useToast} from "@sohoin/ui/toast";
import {cn} from "@sohoin/ui/utils";
import styles from "../content/detail-panel.module.css";
import followStyles from "./profile-follow-button.module.css";

export function ProfileFollowButton({publicId,authenticated}:{publicId:string;authenticated:boolean}){
 const t=useTranslations("Web"),{notify}=useToast();
 const [active,setActive]=useState<boolean|null>(null),[pending,setPending]=useState(false);
 const [loading,setLoading]=useState(authenticated);
 const writing=useRef(false);
 const endpoint=`/api/site/members/${publicId}/follow`;
 useEffect(()=>{
  if(!authenticated)return;
  const controller=new AbortController();
  void fetch(endpoint,{cache:"no-store",signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error();
   const result=await response.json();
   if(!controller.signal.aborted)setActive(result.active);
  }).catch(()=>{
   if(!controller.signal.aborted)notify({variant:"error",message:t("actionFailed")});
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[authenticated,endpoint,notify,t]);
 function failed(status:number){
  notify({variant:status===401?"warning":"error",message:t(status===401?"signInRequired":status===429?"tooManyRequests":status===403?"notAllowed":"actionFailed"),...(status===401?{action:{label:t("login"),href:"/admin/login"}}:{})});
 }
 async function toggle(){
  if(writing.current||loading)return;
  if(!authenticated){failed(401);return;}
  writing.current=true;setPending(true);
  try{
   // Re-read unknown state after a failed initial load or ambiguous write.
   let current=active;
   if(current===null){
    const response=await fetch(endpoint,{cache:"no-store"});
    if(!response.ok){failed(response.status);return;}
    current=(await response.json()).active;
   }
   const response=await fetch(endpoint,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!current}),cache:"no-store"});
   if(!response.ok){setActive(null);failed(response.status);return;}
   setActive((await response.json()).active);
  }catch{setActive(null);notify({variant:"error",message:t("networkFailed")});}
  finally{writing.current=false;setPending(false);}
 }
 return <Button variant="plain" className={styles.publish} disabled={pending||loading} aria-busy={pending||loading} aria-pressed={active===true} aria-label={t(active?"unfollowMember":"followMember")} onClick={()=>{void toggle();}}>
  <MagneticSurface disabled={active===true} className={cn(styles.publishSurface,followStyles.surface)} data-following={active===true||undefined}>
   {!active&&<Plus data-icon="inline-start" aria-hidden="true"/>}
   {t(active?"followingMember":"followMember")}
  </MagneticSurface>
 </Button>;
}
