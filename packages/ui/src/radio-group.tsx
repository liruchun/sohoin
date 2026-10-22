"use client";

// shadcn/ui RadioGroup composition (MIT), using the installed Radix primitives.
import type {ComponentProps} from "react";
import {RadioGroup as Primitive} from "radix-ui";
import {Circle} from "lucide-react";
import {cn} from "./utils";
import styles from "./radio-group.module.css";

export function RadioGroup({className,...props}:ComponentProps<typeof Primitive.Root>){
 return <Primitive.Root data-slot="radio-group" className={cn(styles.group,className)} {...props}/>;
}
export function RadioGroupItem({className,...props}:ComponentProps<typeof Primitive.Item>){
 return <Primitive.Item data-slot="radio-group-item" className={cn(styles.item,className)} {...props}>
  <Primitive.Indicator data-slot="radio-group-indicator" className={styles.indicator}><Circle aria-hidden="true"/></Primitive.Indicator>
 </Primitive.Item>;
}
