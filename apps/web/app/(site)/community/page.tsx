import type {Metadata} from "next";
import {CommunityPage,communityMetadata,type CommunitySearch} from "../_features/community/community-page";
import {parseCommunitySort} from "../_features/community/community-route";

export async function generateMetadata({searchParams}:{searchParams:Promise<CommunitySearch>}):Promise<Metadata>{
 return communityMetadata(null,await searchParams);
}
export default async function CommunityIndexPage({searchParams}:{searchParams:Promise<CommunitySearch>}){
 const search=await searchParams;
 return <CommunityPage slug={null} sort={parseCommunitySort(search.sort)} after={search.after}/>;
}
