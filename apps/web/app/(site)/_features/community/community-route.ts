export type CommunitySort="latest"|"hot"|"mine";
export function parseCommunitySort(value:string|null|undefined):CommunitySort{
 return value==="hot"||value==="mine"?value:"latest";
}
/** Topic feeds keep the sort in the query string so the default (latest) URL stays
 *  canonical: /community, /community/{slug}, then ?sort=hot|mine and ?after=… . */
export function communityHref(input:{slug?:string|null;sort?:CommunitySort|string|null;after?:string|null}={}){
 const path="/community"+(input.slug?"/"+encodeURIComponent(input.slug):"");
 const params=new URLSearchParams();
 if(input.sort==="hot"||input.sort==="mine")params.set("sort",input.sort);
 if(input.after)params.set("after",input.after);
 return path+(params.size?"?"+params.toString():"");
}
/** The community section owns exactly one path segment after /community. */
export function communitySlug(pathname:string){
 const prefix="/community/";
 if(pathname===prefix.slice(0,-1)||!pathname.startsWith(prefix))return null;
 const rest=pathname.slice(prefix.length);
 if(!rest||rest.includes("/"))return null;
 try{return decodeURIComponent(rest);}catch{return null;}
}
