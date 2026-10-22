"use client";

import {useState,type ComponentPropsWithoutRef} from "react";
import {cn} from "./utils";
import {useReducedMotionPreference} from "./theme-provider";
import styles from "./animated-number.module.css";

export type AnimatedNumberProps=Omit<ComponentPropsWithoutRef<"span">,"children">&{
 value:number;
 hideZero?:boolean;
 format?:(value:number)=>string;
};

/** One outgoing and one incoming value; CSS owns completion, with no timers or queues. */
export function AnimatedNumber({value,hideZero=false,format=String,className,...props}:AnimatedNumberProps){
 const reduced=useReducedMotionPreference();
 const [frame,setFrame]=useState({value,previous:null as number|null,revision:0});
 if(!Object.is(frame.value,value)){
  setFrame({value,previous:frame.value,revision:frame.revision+1});
 }else if(reduced&&frame.previous!==null){
  setFrame({...frame,previous:null});
 }
 const changing=!reduced&&frame.previous!==null;
 const text=(number:number)=>hideZero&&number===0?"":format(number);
 function finish(){
  setFrame(current=>current.revision===frame.revision&&current.previous!==null?{...current,previous:null}:current);
 }
 return <span {...props} className={cn(styles.root,className)} hidden={props.hidden||(hideZero&&frame.value===0&&!changing)}
  data-changing={changing||undefined} data-direction={changing&&frame.value<frame.previous!?"down":"up"}>
  {changing&&<span key={`old-${frame.revision}`} className={styles.previous} aria-hidden="true">{text(frame.previous!)}</span>}
  <span key={frame.revision} className={styles.current} onAnimationEnd={finish}>{text(frame.value)}</span>
 </span>;
}
