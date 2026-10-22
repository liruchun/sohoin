// Shared browser/server limits without importing runtime schema validation.
export const MAX_MEDIA_BYTES=10*1024*1024;
export const SITE_ICON_SIZES={favicon:32,apple:180,"app-192":192,"app-512":512,"maskable-512":512} as const;
export type SiteIconVariant=keyof typeof SITE_ICON_SIZES;
