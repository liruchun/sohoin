import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import type {ReactNode} from "react";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {requireAdministrator,ServiceError} from "@sohoin/core/server";
import {EmptyState} from "@sohoin/admin-ui/layout";
import {AdminFrame} from "../_components/shell/frame";
export const dynamic="force-dynamic";
export default async function ConsoleLayout({children}:{children:ReactNode}){
 let actor;try{actor=await requireAdministrator(await headers());}catch(error){if(error instanceof ServiceError&&error.status===401)redirect("/admin/login");if(error instanceof ServiceError&&error.status===403)return <div className="console-denied"><EmptyState title="没有管理权限" description="请使用管理员账号登录。" action={<Link href="/admin/login">返回登录页</Link>}/></div>;throw error;}
 return <AdminFrame account={<Link href="/admin/account" className="console-account" title={actor.email}><span className="console-avatar" aria-hidden="true">{(actor.name||actor.email).slice(0,1)}</span><span className="console-account-name">{actor.name}</span></Link>}>{children}</AdminFrame>;
}
