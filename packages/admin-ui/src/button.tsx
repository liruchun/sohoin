// shadcn/ui radix-rhea Button (MIT). Registry utility rules live in semantic CSS.
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import cn from "cn/lite";
import {Slot} from "radix-ui";

export const buttonVariants = cva("au-button", {
  variants: {
    variant: { default:"au-button-primary", secondary:"au-button-secondary", outline:"au-button-outline", ghost:"au-button-ghost", destructive:"au-button-destructive", link:"au-button-link" },
    size: { default:"au-button-normal", xs:"au-button-xs", sm:"au-button-small", lg:"au-button-large", icon:"au-button-icon", "icon-sm":"au-button-icon-small", "icon-lg":"au-button-icon-large" },
  },
  defaultVariants: {variant:"default",size:"default"},
});
export function Button({className,variant="default",size="default",asChild=false,type="button",...props}:ComponentProps<"button"> & VariantProps<typeof buttonVariants>&{asChild?:boolean}) {
  const Comp=asChild?Slot.Root:"button";
  return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({variant,size}),className)} {...(!asChild?{type}:{})} {...props}/>;
}
