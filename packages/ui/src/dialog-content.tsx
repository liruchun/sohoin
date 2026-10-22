"use client";
import {useTranslations} from "next-intl";

// shadcn/ui Dialog (MIT): Radix owns dismissal, focus trapping and restoration.
import type {ComponentProps} from "react";
import {Dialog as Primitive} from "radix-ui";
import {X} from "lucide-react";
import cn from "cn/lite";
import {Button} from "./button";
import {cva} from "class-variance-authority";
import styles from "./dialog.module.css";
export const DialogClose=Primitive.Close;
const contentVariants=cva(
 "site-portal fixed left-1/2 top-[var(--ui-dialog-top)] z-[61] max-h-[var(--ui-dialog-available-height)] overflow-auto overscroll-contain border-0 rounded-3xl bg-popover text-base leading-[1.65] text-popover-foreground outline-none",
 {variants:{size:{
  default:"w-[calc(100vw_-_2rem)] max-w-[35rem] p-6",
  lg:"w-[calc(100vw_-_3rem)] max-w-[56.25rem] p-8 max-[40.625rem]:w-[calc(100vw_-_2rem)] max-[40.625rem]:rounded-[1.375rem] max-[40.625rem]:p-6",
  lightbox:"w-[calc(100vw_-_2rem)] max-w-none p-0",
  page:"inset-0 left-0 top-0 h-dvh max-h-none w-full max-w-none rounded-none bg-background p-0 shadow-none",
  document:"w-full max-w-none rounded-none bg-background p-0 shadow-none",
 }},defaultVariants:{size:"default"}},
);
type DialogContentProps=ComponentProps<typeof Primitive.Content>&{size?:"default"|"lg"|"lightbox"|"page"|"document";showCloseButton?:boolean;closeLabel?:string;overlayClassName?:string};
export function DialogContent({className,children,size="default",showCloseButton=true,closeLabel,overlayClassName,...props}:DialogContentProps){
 const t=useTranslations("UI");
 const content=<Primitive.Content data-slot="dialog-content" data-size={size} className={cn(contentVariants({size}),styles.content,className)} {...props}>
  {children}
  {showCloseButton&&<Primitive.Close asChild><Button variant="ghost" size="icon" className="absolute top-4 right-4" aria-label={closeLabel??t("close")}><X size="1.375rem" strokeWidth={1.75} aria-hidden="true"/></Button></Primitive.Close>}
 </Primitive.Content>;
 // Non-modal route details participate in document layout and document scrolling.
 // Other dialog sizes retain their existing portal, overlay and scroll boundary.
 if(size==="document")return content;
 return <Primitive.Portal>
  <Primitive.Overlay data-slot="dialog-overlay" className={cn("site-portal fixed inset-0 z-[60]",styles.overlay,overlayClassName)}/>
  {content}
 </Primitive.Portal>;
}
export function DialogTitle({className,...props}:ComponentProps<typeof Primitive.Title>){return <Primitive.Title data-slot="dialog-title" className={cn("m-0 text-[1.25rem] font-semibold",className)} {...props}/>;}
export function DialogDescription({className,...props}:ComponentProps<typeof Primitive.Description>){return <Primitive.Description data-slot="dialog-description" className={cn("mt-2 text-[0.875rem] text-muted-foreground",className)} {...props}/>;}
