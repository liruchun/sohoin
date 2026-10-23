import {RelativeTime} from "@sohoin/ui/relative-time";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import {headers} from "next/headers";
import {getNotification,ServiceError} from "@sohoin/core/server";
import {adminRead} from "@/lib/admin-page";
import {Card} from "@sohoin/admin-ui/card";
import {PageHeader,EmptyState} from "@sohoin/admin-ui/layout";
import {NotificationReadAction} from "../_components/notification-actions";
export default async function NotificationPage({params}:{params:Promise<{id:string}>}){const {id}=await params;let item;try{item=await adminRead(async()=>getNotification(await headers(),id));}catch(error){if(error instanceof ServiceError&&[400,404].includes(error.status))return <EmptyState title="消息不存在或关联对象不可访问" action={<Link href="/admin/notifications">返回消息</Link>}/>;throw error;}return <><PageHeader title="消息详情" actions={<Link href="/admin/notifications">返回消息</Link>}/><Card><h2 className="user-section-title">{item.title||({reply:"回复通知",content_reacted:"内容回应",comment_reacted:"讨论回应",follow:"关注通知",system:"系统通知"})[item.kind]}</h2><p className="au-muted">{item.actor?.name??"系统"} · <RelativeTime dateTime={item.createdAt}/></p><p className="comment-body">{item.body}</p><div className="comment-actions">{item.target.commentId?<Link href={"/admin/comments/"+item.target.commentId}>查看讨论</Link>:item.target.contentId?<Link href={"/admin/content/"+item.target.contentId}>查看内容</Link>:item.target.userId?<Link href={"/admin/users/"+item.target.userId}>查看用户</Link>:null}{!item.readAt&&<NotificationReadAction id={item.id}/>}</div></Card></>;}
