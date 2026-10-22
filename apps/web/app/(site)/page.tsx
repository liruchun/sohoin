import {permanentRedirect} from "next/navigation";
import {FeedPage,feedMetadata,type FeedSearch} from "./_features/feed/feed-page";
import {feedHref,feedView} from "./_features/feed/feed-route";

// Next 16.4 page-scoped Router Cache reuse; review on upgrades.
export const unstable_dynamicStaleTime=30;
function homeView(search:FeedSearch){
 if(search.feed==="featured")permanentRedirect(feedHref("featured",search.after));
 return feedView("/",search.feed??null);
}
export async function generateMetadata({searchParams}:{searchParams:Promise<FeedSearch>}){
 const search=await searchParams;
 return feedMetadata(homeView(search),search.after);
}
export default async function HomePage({searchParams}:{searchParams:Promise<FeedSearch>}){
 const search=await searchParams;
 return <FeedPage view={homeView(search)} after={search.after}/>;
}
