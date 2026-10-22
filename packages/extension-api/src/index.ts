import type { PageOverrides, SiteRouting } from "./routes";
import type { SettingsPatch } from "./settings";
import type {PublicContent,ContentExtensionDefinition} from "./content";
import type { ComponentType, ReactNode } from "react";

export const EXTENSION_API_VERSION = 1 as const;
export interface HomeTitleProps { title: string }
export interface NavigationItem { label: string; href: string }
export interface NavigationProps { brand: string; items: readonly NavigationItem[]; headerNote?: string }
export interface PageTemplateProps {
  children: ReactNode;
  navigation?: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
}
export interface ComponentOverrides {
  HomeTitle?: ComponentType<HomeTitleProps>;
  Navigation?: ComponentType<NavigationProps>;
}
export interface TemplateOverrides { Page?: ComponentType<PageTemplateProps> }
/** Trusted static declarations; no runtime plugin execution yet. */
export interface ExtensionDefinition { id: string; apiVersion: typeof EXTENSION_API_VERSION }
export interface Customization {
  routing?: SiteRouting;
  pages?: PageOverrides;
  profileExtension?: ContentExtensionDefinition;
  contentTypes?: readonly ContentTypeDefinition[];
  settingsDefaults?: SettingsPatch;
  extensions: readonly ExtensionDefinition[];
  components: ComponentOverrides;
  templates: TemplateOverrides;
}
/** Trusted source registration. Additional type-specific fields require a schema extension. */
export interface ContentTypeDefinition {id:string;label:string;extension?:ContentExtensionDefinition;Template?:ComponentType<{content:PublicContent}>}
