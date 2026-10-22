import "server-only";
/** Width-based candidates; retain aspect ratio and never upscale. */
export async function buildResponsiveImages(bytes:Buffer,width:number,existing:readonly string[]=[]){
 const {default:sharp}=await import("sharp");
 const images=[];
 for(const size of [480,960,1440]){
  if(size>=width||existing.includes(`w${size}`))continue;
  const result=await sharp(bytes,{limitInputPixels:20_000_000,failOn:"warning"}).resize({width:size,withoutEnlargement:true}).webp({quality:82}).timeout({seconds:20}).toBuffer({resolveWithObject:true});
  images.push({variant:`w${size}`,data:result.data,width:result.info.width,height:result.info.height});
 }
 return images;
}
