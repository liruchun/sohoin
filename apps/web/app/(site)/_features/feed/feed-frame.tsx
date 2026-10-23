import {type ReactNode} from "react";
import styles from "./feed.module.css";

export function FeedFrame({children}:{children:ReactNode}){
 return <div className={styles.feed}><div className={styles.stream}>{children}</div></div>;
}
