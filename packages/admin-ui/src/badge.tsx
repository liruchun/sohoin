// shadcn/ui radix-rhea Badge (MIT).
import type {ComponentProps} from "react";
import {cva,type VariantProps} from "class-variance-authority";
import {Slot} from "radix-ui";
import cn from "cn/lite";
export const badgeVariants=cva("au-badge",{variants:{variant:{default:"au-badge-primary",secondary:"au-badge-secondary",outline:"au-badge-outline",destructive:"au-badge-destructive",ghost:"au-badge-ghost"}},defaultVariants:{variant:"default"}});
export function Badge({className,variant="default",asChild=false,...props}:ComponentProps<"span">&VariantProps<typeof badgeVariants>&{asChild?:boolean}){const Comp=asChild?Slot.Root:"span";return <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({variant}),className)} {...props}/>;}
