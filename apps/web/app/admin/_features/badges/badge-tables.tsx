import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {Award} from "lucide-react";
import {RelativeTime} from "@sohoin/ui/relative-time";
import {EmptyState,Badge} from "@sohoin/admin-ui/layout";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@sohoin/admin-ui/table";
import type {createAdminBadgeService} from "@sohoin/core/server";
import styles from "./badges.module.css";
export function BadgeIcon({id}:{id:string|null}){
 return id?<img className={styles.icon} src={"/api/v1/admin/media/"+id+"/file?variant=thumbnail"} width={48} height={48} alt="" loading="lazy"/>:<Award className={styles.icon} aria-hidden="true"/>;
}
export function BadgePagination({base,before,next}:{base:string;before?:string;next:string|null}){
 return <nav className={styles.pagination} aria-label="列表分页"><span>{before&&<Link href={base}>返回首页</Link>}</span>{next&&<Link href={base+(base.includes("?")?"&":"?")+"before="+encodeURIComponent(next)}>下一页</Link>}</nav>;
}
type Audit=Awaited<ReturnType<ReturnType<typeof createAdminBadgeService>["listAudit"]>>["items"];
export function BadgeAuditTable({items}:{items:Audit}){
 const labels={create:"创建勋章",update:"修改定义",grant:"授予",revoke:"撤销"};
 return items.length?<Table><TableHeader><TableRow><TableHead>时间</TableHead><TableHead>操作</TableHead><TableHead>对象</TableHead><TableHead>来源</TableHead><TableHead>原因与变更</TableHead></TableRow></TableHeader>
  <TableBody>{items.map(row=><TableRow key={row.id}><TableCell><RelativeTime dateTime={row.createdAt}/></TableCell><TableCell>{labels[row.operation]}{!row.changed&&<Badge>未改变状态</Badge>}</TableCell>
   <TableCell className={styles.wrap}><Link href={"/admin/badges/"+row.badgeKey}>{row.badgeName}</Link>{row.userId&&<p><Link href={"/admin/users/"+encodeURIComponent(row.userId)+"/badges"}>{row.userName??"查看用户"}</Link></p>}</TableCell>
   <TableCell className={styles.wrap}>{row.actor.kind==="admin"?<Link href={"/admin/users/"+encodeURIComponent(row.actor.id)}>{row.actorName??"管理员"}</Link>:"系统"}<p className={styles.muted}>{row.actor.kind==="system"?row.actor.id:"管理员操作"}</p></TableCell>
   <TableCell className={styles.wrap}>{row.reason}{row.operation==="update"&&row.before&&"name" in row.before&&"name" in row.after&&<p className={styles.muted}>{row.before.name!==row.after.name?"名称已修改；":""}{row.before.description!==row.after.description?"说明已修改；":""}{(row.before.iconMediaId??null)!==(row.after.iconMediaId??null)?"图标已修改；":""}{row.before.enabled!==row.after.enabled?(row.after.enabled?"已启用":"已停用"):""}</p>}</TableCell>
  </TableRow>)}</TableBody></Table>:<EmptyState title="暂无操作记录"/>;
}
