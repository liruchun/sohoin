import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {createAdminBadgeService,getUser,ServiceError} from "@sohoin/core/server";
import {badgeQuerySchema,badgeAuditQuerySchema} from "@sohoin/extension-api/badges";
import {adminRead} from "@/lib/admin-page";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import {Card,CardHeader,CardTitle,CardContent} from "@sohoin/admin-ui/card";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@sohoin/admin-ui/table";
import {RelativeTime} from "@sohoin/ui/relative-time";
import {BadgeAction} from "../../../../_features/badges/badge-action";
import {BadgeIcon,BadgePagination,BadgeAuditTable} from "../../../../_features/badges/badge-tables";
import styles from "../../../../_features/badges/badges.module.css";
export const metadata={title:"用户勋章"};
export default async function UserBadgesPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params,raw=await searchParams,requestHeaders=await headers();
 let user;try{user=await adminRead(()=>getUser(requestHeaders,id));}catch(error){if(error instanceof ServiceError&&[400,404].includes(error.status))notFound();throw error;}
 const service=createAdminBadgeService(requestHeaders),base="/admin/users/"+encodeURIComponent(id)+"/badges",tab=raw.tab??"badges";
 const {tab:ignored,...rest}=raw,query=(tab==="audit"?badgeAuditQuerySchema:badgeQuerySchema).safeParse(rest);
 if(typeof tab!=="string"||!["badges","audit"].includes(tab)||!query.success)return <><PageHeader title="用户勋章"/><EmptyState title="页面参数无效" action={<Link href={base}>返回用户勋章</Link>}/></>;
 let content;
 if(tab==="audit"){const page=await adminRead(()=>service.listUserAudit(id,query.data));content=<><BadgeAuditTable items={page.items}/><BadgePagination base={base+"?tab=audit"} before={query.data.before} next={page.nextCursor}/></>;}
 else{const page=await adminRead(()=>service.listUserDetails(id,query.data));content=<>{page.items.length?<Table><TableHeader><TableRow><TableHead>勋章</TableHead><TableHead>状态</TableHead><TableHead>获得时间</TableHead><TableHead>来源</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{page.items.map(row=><TableRow key={row.badgeKey}>
  <TableCell><div className={styles.identity}><BadgeIcon id={row.iconMediaId}/><Link href={"/admin/badges/"+row.badgeKey}>{row.name}</Link></div></TableCell><TableCell><Badge>{row.active?"已拥有":"已撤销"}</Badge>{row.revokedAt&&<p><RelativeTime dateTime={row.revokedAt}/></p>}</TableCell><TableCell><RelativeTime dateTime={row.awardedAt}/></TableCell><TableCell>{row.actorKind==="admin"?"管理员授予":"系统授予"}</TableCell><TableCell>{row.active&&<BadgeAction user={user} badge={{key:row.badgeKey,name:row.name}} revokeRevision={row.revision}/>}</TableCell>
 </TableRow>)}</TableBody></Table>:<EmptyState title="这位用户还没有勋章"/>}<BadgePagination base={base} before={query.data.before} next={page.nextCursor}/></>;}
 return <><PageHeader title={user.name+"的勋章"} actions={<><BadgeAction user={user}/><Link href={"/admin/users/"+encodeURIComponent(id)}>返回用户资料</Link></>}/>
  <nav className={styles.tabs} aria-label="用户详情导航"><Link href={"/admin/users/"+encodeURIComponent(id)}>账号资料</Link><Link href={base} aria-current={tab==="badges"?"page":undefined}>勋章</Link><Link href={base+"?tab=audit"} aria-current={tab==="audit"?"page":undefined}>勋章记录</Link></nav>
  <Card><CardHeader><CardTitle>{tab==="audit"?"操作记录":"勋章状态"}</CardTitle></CardHeader><CardContent className={styles.stack}>{content}</CardContent></Card></>;
}
