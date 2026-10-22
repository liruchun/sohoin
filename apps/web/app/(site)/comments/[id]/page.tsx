import {readSiteContent} from "@/lib/site";
import {ContentPage} from "../../_features/content/content-page";
import {discussionMetadata,type DiscussionSearch} from "../../_features/content/discussion";
export const unstable_dynamicStaleTime=30;
type Props={params:Promise<{id:string}>;searchParams:Promise<DiscussionSearch>};
export async function generateMetadata({params,searchParams}:Props){return discussionMetadata((await params).id,"comment",await searchParams);}
export default async function Page({params,searchParams}:Props){const [{id},query]=await Promise.all([params,searchParams]);await readSiteContent(id,"comment");return <ContentPage id={id} type="comment" query={query}/>;}
