import {readSiteContent} from "@/lib/site";
import {type DiscussionSearch} from "../../_features/content/discussion";
import {ContentPage,contentMetadata} from "../../_features/content/content-page";
// Same bounded native route cache as the intercepted detail (Next 16.4.1).
export const unstable_dynamicStaleTime=30;
export async function generateMetadata({params}:{params:Promise<{id:string}>}){return contentMetadata((await params).id,"post");}
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<DiscussionSearch>}){const [{id},query]=await Promise.all([params,searchParams]);await readSiteContent(id,"post");return <ContentPage id={id} type="post" query={query}/>;}
