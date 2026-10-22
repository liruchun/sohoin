"use client";
import {StatusMessage,Alert} from "@sohoin/ui/feedback";
import {useToast} from "@sohoin/ui/toast";

import {IconSettings} from "./icon-settings";
import {useUnsavedChanges} from "../../_hooks/use-unsaved-changes";
import {LogoSettings} from "./logo-settings";
import {Switch} from "@sohoin/admin-ui/switch";
import {useState,type FormEvent} from "react";
import {ArrowUp,ArrowDown,Trash2,Plus,Save,ExternalLink} from "lucide-react";
import {Button} from "@sohoin/admin-ui/button";
import {Input,Textarea,FormSection} from "@sohoin/admin-ui/fields";
import type {SettingsSnapshot,SiteSettings,SettingsPatch} from "@sohoin/extension-api/settings";

export function SettingsForm({initial}:{initial:SettingsSnapshot}) {
 const {notify}=useToast();
  const [baseline,setBaseline]=useState(initial);
  const [value,setValue]=useState<SiteSettings>(initial.settings);
  const [pending,setPending]=useState(false);
  const [logoBusy,setLogoBusy]=useState(false);
  const [iconBusy,setIconBusy]=useState(false);

  const [error,setError]=useState("");
  const [conflict,setConflict]=useState(false);
  const dirty=JSON.stringify(value)!==JSON.stringify(baseline.settings);

  useUnsavedChanges(dirty||logoBusy||iconBusy);

  function updateNavigation(index:number,patch:Partial<SiteSettings["navigation"][number]>) {
    setValue(current=>({...current,navigation:current.navigation.map((item,i)=>i===index?{...item,...patch}:item)}));

  }
  function move(index:number,delta:number) {
    const items=[...value.navigation];
    [items[index],items[index+delta]]=[items[index+delta],items[index]];
    setValue({...value,navigation:items});
  }
  async function save(event:FormEvent) {
    event.preventDefault();if(pending||logoBusy||iconBusy||conflict)return;setPending(true);setError("");
    const patch:SettingsPatch={};
    for(const key of ["siteName","description","logo","icons","navigation","custom"] as const) {
      if(JSON.stringify(value[key])!==JSON.stringify(baseline.settings[key]))Object.assign(patch,{[key]:value[key]});
    }
    try {
      const response=await fetch("/api/v1/admin/site-settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:baseline.revision,patch})});
      const body=await response.json();
      if(!response.ok) {
        if(response.status===401){window.location.assign("/admin/login");return;}
        setConflict(response.status===409);setError(body.error?.message??"保存失败，请重试。");return;
      }
      setBaseline(body);setValue(body.settings);setConflict(false);notify({variant:"success",message:"已保存，刷新前台即可看到更新。"});
    } catch {setError("网络连接失败，请检查后重试。");}
    finally {setPending(false);}
  }
  return <form className="console-settings" onSubmit={save}>
    <nav className="settings-sections" aria-label="设置分组"><a href="#basic-settings">基本信息</a><a href="#logo-settings">Logo 设置</a><a href="#icon-settings">站点图标</a><a href="#navigation-settings">导航设置</a><a href="#custom-settings">Custom 定制</a><p>同一份设置，同时用于 Core 与 Custom。</p></nav>
    <div className="settings-fields">
      <FormSection id="basic-settings" title="基本信息" description="让访客认识你的站点。" disabled={pending}>
        <label htmlFor="site-name">站点名称<Input id="site-name" value={value.siteName} onChange={event=>setValue({...value,siteName:event.target.value})} required maxLength={60}/></label>
        <label htmlFor="site-description">站点简介<Textarea id="site-description" value={value.description} onChange={event=>setValue({...value,description:event.target.value})} maxLength={240} rows={3}/></label>
        <p className="au-muted">名称显示在导航和页脚，简介显示在首页标题下。</p>
      </FormSection>
      <FormSection id="logo-settings" title="Logo 设置" description="分别设置浅色与深色背景下的站点标识。" disabled={pending}>
        <LogoSettings value={value.logo} disabled={pending||iconBusy} onBusyChange={setLogoBusy} onChange={logo=>{setValue(current=>({...current,logo}));}}/>
      </FormSection>
      <FormSection id="icon-settings" title="站点图标" description="设置浏览器标签图标，以及添加到主屏幕后的 App 图标。" disabled={pending}>
        <IconSettings value={value.icons} logo={value.logo.normal} disabled={pending||logoBusy} onBusyChange={setIconBusy} onChange={icons=>{setValue(current=>({...current,icons}));}}/>
      </FormSection>
      <FormSection id="navigation-settings" title="导航设置" description="调整名称、链接、顺序和显示状态。最多 12 项。" disabled={pending}>
        {value.navigation.length===0&&<p className="au-muted">暂无导航，点击下方按钮添加第一项。</p>}
        <div className="settings-navigation-list">{value.navigation.map((item,index)=><div className="settings-navigation-row" key={index}>
          <label className="au-field" htmlFor={"nav-name-"+index}>导航名称<Input id={"nav-name-"+index} value={item.label} required maxLength={32} onChange={event=>updateNavigation(index,{label:event.target.value})}/></label>
          <label className="au-field" htmlFor={"nav-link-"+index}>链接地址<Input id={"nav-link-"+index} value={item.href} required maxLength={500} onChange={event=>updateNavigation(index,{href:event.target.value})}/></label>
          <div className="settings-row-controls"><label className="settings-visible"><Switch checked={item.visible} onCheckedChange={visible=>updateNavigation(index,{visible})} aria-label={"显示导航："+(item.label||"未命名导航")}/>显示</label><div className="settings-row-actions">
            <Button variant="ghost" size="icon" aria-label={"上移第"+(index+1)+"项"} title="上移" disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp aria-hidden="true"/></Button>
            <Button variant="ghost" size="icon" aria-label={"下移第"+(index+1)+"项"} title="下移" disabled={index===value.navigation.length-1} onClick={()=>move(index,1)}><ArrowDown aria-hidden="true"/></Button>
            <Button variant="ghost" size="icon" aria-label={"删除第"+(index+1)+"项"} title="删除" onClick={()=>setValue({...value,navigation:value.navigation.filter((_,i)=>i!==index)})}><Trash2 aria-hidden="true"/></Button>
          </div></div>
        </div>)}</div>
        <div><Button variant="outline" disabled={value.navigation.length>=12} onClick={()=>setValue({...value,navigation:[...value.navigation,{label:"",href:"",visible:true}]})}><Plus aria-hidden="true"/>添加导航</Button></div>
        <p className="au-muted">支持站内路径、页面锚点与 HTTPS 地址。关闭“显示”即可临时隐藏。</p>
      </FormSection>
      <FormSection id="custom-settings" title="Custom 定制" description="当前模板公开的专属配置。" disabled={pending}>
        <label htmlFor="header-note">Header 说明文字<Input id="header-note" value={value.custom.headerNote} maxLength={80} onChange={event=>setValue({...value,custom:{headerNote:event.target.value}})}/></label>
        <p className="au-muted">只在 Custom Header 中展示，窄屏自动隐藏；留空则不显示。</p>
      </FormSection>
      <div className="settings-feedback">{error?<Alert variant="error">{error}</Alert>:<StatusMessage announce={false} variant={dirty?"warning":"info"}>{dirty?"有未保存的修改。":"当前设置已同步。"}</StatusMessage>}{conflict&&<Button variant="outline" onClick={()=>window.location.reload()}>重新加载最新设置</Button>}</div>
      <div className="settings-savebar"><Button type="submit" disabled={pending||logoBusy||iconBusy||!dirty||conflict}><Save aria-hidden="true"/>{pending?"正在保存…":"保存设置"}</Button><Button variant="outline" disabled={pending||logoBusy||iconBusy||!dirty} onClick={()=>{setValue(baseline.settings);setError("");}}>撤销修改</Button><a href="/" target="_blank" rel="noopener noreferrer">预览网站<ExternalLink aria-hidden="true"/></a></div>
    </div>
  </form>;
}
