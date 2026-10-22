"use client";

import {ProfileNavigation} from "./profile-navigation";
import type {ReactNode} from "react";
import {usePathname,useSearchParams} from "next/navigation";
import {FeedNavigation,type FeedCategory} from "../../_features/feed/feed-navigation";
import {feedView} from "../../_features/feed/feed-route";
import {CommunityNavigation} from "../../_features/community/community-navigation";
import {communitySlug,parseCommunitySort} from "../../_features/community/community-route";
import {useDetailData} from "../../_features/content/detail-data";
import {DetailBack,DetailNavigation} from "../content/detail-panel";
import {useReadingReturn} from "../feedback/page-transition";
import {sitePageConfig} from "./site-page-config";
import {CommunityMenuSkeleton} from "../../_features/community/community-menu-skeleton";
import {CommunityHeaderMenu} from "../../_features/community/community-header-menu";
import {useCommunityHeader} from "../../_features/community/community-header-context";
import {SiteSearchSidebar} from "./site-search";
import styles from "./site-header.module.css";

export function SiteHeader({brand,tools,categories}:{brand:ReactNode;tools:ReactNode;categories:FeedCategory[]}){
 const pathname=usePathname(),search=useSearchParams();
 const {active}=useDetailData();
 const returning=useReadingReturn();
 const config=sitePageConfig(pathname);
 const detailActive=active;
 const headerTopic=useCommunityHeader()?.topic;
 const categorySlug=/^\/community\/([^/]+)\/?$/.exec(pathname)?.[1]??null;
 const categoryTopic=categorySlug&&headerTopic?.slug===categorySlug?headerTopic:null;
 const menus={
  profile:<ProfileNavigation/>,
  feed:<FeedNavigation view={feedView(pathname,search.get("feed"))} categories={categories}/>,
  community:<CommunityNavigation slug={communitySlug(pathname)} sort={parseCommunitySort(search.get("sort"))}/>,
  detail:<DetailNavigation back={<DetailBack onClick={detailActive?returning:undefined}/>}/>,
 };
 return <header className={styles.header} data-skeleton-chrome="" style={{viewTransitionName:"site-header"}}>
  <div className={styles.brand}>{brand}</div>
  <div className={styles.menu}>{categorySlug?(categoryTopic?<CommunityHeaderMenu topic={categoryTopic}/>:<CommunityMenuSkeleton/>):menus[config.header]}</div>
  <div className={styles.tools}>{tools}</div>
 </header>;
}

// Server-rendered right-column content stays outside the client bundle.
export function SitePageSidebar({feed,detail,profile}:{feed:ReactNode;detail:ReactNode;profile:ReactNode}){
 const config=sitePageConfig(usePathname());
 return <SiteSearchSidebar>{{feed,detail,profile,none:null}[config.sidebar]}</SiteSearchSidebar>;
}
