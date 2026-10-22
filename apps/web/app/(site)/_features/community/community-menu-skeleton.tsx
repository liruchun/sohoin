import styles from "./community-menu.module.css";

/** Header-only placeholder used until the page publishes the current topic. */
export function CommunityMenuSkeleton(){
 return <div className={styles.menu} aria-hidden="true">
  <span className={`${styles.skeletonBlock} ${styles.skeletonIcon}`}/>
  <div className={styles.identity}>
   <span className={`${styles.skeletonBlock} ${styles.skeletonTitle}`}/>
   <span className={`${styles.skeletonBlock} ${styles.skeletonDescription}`}/>
  </div>
  <span className={`${styles.skeletonBlock} ${styles.skeletonJoin}`}/>
 </div>;
}
