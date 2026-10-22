"use client";
import {useState,useEffect,type ReactNode} from "react";
import {Menu,PanelLeftClose,PanelLeftOpen,ExternalLink} from "lucide-react";
import {Button} from "./button";
import {Sheet,SheetTrigger,SheetContent,SheetTitle,SheetDescription} from "./sheet";
import {ConfirmationProvider} from "./confirmation";
export function AdminShell({children,account,navigation,breadcrumb,brand,footer}: {children:ReactNode;account:ReactNode;navigation:ReactNode;breadcrumb:ReactNode;brand:ReactNode;footer?:ReactNode}){
 const [collapsed,setCollapsed]=useState(false);const [mobileOpen,setMobileOpen]=useState(false);
 useEffect(()=>{setMobileOpen(false);},[children]);
 return <ConfirmationProvider><div className="console-frame" data-slot="sidebar-wrapper" data-collapsed={collapsed}>
  <a className="console-skip" href="#admin-content">跳到主要内容</a>
  <aside data-slot="sidebar" data-state={collapsed?"collapsed":"expanded"} className="console-sidebar" aria-label="后台侧栏"><div data-slot="sidebar-header">{brand}</div><div data-slot="sidebar-content">{navigation}</div>
   <div data-slot="sidebar-footer" className="console-sidebar-footer"><span className="console-environment"><span/>站点管理</span><Button variant="ghost" size="icon" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?"展开侧栏":"收起侧栏"} aria-expanded={!collapsed}>{collapsed?<PanelLeftOpen/>:<PanelLeftClose/>}</Button></div>
  </aside>
  <div data-slot="sidebar-inset" className="console-body"><header className="console-topbar"><div className="console-mobile-trigger"><Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="打开后台导航"><Menu/></Button></SheetTrigger><SheetContent><SheetTitle>管理后台</SheetTitle><SheetDescription className="au-muted">选择要管理的功能。</SheetDescription><div onClick={event=>{if((event.target as HTMLElement).closest("a"))setMobileOpen(false);}}>{navigation}</div></SheetContent></Sheet></div>{breadcrumb}<div className="console-topbar-actions"><a href="/" target="_blank" rel="noopener noreferrer" className="console-view-site">查看网站<ExternalLink aria-hidden="true"/></a>{account}</div></header><main id="admin-content" tabIndex={-1} className="console-main">{children}</main><footer className="console-footer">{footer??<span>管理后台</span>}</footer></div>
 </div></ConfirmationProvider>;
}
