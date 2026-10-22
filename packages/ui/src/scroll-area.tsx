"use client";

// shadcn/ui ScrollArea (MIT): Radix owns the overlay scrollbar, dragging and
// the hover-hide delay; the viewport hides native scrollbars and keeps layout width.
import type {ComponentProps} from "react";
import {ScrollArea as Primitive} from "radix-ui";
import {cn} from "./utils";
import styles from "./scroll-area.module.css";

export function ScrollArea({className,viewportClassName,type="hover",children,...props}:ComponentProps<typeof Primitive.Root>&{viewportClassName?:string}){
 return <Primitive.Root data-slot="scroll-area" type={type} className={cn(styles.root,className)} {...props}>
  <Primitive.Viewport data-slot="scroll-area-viewport" className={cn(styles.viewport,viewportClassName)}>{children}</Primitive.Viewport>
  <Primitive.Scrollbar data-slot="scroll-area-scrollbar" orientation="vertical" className={styles.scrollbar}>
   <Primitive.Thumb data-slot="scroll-area-thumb" className={styles.thumb}/>
  </Primitive.Scrollbar>
  <Primitive.Corner/>
 </Primitive.Root>;
}
