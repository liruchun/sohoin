export type ThemePreference = "system" | "light" | "dark";
export const themeStorageKey = "sohoin:appearance";
export type ReadingSize = "standard" | "large" | "largest";
export const readingStorageKey = "sohoin:reading-size";
export const motionStorageKey = "sohoin:reduce-motion";
// Presets live in theme.css; only the selected id is stored per browser.
export const primaryColors = ["red","orange","green","cyan","blue","black"] as const;
export type PrimaryColor = typeof primaryColors[number];
export const primaryStorageKey = "sohoin:primary";
export const preferenceEvent = "sohoin:preferences-change";
export function parseReadingSize(value:string|null):ReadingSize{return value==="large"||value==="largest"?value:"standard";}
export function parsePrimaryColor(value:string|null):PrimaryColor{return primaryColors.includes(value as PrimaryColor)?value as PrimaryColor:"red";}
export function prefersReducedMotion(){return document.documentElement.dataset.reduceMotion==="true"||window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
export function parseTheme(value: string | null): ThemePreference {
 return value === "light" || value === "dark" ? value : "system";
}
// Static, trusted script runs before body paint; never interpolate user settings.
export const themeBootstrap = `(()=>{if(/^\\/admin(?:\\/|$)/.test(location.pathname))return;let p="system",s="standard",m=false,c="red";try{p=localStorage.getItem(${JSON.stringify(themeStorageKey)})||p;s=localStorage.getItem(${JSON.stringify(readingStorageKey)})||s;m=localStorage.getItem(${JSON.stringify(motionStorageKey)})==="true";c=localStorage.getItem(${JSON.stringify(primaryStorageKey)})||c}catch{}const r=document.documentElement;r.classList.toggle("dark",p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches));if(s==="large"||s==="largest")r.style.setProperty("--reading-body-size",s==="large"?"1.125rem":"1.25rem");if(c!=="red"&&${JSON.stringify(primaryColors)}.includes(c))r.dataset.sitePrimary=c;if(m)r.dataset.reduceMotion="true"})()`;
