import {useTranslations} from "next-intl";
import styles from "./feed-pagination.module.css";
import {ReadingLink as Link} from "../../_components/feedback/reading-navigation";
import type {SiteView} from "@sohoin/core/server";
import {feedHref} from "./feed-route";


export function FeedPagination({view,after,next}:{view:SiteView;after?:string;next:string|null}){
 const t=useTranslations("Web");
 if(!after&&!next)return null;
 return <nav className={styles.pagination} aria-label={t("feedPagination")}>
  {after&&<Link className={styles.link} href={feedHref(view)}>{t("firstPage")}</Link>}
  {next&&<Link className={styles.link} href={feedHref(view,next)} prefetch={false}>{t("nextPage")}</Link>}
 </nav>;
}
