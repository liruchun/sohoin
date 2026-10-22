// shadcn/ui radix-rhea Sidebar menu primitives (MIT).
// The host owns route matching; the shell owns responsive open/collapsed state.
import type {ComponentProps} from "react";
import {Slot} from "radix-ui";
import cn from "cn/lite";
export function SidebarMenu({className,...props}:ComponentProps<"ul">){return <ul data-slot="sidebar-menu" className={cn("au-sidebar-menu",className)} {...props}/>;}
export function SidebarMenuItem(props:ComponentProps<"li">){return <li data-slot="sidebar-menu-item" {...props}/>;}
export function SidebarMenuButton({asChild=false,isActive=false,...props}:ComponentProps<"button">&{asChild?:boolean;isActive?:boolean}){const Comp=asChild?Slot.Root:"button";return <Comp data-slot="sidebar-menu-button" data-active={isActive} {...props}/>;}
