"use client";

// shadcn/ui Input Group (MIT), adapted from the new-york-v4 registry.
// Keep styling in the shared UI package; use the existing semantic theme.
import type {ComponentProps} from "react";
import {cn} from "./utils";
import {Button} from "./button";
import styles from "./input-group.module.css";

export function InputGroup({className,...props}:ComponentProps<"div">){
 return <div role="group" data-slot="input-group" className={cn(styles.group,className)} {...props}/>;
}
export function InputGroupInput({className,...props}:ComponentProps<"input">){
 return <input data-slot="input-group-control" className={cn(styles.input,className)} {...props}/>;
}
export function InputGroupTextarea({className,...props}:ComponentProps<"textarea">){
 return <textarea data-slot="input-group-control" className={cn(styles.textarea,className)} {...props}/>;
}
export function InputGroupAddon({className,align="inline-start",onClick,...props}:ComponentProps<"div">&{align?:"inline-start"|"inline-end"|"block-end"}){
 return <div role="group" data-slot="input-group-addon" data-align={align} className={cn(styles.addon,className)} onClick={event=>{
  onClick?.(event);
  if(!event.defaultPrevented&&!(event.target as HTMLElement).closest("button"))event.currentTarget.parentElement?.querySelector<HTMLElement>("input,textarea")?.focus();
 }} {...props}/>;
}
export function InputGroupButton({className,...props}:ComponentProps<typeof Button>){
 return <Button variant="ghost" size="sm" className={cn(styles.button,className)} {...props}/>;
}
