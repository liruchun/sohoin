import {PageMotion} from "../_components/navigation/page-motion";
import {getReactionTypes} from "@sohoin/core/server";
import {getSiteMedals} from "@sohoin/core/server";
import {SiteMedalsProvider} from "./_components/shell/site-medals";
import {settingsService} from "@/lib/settings";
import {headers} from "next/headers";
import {NextIntlClientProvider} from "next-intl";
import {getLocale,getMessages} from "next-intl/server";
import {SkeletonBoundary} from "@sohoin/ui/skeleton-reveal";
import {ToastProvider} from "@sohoin/ui/toast";
import type {ReactNode} from "react";
import {SiteSidebar} from "./_components/shell/site-sidebar";
import {SiteHeader,SitePageSidebar} from "./_components/shell/site-header";
import {SiteBrand} from "./_components/shell/site-brand";
import {SiteSearch,SiteSearchProvider} from "./_components/shell/site-search";
import {SiteRecommendations} from "./_components/shell/site-recommendations";
import {SiteFrame,SiteFooter,SiteContent,SkipToContent} from "./_components/shell/site-shell";
import {SiteTransition} from "./_components/feedback/site-transition";
import {DetailSkeleton} from "./_features/content/detail-skeleton";
import {SiteSplash} from "./_components/feedback/site-splash";
import {SiteSkeleton} from "./_components/feedback/site-skeleton";
import {ProfileEditorSkeleton} from './members/[id]/edit/_components/profile-editor-skeleton';
import {CommunitySortBar} from "./_features/community/community-sort-bar";
import {readCommunityTopics} from "./_features/community/community-topic";
import {CommunityHeaderProvider} from "./_features/community/community-header-context";
import {ProfileHeaderProvider} from "./_components/shell/profile-header-context";
import {cn} from "@sohoin/ui/utils";
import styles from "./layout.module.css";
import {DetailDataProvider,DetailBackground} from "./_features/content/detail-data";
import {DiscussionComposerProvider} from "./_components/content/discussion-composer-provider";
import transitionStyles from "./_components/feedback/lightbox-transition.module.css";
export const dynamic="force-dynamic";
export default async function SiteLayout({children,detail}:{children:ReactNode;detail:ReactNode}){
 const requestHeaders=await headers();
 const [{settings},catalog,locale,messages,topics,medals]=await Promise.all([settingsService.readPublic(),getReactionTypes(),getLocale(),getMessages(),readCommunityTopics(),getSiteMedals(requestHeaders)]);
 // Fetch Metadata is a browser request hint, not an authorization decision.
 // Fetch/RSC requests use `empty`; absent headers conservatively get full SSR.
 const documentEntry=requestHeaders.get("sec-fetch-dest")!=="empty";
 return <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Shanghai"><DetailDataProvider brand={settings.siteName} logo={settings.logo} reactionOptions={catalog.items}>
  <SiteFrame className={cn("public-site",styles.surface,transitionStyles.scope)}>
  <ToastProvider>
  <SiteMedalsProvider initial={medals}>
  <SkeletonBoundary splash={<SiteSplash brand={settings.siteName}/>}>
  <SkipToContent/>
  <SiteSearchProvider>
  <CommunityHeaderProvider>
  <ProfileHeaderProvider>
  <SiteHeader categories={topics.map(({name,slug})=>({name,slug}))} brand={<SiteBrand brand={settings.siteName} logo={settings.logo}/>} tools={<SiteSearch brand={settings.siteName}/>}/><SiteSidebar brand={settings.siteName}/>
  <PageMotion><SiteContent data-page-motion="">
  <DiscussionComposerProvider>
  <DetailBackground>
  <CommunitySortBar/>
  <SiteTransition documentEntry={documentEntry} skeleton={<SiteSkeleton listOnly/>} feedSkeleton={<SiteSkeleton listOnly/>} detailSkeleton={<DetailSkeleton/>} profileEditorSkeleton={<ProfileEditorSkeleton/>}>{children}</SiteTransition>
  <SiteFooter brand={settings.siteName}/>
  </DetailBackground>
  {detail}
  </DiscussionComposerProvider>
  </SiteContent></PageMotion>
  </ProfileHeaderProvider>
  </CommunityHeaderProvider>
  <SitePageSidebar feed={<SiteRecommendations/>} detail={<SiteRecommendations variant="detail"/>} profile={<SiteRecommendations variant="profile"/>}/>
  </SiteSearchProvider>
  </SkeletonBoundary>
  </SiteMedalsProvider>
  </ToastProvider>
  </SiteFrame>
  </DetailDataProvider></NextIntlClientProvider>;
}
