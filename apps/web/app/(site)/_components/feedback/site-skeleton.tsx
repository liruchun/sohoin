import styles from "./site-skeleton.module.css";
import postStyles from "../../_features/feed/post-card.module.css";
import {cn} from "@sohoin/ui/utils";

export function SiteSkeleton({listOnly=false,rows=2}:{listOnly?:boolean;rows?:1|2}){
 return <div className={listOnly?undefined:styles.panel} aria-hidden="true">
  {!listOnly&&<div className={styles.context} data-skeleton-context=""><span className={styles.label} data-skeleton-part="context" data-skeleton-placeholder=""/></div>}
  {Array.from({length:rows},(_,index)=><div className={cn(postStyles.post,styles.breathing)} key={index} data-skeleton-item="" aria-hidden="true">
   <div className={postStyles.heading}>
    <span className={styles.avatar} data-skeleton-part="block" data-skeleton-placeholder=""/>
    <span className={styles.name} data-skeleton-part="name" data-skeleton-placeholder=""/>
    <span className={styles.menu} data-skeleton-part="menu" data-skeleton-placeholder=""/>
   </div>
   <div className={postStyles.content}>
    <div className={styles.body}>
     <span className={styles.line} data-skeleton-part="body" data-skeleton-placeholder=""/>
     <span className={styles.shortLine} data-skeleton-part="body" data-skeleton-placeholder=""/>
    </div>
    <div className={styles.actions}>
     <span className={cn(styles.action,styles.reactionAction)} data-skeleton-part="action" data-skeleton-action="reaction" data-skeleton-placeholder=""/>
     <div className={styles.tools}>
      <span className={cn(styles.action,styles.commentAction)} data-skeleton-part="action" data-skeleton-action="comment" data-skeleton-placeholder=""/>
      <span className={styles.action} data-skeleton-part="action" data-skeleton-action="bookmark" data-skeleton-placeholder=""/>
     </div>
    </div>
   </div>
  </div>)}
 </div>;
}
