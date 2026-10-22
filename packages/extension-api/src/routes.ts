import type { ReactNode } from "react";
import type { ContentSummary, PublicContent, ContentQuery } from "./content";
import type { SiteSettings } from "./settings";

export type ServerPage<Props> = (props: Props) => ReactNode | Promise<ReactNode>;
export type RouteSearch = Record<string, string | string[] | undefined>;
export interface CustomRouteProps { params: Readonly<Record<string,string>>; searchParams: RouteSearch }
export interface CustomRoute {
  /** Static segments and single parameters, e.g. /projects/[slug]. */
  path: string;
  access: "public" | "authenticated" | "admin";
  Page: ServerPage<CustomRouteProps>;
  title?: string;
}
export interface SiteRouting {
  paths?: { contentList?: string; contentDetail?: string };
  routes?: readonly CustomRoute[];
}
export interface PageOverrides {
  Home?: ServerPage<{settings:SiteSettings;published:ContentSummary[];children:ReactNode}>;
  ContentList?: ServerPage<{page:{items:ContentSummary[];nextCursor:string|null};query:Omit<ContentQuery,"status">;children:ReactNode}>;
  ContentDetail?: ServerPage<{content:PublicContent;children:ReactNode}>;
}
const reserved = new Set(["admin","api","_next","content","featured","p","members","community","threads","comments","favicon.ico","robots.txt","sitemap.xml"]);
function segments(path:string) {
  if(path.length>200 || !/^\/(?:[a-z0-9][a-z0-9-]*|\[[a-z][a-zA-Z0-9]*\])(?:\/(?:[a-z0-9][a-z0-9-]*|\[[a-z][a-zA-Z0-9]*\]))*$/.test(path)) throw new Error("Invalid route pattern: "+path);
  const parts=path.slice(1).split("/");
  if(parts.length>8 || parts[0].startsWith("[")) throw new Error("Routes require a static first segment: "+path);
  const keys=parts.filter(p=>p.startsWith("["));
  if(new Set(keys).size!==keys.length || keys.some(p=>["[constructor]","[prototype]","[__proto__]"].includes(p))) throw new Error("Invalid route parameters: "+path);
  return parts;
}
function overlaps(a:string[],b:string[]) { return a.length===b.length && a.every((p,i)=>p===b[i]||p.startsWith("[")||b[i].startsWith("[")); }
export function createSiteRouter(config:SiteRouting={}) {
  const list=config.paths?.contentList??"/content";
  const detail=config.paths?.contentDetail??"/content/[id]";
  const entries=[{path:list,kind:"contentList" as const},{path:detail,kind:"contentDetail" as const},...(config.routes??[]).map(route=>({path:route.path,kind:"custom" as const,route}))];
  if(entries.length>66) throw new Error("At most 64 custom routes are allowed");
  const compiled=entries.map(entry=>{
    const parts=segments(entry.path);
    const defaultBuiltin=(entry.kind==="contentList"&&entry.path==="/content")||(entry.kind==="contentDetail"&&entry.path==="/content/[id]");
    if(reserved.has(parts[0])&&!defaultBuiltin) throw new Error("Reserved route: "+entry.path);
    if(entry.kind==="contentList"&&parts.some(p=>p.startsWith("["))) throw new Error("Content list path must be static");
    if(entry.kind==="contentDetail"&&(parts.filter(p=>p.startsWith("[")).join()!=="[id]")) throw new Error("Content detail path requires exactly [id]");
    if(entry.kind==="custom"&&(!["public","authenticated","admin"].includes(entry.route.access)||typeof entry.route.Page!=="function")) throw new Error("Invalid custom route: "+entry.path);
    return {...entry,parts};
  });
  for(let i=0;i<compiled.length;i++) for(let j=0;j<i;j++) if(overlaps(compiled[i].parts,compiled[j].parts)) throw new Error("Conflicting routes: "+compiled[j].path+" and "+compiled[i].path);
  return {
    href: {
      home:()=>"/",
      contentList:(query:Readonly<Record<string,string|undefined>>={})=>{const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(value!==undefined&&value!=="")params.set(key,value);return list+(params.size?"?"+params:"");},
      contentDetail:(id:string)=>detail.replace("[id]",encodeURIComponent(id)),
      custom:(pattern:string,params:Readonly<Record<string,string>>={})=>{
        if(!compiled.some(e=>e.kind==="custom"&&e.path===pattern))throw new Error("Unregistered route: "+pattern);
        return pattern.replace(/\[([a-z][a-zA-Z0-9]*)\]/g,(_,key:string)=>{const value=params[key];if(!value||value==="."||value===".."||/[\/\\\x00-\x1f]/.test(value))throw new Error("Invalid route parameter: "+key);return encodeURIComponent(value);});
      },
    },
    match(parts:readonly string[]) {
      if(parts.some(p=>!p||p==="."||p===".."||p.length>500||/[\/\\\x00-\x1f]/.test(p)))return null;
      for(const entry of compiled) {
        if(parts.length!==entry.parts.length)continue;
        const params:Record<string,string>={};
        if(entry.parts.every((p,i)=>{if(p.startsWith("[")){params[p.slice(1,-1)]=parts[i];return true;}return p===parts[i];}))return {...entry,params};
      }
      return null;
    },
  };
}
