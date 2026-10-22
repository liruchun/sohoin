"use client";
import {StatusMessage,Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {useRef,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {Input} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {MAX_VIDEO_BYTES,videoAccept} from "@sohoin/extension-api/video";
import {MAX_MEDIA_BYTES} from "@sohoin/extension-api/media-limits";
import {useUnsavedChanges} from "../../../_hooks/use-unsaved-changes";
export function MediaUpload(){
 const {notify}=useToast();const router=useRouter();const input=useRef<HTMLInputElement>(null);const [file,setFile]=useState<File|null>(null);const [pending,setPending]=useState(false);const [error,setError]=useState("");useUnsavedChanges(Boolean(file));
 async function submit(event:FormEvent){event.preventDefault();if(!file||pending)return;setPending(true);setError("");try{const video=videoAccept.split(",").includes(file.type);if(file.size>(video?MAX_VIDEO_BYTES:MAX_MEDIA_BYTES)){setError(video?"视频不能超过 50 MiB。":"图片不能超过 10 MiB，请缩小后重试。");return;}const response=await fetch(video?"/api/v1/account/videos":"/api/v1/admin/media",{method:"POST",headers:{"Content-Type":file.type,"X-File-Name":encodeURIComponent(file.name)},body:file});const data=await response.json();if(!response.ok){setError(data.error?.message??"上传失败，请重试。");return;}setFile(null);if(input.current)input.current.value="";notify({variant:"success",message:video?"视频已上传并生成封面。":"图片已上传并生成缩略图。"});router.refresh();}catch{setError("上传未完成，请刷新列表确认后重试。");}finally{setPending(false);}}
 return <form className="media-upload" onSubmit={submit} aria-busy={pending}><label htmlFor="media-file">上传媒体</label><p className="au-muted" id="media-upload-help">支持 JPEG、PNG、WebP 图片（10 MiB、2,000 万像素以内）和 MP4、WebM 视频（50 MiB、5 分钟以内）。</p><div className="media-upload-controls"><Input ref={input} id="media-file" type="file" accept={"image/jpeg,image/png,image/webp,"+videoAccept} required disabled={pending} aria-describedby="media-upload-help" onChange={event=>{setFile(event.target.files?.[0]??null);setError("");}}/><Button disabled={!file||pending} type="submit">{pending?"正在上传并处理…":"上传媒体"}</Button></div>{pending&&<StatusMessage variant="loading">正在上传并处理媒体，请稍候。</StatusMessage>}{error&&<Alert variant="error">{error}</Alert>}</form>;
}
