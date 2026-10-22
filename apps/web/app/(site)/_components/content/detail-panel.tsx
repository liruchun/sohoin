import {useTranslations} from "next-intl";
import styles from "./detail-panel.module.css";
import {ReadingLink as Link} from "../feedback/page-transition";
import {ArrowLeft} from "lucide-react";
import {Button} from "@sohoin/ui/button";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import type {ReactNode} from "react";
import {PostComposer} from "./post-composer";

export function DetailBack({onClick,href="/",label}:{onClick?:()=>void;href?:string;label?:string}){
 const t=useTranslations("Web");
 const surface=<MagneticSurface className={styles.backSurface}><ArrowLeft size="1em" strokeWidth={1.75} aria-hidden="true"/>{t("back")}</MagneticSurface>;
 return onClick
  ?<Button variant="plain" className={styles.back} onClick={onClick} aria-label={label??t("backCommunity")}>{surface}</Button>
  :<Button variant="plain" asChild className={styles.back}><Link href={href} transitionTypes={["detail-back"]} aria-label={label??t("backCommunity")}>{surface}</Link></Button>;
}

export function DetailNavigation({back}:{back?:ReactNode}){
 const t=useTranslations("Web");
 return <nav className={styles.navigation} aria-label={t("backNavigation")} data-detail-navigation="" data-skeleton-chrome="" data-magnetic-area="">
   {back??<DetailBack/>}
   <PostComposer className={styles.publish} surfaceClassName={styles.publishSurface}/>
  </nav>;
}

export function DetailPanel({children,title,as="article",discussion}:{children:ReactNode;title:string;as?:"article"|"section";discussion?:ReactNode}){
 const Panel=as;
 return <div className={styles.frame}>
  <Panel className={styles.panel} data-has-discussion={discussion?"":undefined} data-skeleton-item="">
  <h1 className={styles.title} data-skeleton-part="title">{title}</h1>
  {children}
  </Panel>
  {discussion}
 </div>;
}
