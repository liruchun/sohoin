import {useTranslations} from "next-intl";
import styles from "./site-sidebar.module.css";
import {Button} from "@sohoin/ui/button";
import {SiteTabs} from "./site-tabs";

export function SiteSidebar({brand}:{brand:string}){
 const t=useTranslations("Web");
 return <aside className={styles.root} data-skeleton-chrome-group="" style={{viewTransitionName:"site-sidebar"}}>
  <SiteTabs/>
  <footer className={styles.footer} data-skeleton-chrome-item="" data-nosnippet="">
   <nav className={styles.links} aria-label={t("siteInfo")}>
    {[t("about"),t("terms"),t("contact")].map(label=><Button key={label} variant="plain" className={styles.textLink}>{label}</Button>)}
   </nav>
   <div className={styles.legal}>
    <p>© 2026 {brand}</p>
    <p>{t("tagline")}</p>
    <p>粤ICP备00000000号-1</p>
   </div>
  </footer>
 </aside>;
}
