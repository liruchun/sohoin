import {NavigationLink as Link,PageMotion} from "@/app/_components/navigation/page-motion";
import {StatusMessage} from "@sohoin/ui/feedback";
import {settingsService} from "@/lib/settings";
import {AdminBrand} from "../_components/shell/brand";
import {ArrowLeft} from "lucide-react";
import {LoginForm} from "./login-form";
export default async function LoginPage({searchParams}:{searchParams:Promise<{reason?:string}>}){const [{reason},{settings}]=await Promise.all([searchParams,settingsService.readPublic()]);return <PageMotion><div data-page-motion="" className="console-login-page"><header className="console-login-header"><AdminBrand name={settings.siteName} href="/"/><Link href="/"><ArrowLeft aria-hidden="true"/>返回网站</Link></header><main className="console-login"><h1>登录管理后台</h1><p>使用管理员账号管理你的站点。</p>{reason==="password-changed"&&<StatusMessage>密码已修改，全部登录已退出。请使用新密码登录。</StatusMessage>}{reason==="access-changed"&&<StatusMessage>登录已过期或权限已变更，请重新登录。</StatusMessage>}<LoginForm/><p className="console-login-note">管理入口仅对已授权账号开放。</p></main></div></PageMotion>;}
