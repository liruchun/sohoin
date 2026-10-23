import {useTranslations} from "next-intl";
import {Flame,HeartHandshake} from "lucide-react";
import type {ReactNode} from "react";
import {Button} from "@sohoin/ui/button";
import {ReadingLink as Link} from "../../_components/feedback/reading-navigation";
import {PostComposer} from "../../_components/content/post-composer";
import feedStyles from "../feed/feed.module.css";
import {communityHref,type CommunitySort} from "./community-route";

/** Community tabs reuse the feed navigation language: 最新 / 热门 / 我的互动. */
export function CommunityNavigation({slug,sort}:{slug:string|null;sort:CommunitySort}){
 const t=useTranslations("Web");
 const tab=(value:CommunitySort,label:string,icon:ReactNode)=><Button key={value} asChild variant="plain" className={feedStyles.tab} data-skeleton-chrome-item="">
  <Link scroll={false} href={communityHref({slug,sort:value})} aria-current={sort===value?"page":undefined}>
   {icon}<span className={feedStyles.label}>{label}</span>
  </Link>
 </Button>;
 return <nav className={feedStyles.navigation} aria-label={t("communityNavigation")} data-skeleton-chrome-group="" data-magnetic-area="">
  {tab("latest",t("tabLatest"),<svg className={feedStyles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
   <circle cx="12" cy="12" r="10"/>
   <line className={feedStyles.clockHand} x1="12" x2="12" y1="12" y2="6"/>
   <line className={feedStyles.minuteHand} x1="12" x2="16" y1="12" y2="12"/>
  </svg>)}
  {tab("hot",t("hot"),<Flame className={feedStyles.icon} aria-hidden="true"/>)}
  {tab("mine",t("myInteractions"),<HeartHandshake className={feedStyles.icon} aria-hidden="true"/>)}
  <PostComposer className={feedStyles.publish} surfaceClassName={feedStyles.publishSurface}/>
 </nav>;
}
