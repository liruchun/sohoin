import { z } from "zod";
import {contentIdSchema} from "./content";

const text = (max: number) => z.string().trim().max(max).refine(value => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), "含有无效控制字符");
export const navigationItemSchema = z.strictObject({
  label: text(32).min(1, "请输入导航名称"),
  href: z.string().trim().min(1).max(500).refine(value => {
    if (/[\s\\\u0000-\u001F]/.test(value)) return false;
    if (value.startsWith("#")) return value.length > 1;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
  }, "链接须为站内路径、锚点或 HTTPS 地址"),
  visible: z.boolean(),
});
export const settingsSchema = z.strictObject({
  siteName: text(60).min(1, "请输入站点名称"),
  description: text(240),
  logo: z.strictObject({normal:contentIdSchema.nullable(),dark:contentIdSchema.nullable()}),
  icons: z.strictObject({favicon:contentIdSchema.nullable(),app:contentIdSchema.nullable()}),
  navigation: z.array(navigationItemSchema).max(12),
  custom: z.strictObject({ headerNote: text(80) }),
});
export const settingsPatchSchema = settingsSchema.partial().extend({ custom: z.strictObject({headerNote: text(80).optional()}).optional() });
export const updateSettingsSchema = z.strictObject({ revision: z.number().int().nonnegative(), patch: settingsPatchSchema });
export const settingsSnapshotSchema = z.strictObject({ settings: settingsSchema, revision: z.number().int().nonnegative() });
export const publicSettingsSnapshotSchema = settingsSnapshotSchema.extend({settings:settingsSchema.extend({logo:z.strictObject({normal:z.string().nullable(),dark:z.string().nullable()}),icons:z.strictObject({favicon:z.string().nullable(),app:z.string().nullable()})})});
export type PublicSiteSettings = z.infer<typeof publicSettingsSnapshotSchema>["settings"];
export type SiteSettings = z.infer<typeof settingsSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export const coreSettingsDefaults: SiteSettings = {
  siteName: "sohoin", description: "soho人的生存指南。面向超级个体、独立开发者、独立站从业者、外贸人等，分享经验、交流想法，认识同行。",
  logo:{normal:null,dark:null},
  icons:{favicon:null,app:null},
  navigation: [{label:"内容",href:"#notes",visible:true},{label:"话题",href:"#topics",visible:true},{label:"关于",href:"#about",visible:true}],
  custom: {headerNote:""},
};
export function resolveSettings(saved: SettingsPatch, defaults: SettingsPatch = {}): SiteSettings {
  return settingsSchema.parse({...coreSettingsDefaults, ...defaults, ...saved, custom: {...coreSettingsDefaults.custom,...defaults.custom,...saved.custom}});
}
