import {useTranslations} from "next-intl";
import styles from "./site-recommendations.module.css";


// Static layout samples only: no published records, destinations or engagement counts.


export function SiteRecommendations({variant="feed"}:{variant?:"feed"|"detail"|"profile"}){
 const t=useTranslations("Web");
 const recommendations=[
 {title:t("firstWebsite"),category:t("buildNotes")},
 {title:t("homeDesign"),category:t("designExperience")},
 {title:t("launchChecklist"),category:t("operationsNotes")},
 {title:t("bookmarkedTools"),category:t("toolSharing")},
];
 return <aside className={styles.sidebar} aria-label={t("recommendedReadingTopics")} data-skeleton-chrome-group="">
  {variant!=="profile"&&<ul className={styles.recommendations} aria-label={t("recommendedReading")}>
   {(variant==="detail"?recommendations.slice(0,2):recommendations).map(item=><li data-skeleton-chrome-item="" key={item.title} className={styles.item}>
    <p className={styles.title}><span data-nosnippet="">{item.title}</span></p>
    <p className={styles.category}><span data-nosnippet="">{item.category}</span></p>
   </li>)}
  </ul>}
  <div className={styles.banners} data-nosnippet="">
   <section data-skeleton-chrome-item="" className={styles.journal}>
    <h2 className={styles.bannerTitle}>{t("websiteJournal")}</h2>
    <p className={styles.bannerDescription}>{t("ideasToWebsites")}</p>
   </section>
   <section data-skeleton-chrome-item="" className={styles.stories}>
    <h2 className={styles.bannerTitle}>{t("websiteStories")}</h2>
    <p className={styles.bannerDescription}>{t("creatingEveryday")}</p>
   </section>
  </div>
 </aside>;
}
