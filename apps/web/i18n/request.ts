import {cookies, headers} from "next/headers";
import {getRequestConfig} from "next-intl/server";
import {localeCookie, preferredLocale} from "./locale";

export default getRequestConfig(async () => {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = preferredLocale(cookieStore.get(localeCookie)?.value, requestHeaders.get("accept-language"));
  const messages = locale === "en"
    ? (await import("./messages/en.json")).default
    : (await import("./messages/zh-CN.json")).default;
  return {locale, messages, timeZone: "Asia/Shanghai"};
});
