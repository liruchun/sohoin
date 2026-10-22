import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {createAdminBadgeService,ServiceError} from "@sohoin/core/server";
import {badgeAuditQuerySchema,badgeRecipientsQuerySchema} from "@sohoin/extension-api/badges";
import {adminRead} from "@/lib/admin-page";
import {PageHeader,EmptyState} from "@sohoin/admin-ui/layout";
import {Card,CardHeader,CardTitle,CardContent} from "@sohoin/admin-ui/card";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@sohoin/admin-ui/table";
import {RelativeTime} from "@sohoin/ui/relative-time";
import {BadgeEditor} from "../../../_features/badges/badge-editor";
import {BadgeAction} from "../../../_features/badges/badge-action";
import {BadgePagination,BadgeAuditTable} from "../../../_features/badges/badge-tables";
import styles from "../../../_features/badges/badges.module.css";
export const metadata={title:"勋章详情"};
export default async function BadgePage({params,searchParams}:{params:Promise<{key:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {key}=await params,raw=await searchParams,tab=raw.tab??"edit",service=createAdminBadgeService(await headers());
 let badge;try{badge=await adminRead(()=>service.getDefinition(key));}catch(error){if(error instanceof ServiceError&&[400,404].includes(error.status))notFound();throw error;}
 const base="/admin/badges/"+key;
 const {tab:ignored,...rest}=raw;
 const query=(tab==="recipients"?badgeRecipientsQuerySchema:badgeAuditQuerySchema).safeParse(rest);
 if(typeof tab!=="string"||!["edit","recipients","audit"].includes(tab)||!query.success)return <><PageHeader title={badge.name}/><EmptyState title="页面参数无效" action={<Link href={base}>返回勋章详情</Link>}/></>;
 let content;
 if(tab==="edit")content=<BadgeEditor key={badge.revision} initial={badge}/>;
 else if(tab==="audit"){const page=await adminRead(()=>service.listAudit(key,query.data));content=<><BadgeAuditTable items={page.items}/><BadgePagination base={base+"?tab=audit"} before={query.data.before} next={page.nextCursor}/></>;}
 else{const page=await adminRead(()=>service.listRecipients(key,query.data));content=<>{page.items.length?<Table><TableHeader><TableRow><TableHead>用户</TableHead><TableHead>获得时间</TableHead><TableHead>来源</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{page.items.map(row=><TableRow key={row.userId}>
  <TableCell><Link href={"/admin/users/"+encodeURIComponent(row.userId)+"/badges"}>{row.name}</Link><p className={styles.muted}>{row.email}</p></TableCell><TableCell><RelativeTime dateTime={row.awardedAt}/></TableCell><TableCell>{row.actorKind==="admin"?"管理员授予":"系统授予"}</TableCell><TableCell><BadgeAction user={{id:row.userId,name:row.name}} badge={badge} revokeRevision={row.revision}/></TableCell>
 </TableRow>)}</TableBody></Table>:<EmptyState title="暂无获得者"/>}<BadgePagination base={base+"?tab=recipients"} before={query.data.before} next={page.nextCursor}/></>;}
 return <><PageHeader title={badge.name} description={badge.enabled?"已启用":"已停用，已有勋章继续保留"} actions={<>{badge.enabled&&<BadgeAction badge={badge}/>}<Link href="/admin/badges">返回勋章列表</Link></>}/>
  <nav className={styles.tabs} aria-label="勋章详情导航">{[["edit","基本信息"],["recipients","获得者"],["audit","操作记录"]].map(([value,label])=><Link key={value} href={base+"?tab="+value} aria-current={tab===value?"page":undefined}>{label}</Link>)}</nav>
  <Card><CardHeader><CardTitle>{tab==="edit"?"编辑勋章":tab==="recipients"?"当前获得者":"操作记录"}</CardTitle></CardHeader><CardContent className={styles.stack}>{content}</CardContent></Card></>;
}
