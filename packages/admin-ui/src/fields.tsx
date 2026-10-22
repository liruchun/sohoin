// shadcn/ui radix-rhea Input / Textarea (MIT), with semantic style classes.
import type {ComponentProps,ReactNode} from "react";
import cn from "cn/lite";
import {Card} from "./card";
export function Input({className,...props}:ComponentProps<"input">){return <input data-slot="input" className={cn("au-input",className)} {...props}/>;}
export function Textarea({className,...props}:ComponentProps<"textarea">){return <textarea data-slot="textarea" className={cn("au-input au-textarea",className)} {...props}/>;}
export function FormSection({title,description,children,disabled,id}: {title:string;description?:string;children:ReactNode;disabled?:boolean;id?:string}) {
  return <Card as="fieldset" disabled={disabled} className="au-form-section" id={id}><legend data-slot="card-title">{title}</legend>{description&&<p data-slot="card-description" className="au-muted">{description}</p>}{children}</Card>;
}
