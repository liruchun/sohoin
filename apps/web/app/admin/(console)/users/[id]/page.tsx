import styles from "../../../_features/badges/badges.module.css";
import {RelativeTime} from "@sohoin/ui/relative-time";
import {profileService} from "@/lib/profiles";
import {ProfileEditor} from "../../../_features/profiles/profile-editor";
import {adminRead} from "@/lib/admin-page";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {headers} from "next/headers";
import {getUser,requireAdministrator,ServiceError} from "@sohoin/core/server";
import {PageHeader,EmptyState} from "@sohoin/admin-ui/layout";
import {Card} from "@sohoin/admin-ui/card";
import {UserEditor} from "../_components/user-editor";

export default async function UserPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;const requestHeaders=await headers();
  let user;try{user=await adminRead(()=>getUser(requestHeaders,id));}catch(error){if(error instanceof ServiceError&&[400,404].includes(error.status))return <EmptyState title="用户不存在" description="账号可能已被移除，请返回列表查找。" action={<Link href="/admin/users">返回用户列表</Link>}/>;throw error;}
  const actor=await adminRead(()=>requireAdministrator(requestHeaders));const profile=await adminRead(()=>profileService.readAdmin(requestHeaders,id));
  return <><PageHeader title="用户详情" description="查看账号资料，调整访问状态与管理权限。" actions={<><Link href={"/admin/notifications?recipient="+encodeURIComponent(id)}>发送系统通知</Link><Link href="/admin/users">返回用户列表</Link></>}/>
    <nav className={styles.tabs} aria-label="用户详情导航"><Link href={"/admin/users/"+encodeURIComponent(id)} aria-current="page">账号资料</Link><Link href={"/admin/users/"+encodeURIComponent(id)+"/badges"}>勋章</Link><Link href={"/admin/users/"+encodeURIComponent(id)+"/badges?tab=audit"}>勋章记录</Link></nav>
    <div className="user-detail-grid"><Card><h2 className="user-section-title">账号资料</h2><dl className="account-details user-details">
      <div><dt>姓名</dt><dd>{user.name}</dd></div><div><dt>邮箱</dt><dd>{user.email}</dd></div><div><dt>邮箱验证</dt><dd>{user.emailVerified?"已验证":"未验证"}</dd></div>
      <div><dt>用户编号</dt><dd>{user.id}</dd></div><div><dt>注册时间</dt><dd><RelativeTime dateTime={user.createdAt}/></dd></div>
    </dl></Card><UserEditor key={user.id} initial={user} isSelf={actor.id===id}/></div>
    <Card className="profile-card"><h2 className="user-section-title">公开资料</h2><ProfileEditor key={profile.userId} initial={{bio:profile.bio,homepage:profile.homepage,version:profile.version}} url={"/api/v1/admin/users/"+encodeURIComponent(id)+"/profile"}/></Card>
  </>;
}
