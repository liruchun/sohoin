"use client";
// shadcn/ui radix-rhea RadioGroup (MIT).
import type {ComponentProps} from "react";
import {RadioGroup as Primitive} from "radix-ui";
import {Circle} from "lucide-react";
import cn from "cn/lite";
export function RadioGroup({className,...props}:ComponentProps<typeof Primitive.Root>){return <Primitive.Root data-slot="radio-group" className={cn("au-radio-group",className)} {...props}/>;}
export function RadioGroupItem({className,...props}:ComponentProps<typeof Primitive.Item>){return <Primitive.Item data-slot="radio-group-item" className={cn("au-radio",className)} {...props}><Primitive.Indicator data-slot="radio-group-indicator"><Circle aria-hidden="true"/></Primitive.Indicator></Primitive.Item>;}
