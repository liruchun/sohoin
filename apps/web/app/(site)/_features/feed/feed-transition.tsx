"use client";
import {useTranslations} from "next-intl";


import {useState,type ReactNode} from "react";
import {SkeletonBoundary,SkeletonContent,skeletonBoundaryEntry} from "@sohoin/ui/skeleton-reveal";

export function FeedTransition({destination,children,skeleton,documentEntry}:{destination:string;children:ReactNode;skeleton:ReactNode;documentEntry:boolean}){
 const t=useTranslations("Web");
 const [previous,setPrevious]=useState({key:destination,documentEntry});
 const entry=skeletonBoundaryEntry(previous,destination,false);
 if(entry!==previous)setPrevious(entry);
 return <SkeletonBoundary key={entry.key}>
  {/* Only a real document entry belongs to the outer SSR Splash. The first
      SPA visit, as well as later filters, waits inside the list alone. */}
  {entry.documentEntry?children:<SkeletonContent suspend label={t("loadingPosts")} fallback={skeleton}>{children}</SkeletonContent>}
 </SkeletonBoundary>;
}
