"use client";
// shadcn/ui radix-rhea Switch (MIT).
import type {ComponentProps} from "react";
import {Switch as Primitive} from "radix-ui";
import cn from "cn/lite";
export function Switch({className,size="default",...props}:ComponentProps<typeof Primitive.Root>&{size?:"default"|"sm"}){return <Primitive.Root data-slot="switch" data-size={size} className={cn("au-switch",className)} {...props}><Primitive.Thumb data-slot="switch-thumb" className="au-switch-thumb"/></Primitive.Root>;}
