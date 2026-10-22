"use client";
import {useTranslations} from "next-intl";


import {useState,type ReactNode} from "react";
import {Dialog,DialogTrigger} from "@sohoin/ui/dialog";
import {DialogClose,DialogContent,DialogDescription,DialogTitle} from "@sohoin/ui/dialog-content";
import {Button} from "@sohoin/ui/button";
import styles from "./external-link.module.css";

export function ExternalLink({href,hostname,children,className}:{href:string;hostname:string;children?:ReactNode;className?:string}){
 const t=useTranslations("Web");
 const [open,setOpen]=useState(false);
 return <Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
   <a data-external-link="" href={href} className={className??styles.link} title={href} aria-label={t("externalConfirmation",{hostname})} target="_blank" rel="ugc nofollow noopener noreferrer"
    onClick={event=>{event.preventDefault();setOpen(true);}}
    onAuxClick={event=>{if(event.button===1){event.preventDefault();setOpen(true);}}}>
    {children??<span>{hostname}</span>}
   </a>
  </DialogTrigger>
  <DialogContent className={styles.dialog} showCloseButton={false}>
   <DialogTitle className={styles.title}>{t("openExternalTitle")}</DialogTitle>
   <DialogDescription className={styles.description}>{t("openExternalDescription")}</DialogDescription>
   <p className={styles.destination}>{href}</p>
   <div className={styles.actions}>
    <DialogClose asChild><Button variant="ghost" size="sm">{t("cancel")}</Button></DialogClose>
    <Button asChild size="sm"><a href={href} target="_blank" rel="ugc nofollow noopener noreferrer" onClick={()=>setOpen(false)}>{t("openLink")}</a></Button>
   </div>
  </DialogContent>
 </Dialog>;
}
