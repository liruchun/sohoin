import type {Metadata} from "next";
import {CommunityPage,communityMetadata,type CommunitySearch} from "../../_features/community/community-page";
import {parseCommunitySort} from "../../_features/community/community-route";

export async function generateMetadata({params,searchParams}:{params:Promise<{topic:string}>;searchParams:Promise<CommunitySearch>}):Promise<Metadata>{
 const [{topic},search]=await Promise.all([params,searchParams]);
 return communityMetadata(topic,search);
}
export default async function CommunityTopicPage({params,searchParams}:{params:Promise<{topic:string}>;searchParams:Promise<CommunitySearch>}){
 const [{topic},search]=await Promise.all([params,searchParams]);
 return <CommunityPage slug={topic} sort={parseCommunitySort(search.sort)} after={search.after}/>;
}
