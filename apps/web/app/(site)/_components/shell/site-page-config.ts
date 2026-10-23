export type SitePageConfig={header:"feed"|"detail"|"community"|"profile";sidebar:"feed"|"detail"|"profile"|"none"};

// Shared page types; exact paths can override either part independently.
const pageTypes={
 feed:{header:"feed",sidebar:"feed"},
 community:{header:"community",sidebar:"feed"},
 detail:{header:"detail",sidebar:"detail"},
 profile:{header:"profile",sidebar:"profile"},
} satisfies Record<string,SitePageConfig>;
const pageOverrides:Record<string,Partial<SitePageConfig>>={
 "/":{header:"feed"},
 "/featured":{header:"feed"},
};
const isCommunity=(pathname:string)=>pathname==="/community"||pathname.startsWith("/community/");
const isMembers=(pathname:string)=>pathname==="/members"||pathname.startsWith("/members/");
export function sitePageConfig(pathname:string):SitePageConfig{
 const type=pathname==="/"||pathname==="/featured"||pathname==="/circle"?"feed":isCommunity(pathname)?"community":isMembers(pathname)?"profile":"detail";
 return {...pageTypes[type],...pageOverrides[pathname]};
}
