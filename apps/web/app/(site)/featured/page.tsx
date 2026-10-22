import {FeedPage,feedMetadata,type FeedSearch} from "../_features/feed/feed-page";

// Match the home feed's native page-scoped Router Cache policy.
export const unstable_dynamicStaleTime=30;
export async function generateMetadata({searchParams}:{searchParams:Promise<FeedSearch>}){
 const {after}=await searchParams;
 return feedMetadata("featured",after);
}
export default async function FeaturedPage({searchParams}:{searchParams:Promise<FeedSearch>}){
 const {after}=await searchParams;
 return <FeedPage view="featured" after={after}/>;
}
