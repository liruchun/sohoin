"use client";

// shadcn/ui Select (MIT), composed with the project's existing Radix primitives.
import type {ComponentProps} from "react";
import {Select as Primitive} from "radix-ui";
import {Check,ChevronDown,ChevronUp} from "lucide-react";
import {cn} from "./utils";
import styles from "./select.module.css";

export const Select=Primitive.Root;
export const SelectGroup=Primitive.Group;
export const SelectValue=Primitive.Value;

export function SelectTrigger({children,className,...props}:ComponentProps<typeof Primitive.Trigger>){
 return <Primitive.Trigger data-slot="select-trigger" className={cn(styles.trigger,className)} {...props}>
  {children}<Primitive.Icon asChild><ChevronDown className={styles.icon} aria-hidden="true"/></Primitive.Icon>
 </Primitive.Trigger>;
}

export function SelectContent({children,className,position="popper",sideOffset=4,collisionPadding=12,...props}:ComponentProps<typeof Primitive.Content>){
 return <Primitive.Portal><Primitive.Content data-slot="select-content" position={position} sideOffset={sideOffset} collisionPadding={collisionPadding} className={cn("site-portal",styles.content,className)} {...props}>
  <Primitive.ScrollUpButton className={styles.scroll}><ChevronUp className={styles.icon} aria-hidden="true"/></Primitive.ScrollUpButton>
  <Primitive.Viewport className={styles.viewport}>{children}</Primitive.Viewport>
  <Primitive.ScrollDownButton className={styles.scroll}><ChevronDown className={styles.icon} aria-hidden="true"/></Primitive.ScrollDownButton>
 </Primitive.Content></Primitive.Portal>;
}

export function SelectItem({children,className,...props}:ComponentProps<typeof Primitive.Item>){
 return <Primitive.Item data-slot="select-item" className={cn(styles.item,className)} {...props}>
  <Primitive.ItemText>{children}</Primitive.ItemText>
  <span className={styles.indicator}><Primitive.ItemIndicator><Check className={styles.icon} aria-hidden="true"/></Primitive.ItemIndicator></span>
 </Primitive.Item>;
}
