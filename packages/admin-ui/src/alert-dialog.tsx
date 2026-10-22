"use client";
// shadcn/ui radix-rhea AlertDialog (MIT), preserving Radix focus and keyboard handling.
import type {ComponentProps} from "react";
import {AlertDialog as Primitive} from "radix-ui";
import cn from "cn/lite";
import {Button} from "./button";
export const AlertDialog=Primitive.Root;
export const AlertDialogTrigger=Primitive.Trigger;
export function AlertDialogContent({className,...props}:ComponentProps<typeof Primitive.Content>){return <Primitive.Portal><Primitive.Overlay data-slot="alert-dialog-overlay" className="admin-portal au-alert-overlay"/><Primitive.Content data-slot="alert-dialog-content" className={cn("admin-portal au-alert",className)} {...props}/></Primitive.Portal>;}
export function AlertDialogHeader(props:ComponentProps<"div">){return <div data-slot="alert-dialog-header" className="au-alert-header" {...props}/>;}
export function AlertDialogFooter(props:ComponentProps<"div">){return <div data-slot="alert-dialog-footer" className="au-alert-footer" {...props}/>;}
export function AlertDialogTitle({className,...props}:ComponentProps<typeof Primitive.Title>){return <Primitive.Title data-slot="alert-dialog-title" className={cn("au-alert-title",className)} {...props}/>;}
export function AlertDialogDescription({className,...props}:ComponentProps<typeof Primitive.Description>){return <Primitive.Description data-slot="alert-dialog-description" className={cn("au-alert-description",className)} {...props}/>;}
export function AlertDialogAction(props:ComponentProps<typeof Primitive.Action>){return <Button asChild><Primitive.Action data-slot="alert-dialog-action" {...props}/></Button>;}
export function AlertDialogCancel(props:ComponentProps<typeof Primitive.Cancel>){return <Button asChild variant="outline"><Primitive.Cancel data-slot="alert-dialog-cancel" {...props}/></Button>;}
