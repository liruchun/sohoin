import {useTranslations} from "next-intl";
import {ReadingLink as Link} from "../../_components/feedback/reading-navigation";
import styles from "../feed/feed-pagination.module.css";
import {communityHref,type CommunitySort} from "./community-route";

export function CommunityPagination({slug,sort,after,next}:{slug:string|null;sort:CommunitySort;after?:string|null;next:string|null}){
 const t=useTranslations("Web");
 if(!after&&!next)return null;
 return <nav className={styles.pagination} aria-label={t("feedPagination")}>
  {after&&<Link className={styles.link} href={communityHref({slug,sort})}>{t("firstPage")}</Link>}
  {next&&<Link className={styles.link} href={communityHref({slug,sort,after:next})} prefetch={false}>{t("nextPage")}</Link>}
 </nav>;
}
