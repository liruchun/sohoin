import type {ComponentProps} from "react";
import {relativeTime} from "./relative-time-format";

type RelativeTimeProps=Omit<ComponentProps<"time">,"dateTime"|"children"|"title"|"aria-label">&{dateTime:string;now?:number;locale?:string};

/** Render from the server: no timer, client boundary or hydration-time recalculation. */
export function RelativeTime({dateTime,now,locale="zh-CN",...props}:RelativeTimeProps){
 const value=relativeTime(dateTime,now,locale);
 if(!value)return <span className={props.className}>{locale==="en"?"Unknown time":"时间未知"}</span>;
 return <time {...props} dateTime={value.dateTime} title={value.full} aria-label={value.label+(locale==="en"?", ":"，")+value.full}>{value.label}</time>;
}
