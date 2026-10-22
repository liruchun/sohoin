"use client";

import {useState,type ReactNode} from "react";
import {usePathname,useSearchParams,useSelectedLayoutSegments} from "next/navigation";
import {SkeletonBoundary,SkeletonContent,skeletonBoundaryEntry} from "@sohoin/ui/skeleton-reveal";
import {FeedFrame} from "../../_features/feed/feed-frame";
import {FeedTransition} from "../../_features/feed/feed-transition";
import {feedView,isFeedPath} from "../../_features/feed/feed-route";
import {SiteMain} from "../shell/site-shell";
import shellStyles from "../shell/site-shell.module.css";

/** Only the transition is client-side; the layout supplies server-rendered slots. */
export function SiteTransition({children,skeleton,feedSkeleton,detailSkeleton,profileEditorSkeleton,documentEntry}:{children:ReactNode;skeleton:ReactNode;feedSkeleton:ReactNode;detailSkeleton:ReactNode;profileEditorSkeleton:ReactNode;documentEntry:boolean}){
 const pathname=usePathname(),search=useSearchParams();
 const destination=pathname+"?"+search.toString();
 const detail=useSelectedLayoutSegments("detail"),intercepted=detail.some(segment=>segment==="(.)p"||segment==="(.)threads"||segment==="(.)comments");
 const [background,setBackground]=useState({key:destination,documentEntry});
 const [feedLocation,setFeedLocation]=useState({pathname,search:search.toString()});
 // Retain only the displayed filter while the intercepted detail is open.
 // Data, routing and history remain owned by Next.
 if(isFeedPath(pathname)&&!intercepted&&(feedLocation.pathname!==pathname||feedLocation.search!==search.toString()))setFeedLocation({pathname,search:search.toString()});
 // Details retain their background. Feed routes and filters have a list-local
 // boundary, so they must not remount the menu or replay the page.
 const retain=intercepted||(isFeedPath(pathname)&&isFeedPath(background.key.split("?")[0]));
 const entry=skeletonBoundaryEntry(background,destination,retain);
 if(background!==entry)setBackground(entry);
 const home=isFeedPath(entry.key.split("?")[0]);
 const path=entry.key.split("?")[0];
 const fallback=/^\/members\/[^/]+\/edit\/?$/.test(path)?profileEditorSkeleton:/^\/(?:threads|comments|p)\/[^/]+$/.test(path)?detailSkeleton:skeleton;
 const feedParams=new URLSearchParams(feedLocation.search);
 const view=feedView(feedLocation.pathname,feedParams.get("feed"));
 const frame=<FeedFrame>
  <FeedTransition destination={JSON.stringify([view,feedParams.get("after")])} documentEntry={entry.documentEntry} skeleton={feedSkeleton}>{children}</FeedTransition>
 </FeedFrame>;
 const content=<SkeletonContent as="main" id="main-content" className={shellStyles.main} suspend={!entry.documentEntry} fallback={fallback}>{home?frame:children}</SkeletonContent>;
 const page=<SkeletonBoundary key={entry.key} inheritSplash>
  {/* A short streamed document fallback can clamp native reload restoration before
      React inserts the full feed. Hydration keeps this exact tree; only a real
      navigation changes the keyed boundary and enables its SPA fallback. */}
  {home&&!entry.documentEntry?<SiteMain>{frame}</SiteMain>:content}
 </SkeletonBoundary>;
 return page;
}
