import {feedView,isFeedPath} from "../../_features/feed/feed-route";

/** Distinct pages must not share geometry when Next restores document scroll.
 * Encode the full route without collisions or CSS identifier punctuation. */
export function pageTransitionName(pathname:string,search:string){
 return "site-page-"+Array.from(pathname+(search?"?"+search:"")).map(character=>character.codePointAt(0)!.toString(16)).join("-");
}

/** Feed tabs move only the list; every other reading link moves the content column. */
export function readingTransitionTypes(pathname:string,feed:string|null,href:string,feedTab=false):string[]{
 if(!feedTab||!isFeedPath(pathname)||!isFeedPath(href))return ["detail-forward"];
 const current=feedView(pathname,feed),target=feedView(href,null);
 if(current===target)return [];
 return [target==="featured"?"feed-forward":"feed-back"];
}
