"use client";

import {useEffect,useImperativeHandle,useRef,useState,type Ref,type RefObject} from 'react';
import {useTranslations} from 'next-intl';
import {Mention,MentionInput,MentionLabel,MentionContent,MentionItem,MentionPortal} from '@sohoin/ui/mention';
import {Textarea} from '@sohoin/ui/textarea';
import {Button} from '@sohoin/ui/button';
import {decodeMentionDraft,encodeMentionDraft,mentionLabel,type MentionMember} from '@sohoin/extension-api/mentions';
import {AuthorAvatar} from './author-avatar';
import {recentMentionIds,rememberMentionMember} from './recent-mention-members';
import styles from './mention-textarea.module.css';

export type MentionEditorHandle={insert:()=>void;isOpen:()=>boolean;close:()=>void};
export function MentionTextarea({value,onChange,inputRef,portalRef,disabled,label,placeholder,className,ref}:{value:string;onChange:(value:string)=>void;inputRef:RefObject<HTMLTextAreaElement|null>;portalRef:RefObject<HTMLDivElement|null>;disabled:boolean;label:string;placeholder:string;className:string;ref?:Ref<MentionEditorHandle>}){
 const t=useTranslations('Publishing');
 const [source,setSource]=useState(value),[draft,setDraft]=useState(()=>decodeMentionDraft(value));
 const [selected,setSelected]=useState(()=>draft.members.map(member=>member.id));
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[attempt,setAttempt]=useState(0);
 const [isComposing,setIsComposing]=useState(false);
 const [result,setResult]=useState<{query:string;items:MentionMember[];error?:boolean}|null>(null);
 const known=useRef(new Map(draft.members.map(member=>[member.id,member]))),composing=useRef(false);
 const frame=useRef<number|null>(null);
 if(source!==value){
  const next=decodeMentionDraft(value);
  known.current=new Map(next.members.map(member=>[member.id,member]));
  setSource(value);setDraft(next);setSelected(next.members.map(member=>member.id));
 }
 const change=(text:string,ids=selected)=>{
  const position=inputRef.current?.selectionStart??text.length;
  if(!composing.current)setQuery(text.slice(0,position).match(/@([^\s@]*)$/)?.[1]??'');
  const members=ids.flatMap(id=>{const member=known.current.get(id);return member?[member]:[];});
  const body=encodeMentionDraft(text,members);
  setDraft({text,members});setSource(body);onChange(body);
 };
 useEffect(()=>{
  if(!open||isComposing||disabled)return;
  const recent=query.trim()?[]:recentMentionIds();
  if(!query.trim()&&!recent.length){setResult({query,items:[]});return;}
  setResult(null);
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   fetch('/api/v1/account/mentions?'+(query.trim()?'q='+encodeURIComponent(query.trim()):'recent='+encodeURIComponent(recent.join(','))),{cache:'no-store',signal:controller.signal})
    .then(async response=>{if(!response.ok)throw new Error();return response.json() as Promise<{items:Omit<MentionMember,'label'>[]}>;})
    .then(data=>{
     if(controller.signal.aborted)return;
     const candidates=[...known.current.values()];
     const items=data.items.map(item=>{
      const label=known.current.get(item.id)?.label??mentionLabel(item.name,item.id,candidates);
      const member={...item,label};candidates.push(member);return member;
     });
     setResult({query,items});
    },()=>{if(!controller.signal.aborted)setResult({query,items:[],error:true});});
  },query.trim()?200:0);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[open,query,attempt,isComposing,disabled]);
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 useImperativeHandle(ref,()=>({isOpen:()=>open,close:()=>setOpen(false),insert:()=>{
  const field=inputRef.current;if(!field||disabled)return;
  const start=field.selectionStart,end=field.selectionEnd;
  const trigger='@';
  const text=draft.text.slice(0,start)+trigger+draft.text.slice(end);
  change(text);setQuery('');setOpen(true);
  // Refocus after the controlled value commits; Dice positions at the caret.
  if(frame.current!==null)cancelAnimationFrame(frame.current);
  frame.current=requestAnimationFrame(()=>{frame.current=null;field.setSelectionRange(start+trigger.length,start+trigger.length);field.focus({preventScroll:true});});
 }}));
 const current=result?.query===query?result:null;
 const items=current?.items??[];
 const status=!current?t('mentionLoading'):current.error?t('mentionFailed'):!query.trim()?t('mentionPrompt'):t('mentionEmpty');
 return <Mention className={styles.root} inputValue={draft.text} onInputValueChange={text=>change(text)} value={selected} onValueChange={ids=>{
  for(const item of items)if(ids.includes(item.id))known.current.set(item.id,item);
  for(const id of ids)if(!selected.includes(id))rememberMentionMember(id);
  setSelected(ids);change(inputRef.current?.value??draft.text,ids);
 }} open={open} onOpenChange={next=>{if(!next||!composing.current)setOpen(next);}} manualFiltering disabled={disabled} loop>
  <MentionLabel className="sr-only">{label}</MentionLabel>
  <MentionInput asChild>
   <Textarea ref={inputRef} value={draft.text} rows={1} maxLength={5000} disabled={disabled} placeholder={placeholder} className={className}
    onCompositionStart={()=>{composing.current=true;setIsComposing(true);setOpen(false);}}
    onCompositionEnd={event=>{
     composing.current=false;setIsComposing(false);
     const field=event.currentTarget;
     const match=field.value.slice(0,field.selectionStart).match(/@([^\s@]*)$/);
     // Dice has already positioned the menu during composition, but opening was
     // suppressed. Commit the final query and reopen without waiting for a key.
     change(field.value);setQuery(match?.[1]??'');setOpen(Boolean(match));
    }}
    onSelect={event=>{if(!composing.current)setQuery(event.currentTarget.value.slice(0,event.currentTarget.selectionStart).match(/@([^\s@]*)$/)?.[1]??'');}}
    onKeyDownCapture={event=>{if(composing.current||event.nativeEvent.isComposing||event.keyCode===229)event.stopPropagation();}}/>
  </MentionInput>
  <MentionPortal container={portalRef.current}>
   <MentionContent forceMount hidden={!open} strategy="fixed" onEscapeKeyDown={event=>event.stopPropagation()}>
    {items.map(item=><MentionItem key={item.id} value={item.id} label={item.label} disabled={!selected.includes(item.id)&&new Set(selected).size>=20}>
     <span className={styles.avatar}><AuthorAvatar src={item.avatar??null} name={item.name}/></span><span className={styles.name}>{item.label}</span>
    </MentionItem>)}
    {/* A disabled option keeps Dice's async list open while there are no results. */}
    {!items.length&&<MentionItem value="mention-status" disabled><span role="status">{status}</span></MentionItem>}
    {current?.error&&<Button variant="link" className={styles.retry} onClick={()=>setAttempt(value=>value+1)}>{t('mentionRetry')}</Button>}
   </MentionContent>
  </MentionPortal>
 </Mention>;
}
