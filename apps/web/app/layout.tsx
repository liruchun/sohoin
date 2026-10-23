import {settingsService} from "@/lib/settings";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import motion from "./_components/navigation/page-motion.module.css";
import {HistoryMotion} from "./_components/navigation/history-motion";
import {themeBootstrap} from "@sohoin/ui/theme-preference";
import {AppearanceProvider} from "./appearance-provider";
import {NextIntlClientProvider} from "next-intl";
import {getLocale} from "next-intl/server";
import defaultMessages from "@/i18n/messages/zh-CN.json";

export async function generateMetadata():Promise<Metadata> { const {settings,revision}=await settingsService.readPublic(); return {title:settings.siteName,description:settings.description,manifest:"/manifest.webmanifest",icons:{icon:settings.icons.favicon?[{url:`${settings.icons.favicon}?v=${revision}`,type:"image/png",sizes:"32x32"}]:[],apple:settings.icons.app?[{url:`/api/v1/site-icon/apple?v=${revision}`,type:"image/png",sizes:"180x180"}]:[]},appleWebApp:{capable:true,title:settings.siteName,statusBarStyle:"default"}}; }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale=await getLocale();
  return <html lang={locale} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head><body className={motion.scope}><HistoryMotion/><NextIntlClientProvider locale="zh-CN" messages={{UI:defaultMessages.UI}} timeZone="Asia/Shanghai"><AppearanceProvider>{children}</AppearanceProvider></NextIntlClientProvider></body></html>;
}
