"use client";

import {useEffect,useState,type ReactNode,type ComponentProps} from "react";
import {Tooltip as Primitive} from "radix-ui";
import styles from "./tooltip.module.css";

export const TooltipProvider=Primitive.Provider;

export function Tooltip({children,label,side="top",disabled=false}:{children:ReactNode;label:string;disabled?:boolean;side?:ComponentProps<typeof Primitive.Content>["side"]}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 return <Primitive.Root open={!disabled&&open} onOpenChange={next=>setOpen(!disabled&&next)}>
  <Primitive.Trigger asChild>{children}</Primitive.Trigger>
  <Primitive.Portal>
   <Primitive.Content className={`site-portal ${styles.content}`} side={side} sideOffset={6} collisionPadding={12}>
    {label}
   </Primitive.Content>
  </Primitive.Portal>
 </Primitive.Root>;
}
