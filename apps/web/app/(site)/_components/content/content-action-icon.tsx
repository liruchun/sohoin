"use client";

// lucide-animated by pqoqubbw (MIT); see apps/web/LICENSE.lucide-animated.
// Source variants/paths: https://lucide-animated.com/r/{heart,smile,message-circle,bookmark}.json
// Keep the source motion values; only host sizing and reduced motion differ.
import {useReducedMotionPreference} from "@sohoin/ui/theme-provider";
import {motion,type Variants} from "motion/react";
import {useState} from "react";
import {MessagesSquare} from "lucide-react";
import styles from "./content-action-icon.module.css";

export type ContentActionIconName="smile"|"heart"|"comment"|"reply"|"discussion"|"bookmark";
const MotionMessagesSquare=motion.create(MessagesSquare);
const heartPath="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";
const commentPath="M7.9 20A9 9 0 1 0 4 16.1L2 22Z";
const bookmarkPath="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z";
const mouthPath="M8 14s1.5 2 4 2 4-2 4-2";
const heart:Variants={normal:{scale:1},animate:{scale:[1,1.08,1]},reduced:{scale:1,transition:{duration:0,repeat:0}}};
const comment:Variants={
 normal:{scale:1,rotate:0},
 reduced:{scale:1,rotate:0,transition:{duration:0}},
 animate:{scale:1.05,rotate:[0,-7,7,0],transition:{rotate:{duration:.5,ease:"easeInOut"},scale:{type:"spring",stiffness:400,damping:10}}},
};
const bookmark:Variants={normal:{scaleY:1,scaleX:1},animate:{scaleY:[1,1.3,.9,1.05,1],scaleX:[1,.9,1.1,.95,1],transition:{duration:.6,ease:"easeOut"}},reduced:{scaleY:1,scaleX:1,transition:{duration:0}}};
const face:Variants={
 reduced:{scale:1,rotate:0,strokeWidth:2,transition:{duration:0}},
 normal:{scale:1,rotate:0,strokeWidth:2,transition:{duration:.3,ease:"easeOut"}},
 animate:{scale:[1,1.15,1.05,1.1],rotate:[0,-3,3,0],strokeWidth:[2,2.5,2.5,2.5],transition:{duration:.8,times:[0,.3,.6,1],ease:"easeInOut"}},
};
const mouth:Variants={
 reduced:{d:mouthPath,pathLength:1,pathOffset:0,strokeWidth:2,transition:{duration:0}},
 normal:{d:mouthPath,pathLength:1,pathOffset:0,strokeWidth:2,transition:{duration:.3,ease:"easeOut"}},
 animate:{d:"M7 13.5s2.5 3.5 5 3.5 5-3.5 5-3.5",pathLength:[.3,1,1],pathOffset:[0,0,0],strokeWidth:2.5,transition:{d:{duration:.4,ease:"easeOut"},pathLength:{duration:.5,times:[0,.5,1],ease:"easeInOut"},delay:.1}},
};
const eye:Variants={
 reduced:{scale:1,opacity:1,transition:{duration:0}},
 normal:{scale:1,opacity:1,transition:{duration:.3,ease:"easeOut"}},
 animate:{scale:[1,1.5,.8,1.2],opacity:[1,1,1,1],transition:{duration:.5,times:[0,.3,.6,1],ease:"easeInOut"}},
};
const svgProps={width:"1rem",height:"1rem",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true,focusable:false} as const;

export function ContentActionIcon({name,active}:{name:ContentActionIconName;active:boolean}){
 const reduce=useReducedMotionPreference();
 const [activated,setActivated]=useState(active);
 if(active&&!activated)setActivated(true);
 // Lucide's paired bubbles use the existing conversation hover motion.
 if(name==="discussion"||name==="reply")return !activated&&!active
  ?<MessagesSquare {...svgProps}/>
  :<MotionMessagesSquare {...svgProps} initial="normal" animate={reduce?"reduced":active?"animate":"normal"} variants={comment}/>;
 // The initial normal pose has no animation. Mount Motion's SVG controllers
 // on first interaction, keeping them thereafter for the original return motion.
 // All code is already loaded; the first hover does not request a module.
 if(!activated&&!active)return <svg {...svgProps}>
  {name==="heart"?<path d={heartPath}/>:name==="comment"?<path d={commentPath}/>:name==="bookmark"?<path d={bookmarkPath}/>:<>
   <circle cx="12" cy="12" r="10"/>
   <g className={styles.details}><path d={mouthPath}/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></g>
  </>}
 </svg>;
 // Keep the same SSR/hydration tree and jump to the static pose when reduced.
 const state=reduce?"reduced":active?"animate":"normal";
 if(name==="heart")return <motion.svg {...svgProps} initial="normal" animate={state} variants={heart} transition={{duration:.45,repeat:2}}><path d={heartPath}/></motion.svg>;
 if(name==="comment")return <motion.svg {...svgProps} initial="normal" animate={state} variants={comment}><path d={commentPath}/></motion.svg>;
 if(name==="bookmark")return <svg {...svgProps}><motion.path d={bookmarkPath} initial="normal" animate={state} variants={bookmark} style={{originY:.5,originX:.5}}/></svg>;
 return <motion.svg {...svgProps} initial="normal" animate={state} variants={face}>
  <motion.circle cx="12" cy="12" r="10"/>
  <g className={styles.details}>
   <motion.path d={mouthPath} initial="normal" animate={state} variants={mouth}/>
   <motion.line x1="9" x2="9.01" y1="9" y2="9" initial="normal" animate={state} variants={eye}/>
   <motion.line x1="15" x2="15.01" y1="9" y2="9" initial="normal" animate={state} variants={eye}/>
  </g>
 </motion.svg>;
}
