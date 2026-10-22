import {ViewTransition,type ReactNode} from "react";
import styles from "./feed.module.css";

export function FeedFrame({children}:{children:ReactNode}){
 return <div className={styles.feed}><ViewTransition default="none" update={{"feed-forward":"reading-forward","feed-back":"reading-back",default:"none"}}><div className={styles.stream}>{children}</div></ViewTransition></div>;
}
