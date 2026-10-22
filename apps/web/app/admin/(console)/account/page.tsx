import {RelativeTime} from "@sohoin/ui/relative-time";
import {profileService} from "@/lib/profiles";
import {ProfileEditor} from "../../_features/profiles/profile-editor";
import {adminRead} from "@/lib/admin-page";
import Link from "next/link";
import {Card} from "@sohoin/admin-ui/card";
import {headers} from "next/headers";
import {requireAdministrator,listAccountSessions,ServiceError} from "@sohoin/core/server";
import {PageHeader,Badge,EmptyState} from "@sohoin/admin-ui/layout";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell,TableCaption} from "@sohoin/admin-ui/table";
import {LogoutButton} from "./_components/logout";
import {PasswordForm} from "./_components/password-form";
import {SessionAction} from "./_components/session-action";
function device(agent:string|null){
 if(!agent)return "未记录设备";
 const browser=agent.includes("Edg/")?"Edge":agent.includes("Firefox/")?"Firefox":agent.includes("Chrome/")?"Chrome":agent.includes("Safari/")?"Safari":"其他客户端";
 const system=agent.includes("Android")?"Android":/iPhone|iPad/.test(agent)?"iOS":agent.includes("Windows")?"Windows":agent.includes("Macintosh")?"macOS":agent.includes("Linux")?"Linux":"其他设备";
 return browser+" · "+system;
}
export default async function AccountPage({searchParams}:{searchParams:Promise<{before?:string|string[]}>}){
 const requestHeaders=await headers();const actor=await adminRead(()=>requireAdministrator(requestHeaders));const {before}=await searchParams;const profile=await adminRead(()=>profileService.readOwn(requestHeaders));
 let sessions;try{sessions=await adminRead(()=>listAccountSessions(requestHeaders,{...(before!==undefined?{before}:{})}));}catch(error){if(error instanceof ServiceError&&error.status===400)return <EmptyState title="分页参数无效" action={<Link href="/admin/account">返回账号页面</Link>}/>;throw error;}
 return <><PageHeader title="我的账号" description="管理密码、查看登录设备并安全退出。"/>
  <div className="account-security-grid"><Card><h2 className="user-section-title">账号资料</h2><dl className="account-details user-details"><div><dt>账号名称</dt><dd>{actor.name}</dd></div><div><dt>登录邮箱</dt><dd>{actor.email}</dd></div><div><dt>当前角色</dt><dd><Badge>管理员</Badge></dd></div><div><dt>登录方式</dt><dd>自托管账号密码认证</dd></div></dl><div className="account-logout"><LogoutButton/></div></Card>
   <Card><h2 className="user-section-title">修改密码</h2><PasswordForm/></Card></div>
  <Card className="profile-card"><h2 className="user-section-title">公开资料</h2><ProfileEditor key={profile.userId} initial={{bio:profile.bio,homepage:profile.homepage,version:profile.version}} url="/api/v1/account/profile"/></Card>
  <Card className="account-sessions"><div className="account-sessions-header"><div><h2 className="user-section-title">登录会话</h2><p className="au-muted">仅显示你的有效登录，按会话编号倒序，每页最多 20 条。</p></div><SessionAction/></div>
   <Table><TableCaption>设备信息来自客户端，仅供辨认；未配置可信来源时不记录 IP。</TableCaption><TableHeader><TableRow><TableHead>设备</TableHead><TableHead>登录时间</TableHead><TableHead>到期时间</TableHead><TableHead>IP</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
    <TableBody>{sessions.items.map(session=><TableRow key={session.id}><TableCell className="session-device"><span title={session.userAgent??undefined}>{device(session.userAgent)}</span>{session.current&&<p><Badge>当前登录</Badge></p>}</TableCell><TableCell className="audit-time"><RelativeTime dateTime={session.createdAt}/></TableCell><TableCell className="audit-time"><RelativeTime dateTime={session.expiresAt}/></TableCell><TableCell>{session.ipAddress??"未记录"}</TableCell><TableCell>{session.current?<span className="au-muted">当前登录</span>:<SessionAction id={session.id}/>}</TableCell></TableRow>)}</TableBody>
   </Table><nav className="audit-pagination" aria-label="登录会话分页"><span>{before&&<Link href="/admin/account">返回首页</Link>}</span>{sessions.nextCursor&&<Link href={"/admin/account?before="+encodeURIComponent(sessions.nextCursor)}>下一页</Link>}</nav>
  </Card>
 </>;
}
