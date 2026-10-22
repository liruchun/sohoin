// shadcn/ui Button (MIT), composed through Radix Slot and CVA.
// CVA selects short module classes; Radix composition and public variants stay intact.
import type {ComponentProps} from "react";
import {Slot} from "radix-ui";
import {cva,type VariantProps} from "class-variance-authority";
import cn from "cn/lite";
import styles from "./button.module.css";
export const buttonVariants=cva(
 styles.root,
 {variants:{
  variant:{
   default:styles.primary,
   outline:styles.outline,
   secondary:styles.secondary,
   ghost:styles.ghost,
   plain:styles.plain,
   avatar:styles.avatar,
   link:styles.link,
  },
  size:{default:styles.defaultSize,sm:styles.small,icon:styles.icon,"icon-sm":styles.smallIcon},
 },defaultVariants:{variant:"default",size:"default"}},
);
export function Button({className,variant="default",size="default",asChild=false,type="button",...props}:ComponentProps<"button">&VariantProps<typeof buttonVariants>&{asChild?:boolean}){const Comp=asChild?Slot.Root:"button";return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({variant,size}),className)} {...(!asChild?{type}:{})} {...props}/>;}
