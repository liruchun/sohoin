import {useTranslations} from "next-intl";
import styles from "./site-shell.module.css";
import type {ComponentProps,ReactNode} from "react";
import {cn} from "@sohoin/ui/utils";

export function SiteFrame({children,className}:{children:ReactNode;className?:string}){
 return <div className={cn(styles.frame,className)} data-skeleton-scene="">
  {/* Keep the snapshot name literal: CSS Modules scopes view-transition-name values. */}
  <span className={styles.dividers} aria-hidden="true" style={{viewTransitionName:"site-dividers"}}/>
  {children}
 </div>;
}

export function SiteContent({children,...props}:ComponentProps<"div">){
 return <div id="site-content" className={styles.content} tabIndex={-1} {...props}>{children}</div>;
}

export function SiteMain({children,id="main-content"}:{children:ReactNode;id?:string}){
 return <main id={id} className={styles.main}>{children}</main>;
}

export function SiteFooter({brand}:{brand:string}){
 const t=useTranslations("Web");
 return <footer className={styles.footer} data-skeleton-chrome="">{t("footerTagline",{brand})}</footer>;
}

export function SkipToContent(){
 const t=useTranslations("Web");
 return <a href="#site-content" className={styles.skip}>{t("skipContent")}</a>;
}
