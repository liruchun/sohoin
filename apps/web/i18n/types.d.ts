import type messages from "./messages/zh-CN.json";
import type {SiteLocale} from "./locale";

declare module "next-intl" {
  interface AppConfig {
    Locale: SiteLocale;
    Messages: typeof messages;
  }
}
