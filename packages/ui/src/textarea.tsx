import type {ComponentProps} from "react";
import {cn} from "./utils";
import styles from "./textarea.module.css";

/** Native shadcn-style textarea; consumers retain input, selection and ref semantics. */
export function Textarea({className,...props}:ComponentProps<"textarea">){
 return <textarea data-slot="textarea" className={cn(styles.root,className)} {...props}/>;
}
