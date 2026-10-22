"use client";
import {usePathname,useSearchParams} from "next/navigation";
import {parseCommunitySort} from "./community-route";
import {CommunitySortTabs} from "./community-sort-tabs";

/** Lives in the layout above the page main, so sort switches keep the tabs mounted. */
export function CommunitySortBar(){
 const pathname=usePathname(),search=useSearchParams();
 const slug=/^\/community\/([^/]+)\/?$/.exec(pathname)?.[1];
 if(!slug)return null;
 return <CommunitySortTabs slug={slug} sort={parseCommunitySort(search.get("sort"))}/>;
}
