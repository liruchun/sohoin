import type {ReactNode} from "react";
import {AdminShell} from "@sohoin/admin-ui/shell";
import {AdminNavigation,AdminBreadcrumb} from "./navigation";
import {settingsService} from "@/lib/settings";
import {AdminBrand} from "./brand";
export async function AdminFrame({children,account}:{children:ReactNode;account:ReactNode}) {const {settings}=await settingsService.readPublic();return <AdminShell brand={<AdminBrand name={settings.siteName} href="/admin" subtitle/>} footer={<span>{settings.siteName} · 管理后台</span>} navigation={<AdminNavigation/>} breadcrumb={<AdminBreadcrumb/>} account={account}>{children}</AdminShell>;}
