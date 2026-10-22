export type ContentHref={type:string;publicId:string;slug?:string|null;categorySlug?:string|null};
/** Comments and articles stay flat; community posts open as threads. */
export const publicHref=(type:string,id:string)=>(type==="comment"?"/comments/":type==="post"?"/threads/":"/p/")+id;
export function contentHref(content:ContentHref){
 return publicHref(content.type,content.publicId);
}
