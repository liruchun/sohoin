import type {MetadataRoute} from "next";
import {settingsService} from "@/lib/settings";
export const dynamic="force-dynamic";
export default async function manifest():Promise<MetadataRoute.Manifest>{
 const {settings,revision}=await settingsService.readPublic();
 return {id:"/",name:settings.siteName,short_name:Array.from(settings.siteName).slice(0,12).join(""),description:settings.description,start_url:"/",scope:"/",display:"standalone",background_color:"#f8f8f7",theme_color:"#f8f8f7",
  icons:settings.icons.app?[
   {src:`/api/v1/site-icon/app-192?v=${revision}`,sizes:"192x192",type:"image/png",purpose:"any"},
   {src:`/api/v1/site-icon/app-512?v=${revision}`,sizes:"512x512",type:"image/png",purpose:"any"},
   {src:`/api/v1/site-icon/maskable-512?v=${revision}`,sizes:"512x512",type:"image/png",purpose:"maskable"},
  ]:[],
 };
}
