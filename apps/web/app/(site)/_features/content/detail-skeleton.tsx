import styles from "./detail-skeleton.module.css";

/** Detail-shaped placeholder used while the route or a fresh response is waiting.
 *  Real content still drives the measured skeleton after it arrives. */
export function DetailSkeleton({rows=4}:{rows?:number}){
 return <div className={styles.frame} data-skeleton-item="" aria-hidden="true">
  <div className={styles.panel}>
   <span className={styles.title} data-skeleton-part="title" data-skeleton-placeholder=""/>
   <div className={styles.meta}>
    <span className={styles.avatar} data-skeleton-part="circle" data-skeleton-placeholder=""/>
    <span className={styles.name} data-skeleton-part="name" data-skeleton-placeholder=""/>
    <span className={styles.category} data-skeleton-part="category" data-skeleton-placeholder=""/>
    <span className={styles.date} data-skeleton-part="meta" data-skeleton-placeholder=""/>
   </div>
   <div className={styles.body}>
    {Array.from({length:rows},(_,index)=><span key={index} className={index===rows-1?styles.shortLine:styles.line} data-skeleton-part="body" data-skeleton-placeholder=""/>)}
   </div>
   <div className={styles.actions}>
    {Array.from({length:4},(_,index)=><span key={index} className={styles.action} data-skeleton-part="action" data-skeleton-placeholder=""/>)}
   </div>
  </div>
 </div>;
}
