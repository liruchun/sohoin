import {FeedPage,feedMetadata,type FeedSearch} from "../_features/feed/feed-page";

// Personalized results are evaluated on each forward navigation.
export const unstable_dynamicStaleTime=0;
export async function generateMetadata({searchParams}:{searchParams:Promise<FeedSearch>}){
 const {after}=await searchParams;
 return feedMetadata("circle",after);
}
export default async function CirclePage({searchParams}:{searchParams:Promise<FeedSearch>}){
 const {after}=await searchParams;
 return <FeedPage view="circle" after={after}/>;
}
