import {getTranslations} from "next-intl/server";
import Link from "next/link";
import {settingsService} from "@/lib/settings";
export default async function NotFound(){
 const t=await getTranslations("Web");const {settings}=await settingsService.readPublic();return <main style={{maxWidth:"37.5rem",margin:"18vh auto",padding:"1.5rem",lineHeight:1.8}}><h1 style={{fontSize:"1.625rem"}}>{t("pageNotFound")}</h1><p>{t("invalidPage")}</p><Link href="/">{t("backHome",{brand:settings.siteName})}</Link></main>;}
