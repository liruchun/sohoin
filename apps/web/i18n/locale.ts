export const locales = ["zh-CN", "en"] as const;
export type SiteLocale = (typeof locales)[number];
export const localeCookie = "sohoin-locale";
export const defaultLocale: SiteLocale = "zh-CN";

export function isSiteLocale(value: unknown): value is SiteLocale {
  return value === "zh-CN" || value === "en";
}

export function preferredLocale(cookie: string | undefined, acceptLanguage: string | null): SiteLocale {
  if (isSiteLocale(cookie)) return cookie;
  const languages = (acceptLanguage ?? "").slice(0, 2048).split(",").map((entry) => {
    const [language, ...parameters] = entry.trim().toLowerCase().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    return {language, weight: quality ? Number(quality.trim().slice(2)) : 1};
  }).filter(({weight}) => Number.isFinite(weight) && weight > 0 && weight <= 1)
    .sort((a, b) => b.weight - a.weight);
  for (const {language} of languages) {
    if (language === "en" || language.startsWith("en-")) return "en";
    if (language === "zh" || language.startsWith("zh-")) return "zh-CN";
  }
  return defaultLocale;
}
