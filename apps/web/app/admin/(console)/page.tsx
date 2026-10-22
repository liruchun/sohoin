import {adminRead} from "@/lib/admin-page";
import {headers} from "next/headers";
import {settingsService} from "@/lib/settings";
import {PageHeader,Badge} from "@sohoin/admin-ui/layout";
import {SettingsForm} from "../_features/settings/settings-form";
export const dynamic="force-dynamic";
export default async function SettingsPage(){const snapshot=await adminRead(async()=>settingsService.readAdmin(await headers()));return <><PageHeader title="站点设置" description="统一管理站点信息、导航与定制项。" actions={<Badge>保存后前台生效</Badge>}/><SettingsForm initial={snapshot}/></>;}
