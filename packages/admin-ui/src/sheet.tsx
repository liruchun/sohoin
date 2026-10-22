"use client";
// shadcn/ui radix-rhea Sheet (MIT); Radix retains focus trapping and keyboard handling.
import type {ComponentProps} from "react";
import {Dialog} from "radix-ui";
import {X} from "lucide-react";
import cn from "cn/lite";
import {Button} from "./button";
export const Sheet=Dialog.Root;
export const SheetTrigger=Dialog.Trigger;
export const SheetClose=Dialog.Close;
export const SheetTitle=Dialog.Title;
export const SheetDescription=Dialog.Description;
export function SheetContent({className,children,...props}:ComponentProps<typeof Dialog.Content>){
  return <Dialog.Portal><Dialog.Overlay data-slot="sheet-overlay" className="admin-portal au-sheet-overlay"/><Dialog.Content data-slot="sheet-content" className={cn("admin-portal au-sheet",className)} {...props}>{children}<Dialog.Close asChild><Button variant="ghost" size="icon" className="au-sheet-close" aria-label="关闭导航"><X aria-hidden="true"/></Button></Dialog.Close></Dialog.Content></Dialog.Portal>;
}
