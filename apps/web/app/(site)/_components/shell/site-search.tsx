"use client";

import {useTranslations} from "next-intl";
import {createContext,useContext,useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type FocusEventHandler,type PointerEvent as ReactPointerEvent,type ReactNode,type RefObject} from "react";
import {ReadingLink as Link} from "../feedback/reading-navigation";
import {Search,Settings,Award,UserRound,X} from "lucide-react";
import {Tooltip,TooltipProvider} from "@sohoin/ui/tooltip";
import {IconButton} from "@sohoin/ui/icon-button";
import {Button} from "@sohoin/ui/button";
import {cn} from "@sohoin/ui/utils";
import {MagneticSurface} from "@sohoin/ui/magnetic-surface";
import {SeedPanel,MedalPanel} from "./site-rewards";
import {useSiteMedals} from "./site-medals";
import {AuthorAvatar} from "../content/author-avatar";
import {SiteSettings} from "./site-settings";
import {SeedIcon} from "./icons/seed";
import styles from "./site-search.module.css";

type SidebarMode="search"|"settings"|"seeds"|"medals"|null;
type SearchState={
 mode:SidebarMode;setMode:(mode:SidebarMode)=>void;
 trigger:RefObject<HTMLButtonElement|null>;settingsTrigger:RefObject<HTMLButtonElement|null>;seedsTrigger:RefObject<HTMLButtonElement|null>;medalsTrigger:RefObject<HTMLButtonElement|null>;
 field:RefObject<HTMLDivElement|null>;panelId:string;listId:string;
 query:string;setQuery:(value:string)=>void;setFilter:(value:string)=>void;
 active:number;setActive:(value:number|((previous:number)=>number))=>void;items:string[];
 close:(restoreFocus?:boolean)=>void;
 onTriggerFocus:FocusEventHandler<HTMLButtonElement>;
};
const SearchContext=createContext<SearchState|null>(null);
function useSiteSearch(){
 const state=useContext(SearchContext);
 if(!state)throw new Error("Site search requires SiteSearchProvider");
 return state;
}
export function SiteSearchProvider({children}:{children:ReactNode}){
 const t=useTranslations("Web");
 const [mode,setMode]=useState<SidebarMode>(null),trigger=useRef<HTMLButtonElement>(null),settingsTrigger=useRef<HTMLButtonElement>(null),seedsTrigger=useRef<HTMLButtonElement>(null),medalsTrigger=useRef<HTMLButtonElement>(null),panelId=useId(),listId=useId();
 const field=useRef<HTMLDivElement>(null),restoreTarget=useRef<HTMLButtonElement|null>(null);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState(""),[active,setActive]=useState(-1);
 const items=[t("websiteDesign"),t("websiteTools"),t("websiteLaunch"),t("creativeLife")].filter(item=>item.toLowerCase().includes(filter.trim().toLowerCase()));
 // Radix respects defaultPrevented: suppress only the focus restored by closing a panel.
 const onTriggerFocus:FocusEventHandler<HTMLButtonElement>=event=>{
  if(restoreTarget.current===event.currentTarget)event.preventDefault();
 };
 const close=(restoreFocus=false)=>{
  restoreTarget.current=restoreFocus?(mode==="settings"?settingsTrigger:mode==="seeds"?seedsTrigger:mode==="medals"?medalsTrigger:trigger).current:null;
  setMode(null);setActive(-1);
 };
 useLayoutEffect(()=>{
  if(mode===null&&restoreTarget.current){restoreTarget.current.focus({preventScroll:true});restoreTarget.current=null;}
 },[mode]);
 return <SearchContext.Provider value={{mode,setMode,trigger,settingsTrigger,seedsTrigger,medalsTrigger,field,panelId,listId,query,setQuery,setFilter,active,setActive,items,close,onTriggerFocus}}>{children}</SearchContext.Provider>;
}

export function SiteSearch({brand}:{brand:string}){
 const account=useSiteMedals()?.collection;
 const t=useTranslations("Web"),{mode,setMode,trigger,settingsTrigger,seedsTrigger,medalsTrigger,field,panelId,listId,query,setQuery,setFilter,active,setActive,items,close,onTriggerFocus}=useSiteSearch();
 const rewards=useTranslations("Rewards");
 const open=mode==="search",input=useRef<HTMLInputElement>(null);
 useLayoutEffect(()=>{if(open){setActive(-1);input.current?.focus({preventScroll:true});}},[open,setActive]);
 // Keep focus until click commits the next panel, avoiding an intermediate default sidebar.
 const keepPanelFocus=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(mode&&event.isPrimary&&event.button===0)event.preventDefault();};
 return <div className={styles.toolbar} data-search-open={open} data-skeleton-chrome-item=""
  onKeyDown={event=>{if(open&&event.key==="Escape"){event.preventDefault();close(true);}}}>
  <Button ref={trigger} className={styles.searchTrigger} variant="outline" inert={open} aria-hidden={open||undefined} aria-label={t("searchCommunity")} aria-expanded={open} aria-controls={panelId} onPointerDown={keepPanelFocus} onClick={()=>setMode("search")}><Search size={18} aria-hidden="true"/><span>{t("search")}</span></Button>
  <TooltipProvider delayDuration={300}><div className={styles.controls} inert={open} aria-hidden={open||undefined}>
   <Tooltip label={rewards("seedsTooltip")} side="bottom"><IconButton ref={seedsTrigger} onFocus={onTriggerFocus} className={styles.toolIcon} active={mode==="seeds"} aria-label={rewards("seeds")} aria-expanded={mode==="seeds"} aria-controls={`${panelId}-seeds`} onPointerDown={keepPanelFocus} onClick={()=>setMode("seeds")}><SeedIcon size={18} strokeWidth={1.75}/></IconButton></Tooltip>
   <Tooltip label={rewards("medals")} side="bottom"><IconButton ref={medalsTrigger} onFocus={onTriggerFocus} className={styles.toolIcon} active={mode==="medals"} aria-label={rewards("medals")} aria-expanded={mode==="medals"} aria-controls={`${panelId}-medals`} onPointerDown={keepPanelFocus} onClick={()=>setMode("medals")}><Award size={18} strokeWidth={1.75}/></IconButton></Tooltip>
   <Tooltip label={t("settingsTooltip")} side="bottom"><IconButton ref={settingsTrigger} onFocus={onTriggerFocus} className={styles.toolIcon} active={mode==="settings"} aria-label={t("openSettings")} aria-expanded={mode==="settings"} aria-controls={`${panelId}-settings`} onPointerDown={keepPanelFocus} onClick={()=>setMode("settings")}><Settings size={18} strokeWidth={1.75}/></IconButton></Tooltip>
   <Button variant="plain" size="icon-sm" className={styles.account} asChild><Link href={account?"/members/"+account.user.publicId:"/admin/login"} aria-label={account?account.user.name:t("loginBrand",{brand})}>{account?<AuthorAvatar src={account.user.avatar} name={account.user.name} publicId={account.user.publicId} wornBadge={account.worn}/>:<span className={styles.guestAvatar}><UserRound size="1.375rem" strokeWidth={1.75} aria-hidden="true"/></span>}</Link></Button>
  </div></TooltipProvider>
    <div ref={field} className={styles.field} role="search" inert={!open} aria-hidden={!open}>
     <Search size={18} aria-hidden="true"/>
     <input ref={input} type="search" role="combobox" aria-label={t("searchCommunity")} placeholder={t("search")} autoComplete="off"
      aria-expanded={open} aria-controls={open?listId:undefined} aria-autocomplete="list"
      aria-activedescendant={open&&active>=0?`${listId}-${active}`:undefined}
      value={query} onFocus={()=>setFilter(query)} onChange={event=>{setQuery(event.target.value);setFilter(event.target.value);setActive(-1);}}
      onKeyDown={event=>{
       if(event.key==="ArrowDown"||event.key==="ArrowUp"){
        event.preventDefault();
        if(items.length)setActive(previous=>event.key==="ArrowDown"?(previous+1)%items.length:(previous<=0?items.length:previous)-1);
       }
       if(event.key==="Enter"){event.preventDefault();if(active>=0&&items[active]){setQuery(items[active]);close(true);}}
      }}/>
     <Button variant="plain" size="icon-sm" className={styles.close} aria-label={t("closeSearch")} onClick={()=>close(true)}><X size={16}/></Button>
    </div>
 </div>;
}

export function SiteSearchSidebar({children}:{children:ReactNode}){
 const ui=useTranslations("UI"),rewards=useTranslations("Rewards");
 const rewardPanels=useRef<Record<string,HTMLDivElement|null>>({});
 const t=useTranslations("Web"),{mode,setMode,trigger,settingsTrigger,seedsTrigger,medalsTrigger,field,panelId,listId,setQuery,active,items,close}=useSiteSearch();
 const open=mode==="search",settingsOpen=mode==="settings";
 const settingsPanel=useRef<HTMLDivElement>(null),languageMenu=useRef<HTMLDivElement>(null),languageExpanded=useRef(false);
 const panel=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(settingsOpen)settingsPanel.current?.focus({preventScroll:true});
  if(mode==="seeds"||mode==="medals")rewardPanels.current[mode]?.focus({preventScroll:true});
  languageExpanded.current=false;
 },[open,settingsOpen,mode]);
 useEffect(()=>{
  if(!mode)return;
  const dismiss=(event:PointerEvent|FocusEvent)=>{
   const target=event.target;
   if(target instanceof Node&&!Object.values(rewardPanels.current).some(panel=>panel?.contains(target))&&!seedsTrigger.current?.contains(target)&&!medalsTrigger.current?.contains(target)&&!field.current?.contains(target)&&!panel.current?.contains(target)&&!settingsPanel.current?.contains(target)&&!languageMenu.current?.contains(target)&&!trigger.current?.contains(target)&&!settingsTrigger.current?.contains(target))setMode(null);
  };
  document.addEventListener("pointerdown",dismiss,true);
  document.addEventListener("focusin",dismiss,true);
  return ()=>{
   document.removeEventListener("pointerdown",dismiss,true);
   document.removeEventListener("focusin",dismiss,true);
  };
 },[mode,setMode,trigger,settingsTrigger,seedsTrigger,medalsTrigger,field]);
 const isTrigger=(target:EventTarget|null)=>target instanceof Node&&(trigger.current?.contains(target)||settingsTrigger.current?.contains(target)||seedsTrigger.current?.contains(target)||medalsTrigger.current?.contains(target));
 const choose=(value:string)=>{setQuery(value);close(true);};
 return <div className={styles.sidebar} data-open={mode!==null}>
  <div className={styles.original} inert={mode!==null} aria-hidden={mode!==null||undefined}>{children}</div>
  <div className={styles.searchLayer} data-active={open} inert={!open} aria-hidden={!open}>
   <div ref={panel} id={panelId} className={styles.panel} role="region" aria-label={t("searchSuggestions")}
    onBlur={event=>{if(open&&!isTrigger(event.relatedTarget)&&!field.current?.contains(event.relatedTarget)&&!event.currentTarget.contains(event.relatedTarget))close();}}
    onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();close(true);}}}>
    <div className={styles.suggestions} data-nosnippet="">
     <p className={styles.label}>{t("exploreTopics")}</p>
     <div id={listId} role="listbox" aria-label={t("searchSuggestions")}>
      {items.map((item,index)=><Button key={item} id={`${listId}-${index}`} role="option" aria-selected={active===index}
       variant="plain" className={styles.option} style={{"--entry-delay":`${Math.min(index,3)*20}ms`} as CSSProperties} tabIndex={-1}
       onPointerDown={event=>{if(event.isPrimary)event.preventDefault();}} onClick={()=>choose(item)}><Search size={15} aria-hidden="true"/>{item}</Button>)}
     </div>
     {!items.length&&<p className={styles.empty} role="status">{t("noTopics")}</p>}
    </div>
   </div>
  </div>
  <div className={styles.searchLayer} data-active={settingsOpen} inert={!settingsOpen} aria-hidden={!settingsOpen}>
   <div ref={settingsPanel} id={`${panelId}-settings`} className={cn(styles.panel,styles.utilityPanel)} role="region" aria-labelledby={`${panelId}-settings-title`} tabIndex={-1}
    onBlur={event=>{if(settingsOpen&&!isTrigger(event.relatedTarget)&&!languageExpanded.current&&!event.currentTarget.contains(event.relatedTarget)&&!languageMenu.current?.contains(event.relatedTarget))close();}}
    onKeyDown={event=>{if(event.key==="Escape"&&!languageExpanded.current&&!event.defaultPrevented){event.preventDefault();close(true);}}}>
    <div className={styles.settingsHeading} data-magnetic-area="">
     <h2 id={`${panelId}-settings-title`}>{t("preferences")}</h2>
     <Button variant="plain" size="icon" className={styles.panelClose} aria-label={ui("close")} onClick={()=>close(true)}><MagneticSurface className={styles.panelCloseSurface} maxOffset={5}><X size={16} aria-hidden="true"/></MagneticSurface></Button>
    </div>
    <SiteSettings active={settingsOpen} languageMenu={languageMenu} onLanguageOpenChange={value=>{languageExpanded.current=value;}}/>
   </div>
  </div>
  {(["seeds","medals"] as const).map(kind=><div key={kind} className={styles.searchLayer} data-active={mode===kind} inert={mode!==kind} aria-hidden={mode!==kind}>
   <div ref={node=>{rewardPanels.current[kind]=node;}} id={`${panelId}-${kind}`} className={cn(styles.panel,styles.utilityPanel)} role="region" aria-labelledby={`${panelId}-${kind}-title`} tabIndex={-1} data-rewards="true" data-nosnippet=""
    onBlur={event=>{if(mode===kind&&!isTrigger(event.relatedTarget)&&!event.currentTarget.contains(event.relatedTarget))close();}}
    onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();close(true);}}}>
    <div className={styles.settingsHeading} data-magnetic-area="">
     <h2 id={`${panelId}-${kind}-title`}>{rewards(kind)}</h2>
     <Button variant="plain" size="icon" className={styles.panelClose} aria-label={ui("close")} onClick={()=>close(true)}><MagneticSurface className={styles.panelCloseSurface} maxOffset={5}><X size={16} aria-hidden="true"/></MagneticSurface></Button>
    </div>
    {kind==="seeds"?<SeedPanel/>:<MedalPanel active={mode==="medals"}/>}
   </div>
  </div>)}
 </div>;
}
