import {useTranslations} from "next-intl";
import {ReadingLink as Link} from "../../_components/feedback/page-transition";
import {communityHref} from "./community-route";
import styles from "./community.module.css";

/** Inline topic index: every topic stays one click away above the community list. */
export function TopicStrip({topics,slug}:{topics:{name:string;slug:string}[];slug:string|null}){
 const t=useTranslations("Web");
 if(!topics.length)return null;
 return <nav className={styles.topics} aria-label={t("topicList")} data-skeleton-chrome-group="">
  <Link scroll={false} className={styles.topic} href={communityHref({})} aria-current={slug===null?"page":undefined}>{t("allTopics")}</Link>
  {topics.map(topic=><Link key={topic.slug} scroll={false} className={styles.topic} href={communityHref({slug:topic.slug})} aria-current={slug===topic.slug?"page":undefined}>{topic.name}</Link>)}
 </nav>;
}
