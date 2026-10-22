import {useTranslations} from "next-intl";
import type {ReactNode} from "react";
import {SkeletonContent,SkeletonFallback} from "@sohoin/ui/skeleton-reveal";
import styles from "./discussion.module.css";

/** The initial discussion wait keeps both placeholder rows; incremental batches
 *  (more comments, more replies) ask for a single one. */
export function DiscussionSkeleton({rows=2}:{rows?:number}){
 return <section className={styles.section} aria-hidden="true">
  <div className={styles.threads}>
   {[0,1].map(index=><div key={index} className={styles.thread} data-skeleton-item="">
    <div className={`${styles.placeholder} ${styles.card}`}>
     <span className={styles.avatarPlaceholder} data-skeleton-part="block" data-skeleton-placeholder=""/>
     <div className={styles.content}>
     <div className={styles.heading}><div className={styles.meta}>
      <span className={styles.namePlaceholder} data-skeleton-part="name" data-skeleton-placeholder=""/>
      <span className={styles.datePlaceholder} data-skeleton-part="meta" data-skeleton-placeholder=""/>
     </div><span className={styles.menuPlaceholder} data-skeleton-part="menu" data-skeleton-placeholder=""/></div>
     <span className={styles.linePlaceholder} data-skeleton-part="body" data-skeleton-placeholder=""/>
     <span className={styles.shortPlaceholder} data-skeleton-part="body" data-skeleton-placeholder=""/>
     <div className={styles.actionsPlaceholder}>
      <span className={styles.actionPlaceholder} data-skeleton-part="action" data-skeleton-placeholder=""/>
      <div className={styles.toolsPlaceholder}>{[0,1,2].map(action=><span key={action} className={styles.actionPlaceholder} data-skeleton-part="action" data-skeleton-placeholder=""/>)}</div>
     </div>
     </div>
    </div>
   </div>).slice(0,rows)}
  </div>
 </section>;
}

export function DiscussionPending(){
 const t=useTranslations("Web");
 return <SkeletonFallback label={t("loadingDiscussion")}><DiscussionSkeleton/></SkeletonFallback>;
}

/** A server-created response token survives native route cache reuse, while a
 * newly fetched response gets a fresh token even when its text is unchanged. */
export function DiscussionContent({children,waitKey}:{children:ReactNode;waitKey:string}){
 const t=useTranslations("Web");
 return <SkeletonContent key={waitKey} suspend revealToken={{}} label={t("loadingDiscussion")} fallback={<DiscussionSkeleton/>}>{children}</SkeletonContent>;
}
