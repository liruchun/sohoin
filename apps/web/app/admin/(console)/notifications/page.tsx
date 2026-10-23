import {RelativeTime} from "@sohoin/ui/relative-time";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {headers} from "next/headers";
import {listNotifications,getUnreadNotificationCount,ServiceError} from "@sohoin/core/server";
import {notificationQuerySchema} from "@sohoin/extension-api/notifications";
import {adminRead} from "@/lib/admin-page";
import {Card} from "@sohoin/admin-ui/card";
import {PageHeader,Badge,EmptyState} from "@sohoin/admin-ui/layout";
import {NotificationReadAction} from "./_components/notification-actions";
import {SystemNotificationForm} from "./_components/system-notification-form";
const labels={reply:"回复了你",content_reacted:"回应了你的内容",comment_reacted:"回应了你的讨论",follow:"关注了你",system:"系统通知"};
export default async function NotificationsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {recipient,...raw}=await searchParams,query=notificationQuerySchema.safeParse(raw);if(!query.success)return <EmptyState title="消息筛选参数无效" action={<Link href="/admin/notifications">返回消息</Link>}/>;
 const h=await headers();let page,count;try{[page,count]=await adminRead(()=>Promise.all([listNotifications(h,query.data),getUnreadNotificationCount(h)]));}catch(error){if(error instanceof ServiceError&&error.status===400)return <EmptyState title="分页参数无效"/>;throw error;}
 return <><PageHeader title="消息" description="仅显示发送给当前账号的可见通知，不包含用户私信。"/><div className="notification-layout"><Card><div className="audit-toolbar"><div className="audit-fields"><Link href="/admin/notifications" aria-current={query.data.status==="all"?"page":undefined}>全部消息</Link><Link href="/admin/notifications?status=unread" aria-current={query.data.status==="unread"?"page":undefined}>未读消息</Link><Badge>{count.count} 条未读</Badge></div>{!query.data.before&&page.items[0]&&count.count>0&&<NotificationReadAction through={page.items[0].id}/>}</div>
  {page.items.length===0?<EmptyState title="暂无消息" description="收到回复、表情回应、关注或系统通知后，会显示在这里。"/>:<ol className="notification-list">{page.items.map(item=><li key={item.id}><div className="notification-item"><div><div className="comment-meta"><strong>{item.actor?.name??"系统"}</strong><span>{labels[item.kind]}</span>{!item.readAt&&<Badge>未读</Badge>}</div><Link href={"/admin/notifications/"+item.id}>{item.title||labels[item.kind]}</Link>{item.body&&<p className="notification-preview">{item.body}</p>}<p className="au-muted"><RelativeTime dateTime={item.createdAt}/></p></div>{!item.readAt&&<NotificationReadAction id={item.id}/>}</div></li>)}</ol>}
  <nav className="audit-pagination" aria-label="消息分页"><Link href={"/admin/notifications?status="+query.data.status}>返回最新</Link>{page.nextCursor&&<Link href={"/admin/notifications?status="+query.data.status+"&before="+page.nextCursor}>更早消息</Link>}</nav>
 </Card><Card><h2 className="user-section-title">发送系统通知</h2><SystemNotificationForm recipient={typeof recipient==="string"?recipient:""}/></Card></div></>;
}
