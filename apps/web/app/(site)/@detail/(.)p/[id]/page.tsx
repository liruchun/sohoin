import {DetailLayer} from "../../../_features/content/detail-layer";
import {Discussion,discussionMetadata,type DiscussionSearch} from "../../../_features/content/discussion";
import {DiscussionContent} from "../../../_features/content/discussion-skeleton";
// Reuse completed comments on short revisits, matching the feed's native cache.
// Supported by pinned Next 16.4.1; review this unstable API on upgrades.
export const unstable_dynamicStaleTime=30;
type Props={params:Promise<{id:string}>;searchParams:Promise<DiscussionSearch>};
export async function generateMetadata({params,searchParams}:Props){return discussionMetadata((await params).id,"article",await searchParams);}
export default async function Page({params,searchParams}:Props){
 const [{id},query]=await Promise.all([params,searchParams]);
 return <DetailLayer>
  <DiscussionContent waitKey={JSON.stringify(query)}>
   <Discussion id={id} type="article" query={query} validate/>
  </DiscussionContent>
 </DetailLayer>;
}
