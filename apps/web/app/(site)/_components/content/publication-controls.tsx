"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Button} from '@sohoin/ui/button';
import {Dialog} from '@sohoin/ui/dialog';
import {DialogContent,DialogTitle,DialogDescription} from '@sohoin/ui/dialog-content';
import {Alert} from '@sohoin/ui/feedback';
import {useToast} from '@sohoin/ui/toast';
import {PostComposer,type EditablePublication} from './post-composer';
import {ContentMenu} from './content-menu';
import type {DiscussionTarget} from './discussion-composer-context';
import {useDetailData} from '../../_features/content/detail-data';
import styles from './post-composer.module.css';

/** Only the detail view requests ownership; feed cards don't add per-row requests. */
export function PublicationControls({publicId,type,updatedAt,href,discussion}:{publicId:string;type:'post'|'comment';updatedAt:string;href:string;discussion?:DiscussionTarget}){
 const t=useTranslations('Publishing'),router=useRouter(),{notify}=useToast(),editButton=useRef<HTMLButtonElement>(null),lock=useRef(false);
 const {invalidate}=useDetailData();
 const [value,setValue]=useState<EditablePublication|null>(null),[edit,setEdit]=useState(false),[remove,setRemove]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const url=`/api/v1/account/publications/${type}/${publicId}`;
 useEffect(()=>{const controller=new AbortController();setValue(null);fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{if(response.ok){const data=await response.json();if(!controller.signal.aborted)setValue(data.publication);}}).catch(()=>{});return ()=>controller.abort();},[url,updatedAt,attempt]);
 async function destroy(){
  if(lock.current||!value)return;lock.current=true;setBusy(true);setError('');
  try{const response=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:value.version,value:null})});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||t('failed'));setRemove(false);notify({variant:'success',message:t('deleted')});invalidate();router.replace('/',{transitionTypes:["page-switch"]});router.refresh();}
  catch(error){setError(error instanceof Error?error.message:t('failed'));}finally{lock.current=false;setBusy(false);}
 }
 return <><ContentMenu href={href} comment={type==='comment'} discussion={discussion} detail triggerRef={editButton} ownerActions={value?{edit:()=>setEdit(true),remove:()=>{setError('');setRemove(true);}}:undefined}/>
  {edit&&value&&<PostComposer editing={{publicId,type,value,onSaved:()=>setAttempt(value=>value+1)}} controlledOpen={edit} onOpenChange={setEdit} anchor={editButton.current??undefined}/>}
  <Dialog open={remove} onOpenChange={next=>{if(!busy)setRemove(next);}}><DialogContent onCloseAutoFocus={event=>{event.preventDefault();editButton.current?.focus({preventScroll:true});}}><DialogTitle>{t('deleteTitle')}</DialogTitle><DialogDescription>{t(type==='comment'?'deleteCommentBody':'deletePostBody')}</DialogDescription>{error&&<Alert variant="error">{error}</Alert>}<div className={styles.confirmActions}><Button disabled={busy} variant="outline" onClick={()=>setRemove(false)}>{t('cancel')}</Button><Button disabled={busy} onClick={()=>void destroy()}>{t(busy?'deleting':'delete')}</Button></div></DialogContent></Dialog>
 </>;
}
