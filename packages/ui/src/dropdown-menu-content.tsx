"use client";
// shadcn/ui DropdownMenu (MIT): keep Radix roving focus, typeahead and dismissal.
import type {ComponentProps} from "react";
import {DropdownMenu as Primitive} from "radix-ui";
import cn from "cn/lite";
import styles from "./dropdown-menu.module.css";
export function DropdownMenuContent({className,sideOffset=4,collisionPadding=16,...props}:ComponentProps<typeof Primitive.Content>){return <Primitive.Portal><Primitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} collisionPadding={collisionPadding} className={cn(
 "site-portal min-w-40 max-w-[var(--radix-dropdown-menu-content-available-width)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-auto rounded-[0.875rem] border border-solid border-border bg-popover p-2 text-base leading-[1.65] text-popover-foreground outline-none",
 styles.content,className,
)} {...props}/></Primitive.Portal>;}
export function DropdownMenuItem({className,...props}:ComponentProps<typeof Primitive.Item>){return <Primitive.Item data-slot="dropdown-menu-item" className={cn(
 "relative flex min-h-10 cursor-default items-center rounded-lg px-3 py-2.5 text-[0.875rem] text-popover-foreground no-underline outline-none select-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
 className,
)} {...props}/>;}
