import type {ComponentProps} from "react";
import {CheckCircle2,CircleAlert,Info,LoaderCircle,TriangleAlert} from "lucide-react";
import {cva} from "class-variance-authority";
import {cn} from "./utils";
import styles from "./feedback.module.css";

export type FeedbackVariant="default"|"success"|"info"|"warning"|"error"|"loading";
const labels:Record<FeedbackVariant,string>={default:"提示",success:"成功",info:"提示",warning:"注意",error:"错误",loading:"处理中"};
const icons={default:Info,success:CheckCircle2,info:Info,warning:TriangleAlert,error:CircleAlert,loading:LoaderCircle};
const feedback=cva(styles.root,{variants:{variant:{default:"",success:"",info:"",warning:"",error:styles.error,loading:""}},defaultVariants:{variant:"info"}});
export function FeedbackIcon({variant="info"}:{variant?:FeedbackVariant}){const Icon=icons[variant];return <Icon className={cn(styles.icon,variant==="loading"&&styles.loading)} aria-hidden="true"/>;}
export function FeedbackLabel({variant="info",label}:{variant?:FeedbackVariant;label?:string}){return <span className={styles.sr}>{label??labels[variant]}: </span>;}
type FeedbackProps=Omit<ComponentProps<"div">,"role">&{variant?:FeedbackVariant;announce?:boolean;statusLabel?:string};
export function StatusMessage({children,variant="info",announce=true,className,statusLabel,...props}:FeedbackProps){return <div {...props} role={announce?(variant==="error"?"alert":"status"):undefined} aria-atomic={announce?true:undefined} data-slot="feedback" data-variant={variant} className={cn(feedback({variant}),className)}><FeedbackIcon variant={variant}/><div className={styles.body}><FeedbackLabel variant={variant} label={statusLabel}/>{children}</div></div>;}
export function Alert({className,variant="warning",...props}:FeedbackProps){return <StatusMessage {...props} variant={variant} className={cn(styles.alert,className)}/>;}
export function FieldError({id,...props}:Omit<FeedbackProps,"variant"|"id">&{id:string}){return <StatusMessage {...props} id={id} variant="error"/>;}
