import {headers} from "next/headers";
import {notFound,redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {getSiteProfileForEditing,ServiceError} from "@sohoin/core/server";
import {ProfileEditor} from "./_components/profile-editor";
import {settingsService} from "@/lib/settings";

export async function generateMetadata(){
 const [t,{settings}]=await Promise.all([getTranslations("ProfileEditor"),settingsService.readPublic()]);
 return {title:`${t("title")} · ${settings.siteName}`,robots:{index:false,follow:false}};
}
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 let profile;
 try{profile=await getSiteProfileForEditing(id,await headers());}
 catch(error){
  if(error instanceof ServiceError){
   if(error.status===401)redirect("/admin/login");
   if(error.status===403||error.status===404)notFound();
  }
  throw error;
 }
 return <ProfileEditor profile={profile}/>;
}
