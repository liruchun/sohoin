"use client";

// shadcn/Radix composition: positioning, dismissal and focus stay with Radix.
import type {ComponentProps} from "react";
import {Popover as Primitive} from "radix-ui";
import {cn} from "./utils";
import styles from "./popover.module.css";

export const Popover=Primitive.Root;
export const PopoverTrigger=Primitive.Trigger;
export function PopoverContent({className,sideOffset=4,collisionPadding=16,...props}:ComponentProps<typeof Primitive.Content>){
 return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} collisionPadding={collisionPadding} className={cn("site-portal",styles.content,className)} {...props}/></Primitive.Portal>;
}
