import type {SiteView} from "@sohoin/core/server";

export function isFeedPath(pathname:string){return pathname==="/"||pathname==="/featured";}
export function feedView(pathname:string,feed:string|null):SiteView{
 return pathname==="/featured"||feed==="featured"?"featured":feed==="articles"?"articles":"latest";
}
export function feedHref(view:SiteView,after?:string){
 const params=new URLSearchParams();
 if(view==="articles")params.set("feed",view);
 if(after)params.set("after",after);
 return (view==="featured"?"/featured":"/")+(params.size?"?"+params.toString():"");
}
