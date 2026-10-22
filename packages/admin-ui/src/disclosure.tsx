"use client";
// shadcn/ui Collapsible composition using the Rhea ghost Button and Radix state.
import type {ReactNode} from "react";
import {Collapsible} from "radix-ui";
import {ChevronDown} from "lucide-react";
import {Button} from "./button";
export function Disclosure({label,children,className,defaultOpen,onOpenChange}:{label:ReactNode;children:ReactNode;className?:string;defaultOpen?:boolean;onOpenChange?:(open:boolean)=>void}){return <Collapsible.Root data-slot="collapsible" className={className} defaultOpen={defaultOpen} onOpenChange={onOpenChange}><Collapsible.Trigger asChild><Button data-slot="collapsible-trigger" variant="ghost" className="au-disclosure-trigger">{label}<ChevronDown aria-hidden="true"/></Button></Collapsible.Trigger><Collapsible.Content data-slot="collapsible-content">{children}</Collapsible.Content></Collapsible.Root>;}
