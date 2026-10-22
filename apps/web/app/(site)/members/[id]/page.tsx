import {getTranslations} from "next-intl/server";
import {headers} from 'next/headers';
import {getVisibleMemberContacts} from '@sohoin/core/server';
import {ProfileContacts} from './_components/profile-contacts';
import {ProfilePanel} from "./_components/profile-panel";
import {settingsService} from "@/lib/settings";
import {readSiteProfile,robotsFor,absolute,indexingEnabled,JsonLd} from "@/lib/site";
export async function generateMetadata({params}:{params:Promise<{id:string}>}){
  const t=await getTranslations("Web");const [p,{settings}]=await Promise.all([readSiteProfile((await params).id),settingsService.readPublic()]);return {title:p.name+" · "+settings.siteName,description:p.bio||t("profileDescription",{brand:settings.siteName}),robots:robotsFor(p.demo),alternates:{canonical:absolute("/members/"+p.publicId)}};}
 export default async function Page({params}:{params:Promise<{id:string}>}){
  const p=await readSiteProfile((await params).id);
  const contacts=await getVisibleMemberContacts(await headers(),p.publicId);
  return <>
   <ProfilePanel profile={p}><ProfileContacts contacts={contacts}/></ProfilePanel>
   {indexingEnabled()&&!p.demo&&<JsonLd value={{"@context":"https://schema.org","@type":"ProfilePage",url:absolute("/members/"+p.publicId),mainEntity:{"@type":"Person",name:p.name,description:p.bio,url:absolute("/members/"+p.publicId)}}}/>}
  </>;
 }
