import Link from "next/link";
import {headers} from "next/headers";
import {createAdminBadgeService} from "@sohoin/core/server";
import {badgeQuerySchema} from "@sohoin/extension-api/badges";
import {adminRead} from "@/lib/admin-page";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import {Button} from "@sohoin/admin-ui/button";
import {Card,CardHeader,CardTitle,CardContent} from "@sohoin/admin-ui/card";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@sohoin/admin-ui/table";
import {RelativeTime} from "@sohoin/ui/relative-time";
import {BadgeIcon,BadgePagination} from "../../_features/badges/badge-tables";
import styles from "../../_features/badges/badges.module.css";
export const metadata={title:"勋章管理"};
export default async function BadgesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=badgeQuerySchema.safeParse(await searchParams);
 if(!query.success)return <><PageHeader title="勋章管理"/><EmptyState title="分页参数无效" action={<Link href="/admin/badges">返回列表</Link>}/></>;
 const service=createAdminBadgeService(await headers()),page=await adminRead(()=>service.listDefinitions(query.data));
 return <><PageHeader title="勋章管理" description="维护勋章资料，管理授予和撤销记录。" actions={<Button asChild><Link href="/admin/badges/new">新建勋章</Link></Button>}/>
  <Card><CardHeader><CardTitle>勋章列表</CardTitle></CardHeader><CardContent className={styles.stack}>
   {!page.items.length?<EmptyState title="还没有勋章" description="创建一枚勋章，记录用户的贡献与成就。"/>:<Table><TableHeader><TableRow><TableHead>勋章</TableHead><TableHead>说明</TableHead><TableHead>状态</TableHead><TableHead>更新时间</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
    <TableBody>{page.items.map(item=><TableRow key={item.key}><TableCell><div className={styles.identity}><BadgeIcon id={item.iconMediaId}/><Link href={"/admin/badges/"+item.key}>{item.name}</Link></div></TableCell><TableCell className={styles.wrap}>{item.description||"—"}</TableCell><TableCell><Badge>{item.enabled?"启用":"停用"}</Badge></TableCell><TableCell><RelativeTime dateTime={item.updatedAt}/></TableCell><TableCell><div className={styles.actions}><Link href={"/admin/badges/"+item.key}>编辑</Link><Link href={"/admin/badges/"+item.key+"?tab=recipients"}>获得者</Link></div></TableCell></TableRow>)}</TableBody>
   </Table>}<BadgePagination base="/admin/badges" before={query.data.before} next={page.nextCursor}/>
  </CardContent></Card></>;
}
