import "server-only";
import {SITE_ICON_SIZES} from "@sohoin/extension-api/media-limits";

/** Called only on upload/generation; public icon reads never run an image encoder. */
export async function buildSiteIcons(bytes:Buffer,svg:boolean){
 const {default:sharp}=await import("sharp");
 const options={limitInputPixels:20_000_000,failOn:"warning" as const};
 const metadata=await sharp(bytes,options).timeout({seconds:10}).metadata();
 const density=svg?Math.min(600,Math.max(72,72*512/Math.max(metadata.width??512,metadata.height??512))):72;
 const input={...options,density};
 const results=[];
 for(const [variant,size] of Object.entries(SITE_ICON_SIZES)){
  const favicon=variant==="favicon";
  // Opaque square backgrounds and safe inset prevent launcher masks cropping the mark.
  const inset=favicon?0:Math.ceil(size*(variant==="maskable-512"?0.2:0.1));
  let image=sharp(bytes,input).rotate().resize({width:size-inset*2,height:size-inset*2,fit:"contain",background:favicon?"#00000000":"#ffffff"});
  if(inset)image=image.extend({top:inset,bottom:inset,left:inset,right:inset,background:"#ffffff"}).flatten({background:"#ffffff"});
  const result=await image.png().timeout({seconds:10}).toBuffer({resolveWithObject:true});
  results.push({variant,data:result.data,width:result.info.width,height:result.info.height});
 }
 return results;
}
