"use client";
// shadcn/ui radix-rhea Checkbox (MIT).
import type {ComponentProps} from "react";
import {Checkbox as Primitive} from "radix-ui";
import {Check} from "lucide-react";
import cn from "cn/lite";
export function Checkbox({className,...props}:ComponentProps<typeof Primitive.Root>){return <Primitive.Root data-slot="checkbox" className={cn("au-checkbox",className)} {...props}><Primitive.Indicator data-slot="checkbox-indicator"><Check aria-hidden="true"/></Primitive.Indicator></Primitive.Root>;}
