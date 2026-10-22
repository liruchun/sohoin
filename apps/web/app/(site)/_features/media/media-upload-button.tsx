"use client";

import {useState,type ComponentProps} from 'react';
import {motion} from 'motion/react';
import {Button} from '@sohoin/ui/button';
import {useReducedMotionPreference} from '@sohoin/ui/theme-provider';

// lucide-animated Upload (MIT); see apps/web/LICENSE.lucide-animated.
// Source: https://lucide-animated.com/r/upload.json
export function MediaUploadButton({children,disabled,...props}:ComponentProps<typeof Button>){
 const [hovered,setHovered]=useState(false),reduceMotion=useReducedMotionPreference();
 return <Button {...props} disabled={disabled}
  onPointerEnter={event=>setHovered(event.pointerType==='mouse'&&window.matchMedia('(hover: hover) and (pointer: fine)').matches)}
  onPointerLeave={()=>setHovered(false)} onPointerCancel={()=>setHovered(false)}>
  <svg data-icon="inline-start" aria-hidden="true" focusable="false" width="1.5rem" height="1.5rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
   <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
   <motion.g initial={false} animate={{y:hovered&&!disabled&&!reduceMotion?-2:0}}
    transition={reduceMotion?{duration:0}:{type:'spring',stiffness:200,damping:10,mass:1}}>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" x2="12" y1="3" y2="15"/>
   </motion.g>
  </svg>
  {children}
 </Button>;
}
