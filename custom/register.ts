import { routing } from "./routes";
import { pages } from "./pages";
import type { Customization } from "@sohoin/extension-api";
import { components } from "./components";
import { extensions } from "./extensions";
import { templates } from "./templates";

/** Explicit composition, with no mutable global registration or startup side effects. */
export function registerCustom(): Customization {
  return { routing, pages, extensions, components, templates, settingsDefaults: { custom: { headerNote: "分享，让想法生长" } } };
}
