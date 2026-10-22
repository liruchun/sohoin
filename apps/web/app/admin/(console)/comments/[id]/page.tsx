import {RelativeTime} from "@sohoin/ui/relative-time";
import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {getCommentContext,ServiceError} from "@sohoin/core/server";
import {adminRead} from "@/lib/admin-page";
import {Card} from "@sohoin/admin-ui/card";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import type {AdminComment} from "@sohoin/extension-api/comments";
import {CommentActions} from "../_components/comment-actions";
const labels={visible:"正常",hidden:"隐藏",deleted:"已删除"};
function CommentBody({comment}:{comment:AdminComment}){return <><div className="comment-meta"><strong>{comment.authorName}</strong><span>#{comment.id}</span><RelativeTime dateTime={comment.createdAt}/><Badge>{labels[comment.status]}</Badge>{comment.threadHidden&&<Badge>整串隐藏</Badge>}</div>{comment.replyToId&&<p className="au-muted">回复 {comment.replyToName} · <Link href={"/admin/comments/"+comment.replyToId}>#{comment.replyToId}</Link></p>}<p className="comment-body">{comment.status==="deleted"?"正文已删除":comment.body}</p></>;}
export default async function CommentPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params,query=await searchParams,requestHeaders=await headers();let context;
 try{context=await adminRead(()=>getCommentContext(requestHeaders,id,query));}catch(error){if(error instanceof ServiceError&&error.status===404)notFound();if(error instanceof ServiceError&&error.status===400)return <EmptyState title="讨论或分页参数无效" action={<Link href="/admin/comments">返回讨论列表</Link>}/>;throw error;}
 const {comment,root,replyTo,replies}=context,thread=root??comment;
 return <><PageHeader title={"讨论 #"+comment.id} description="正文按纯文本显示。删除仅清空本条正文，已有回复及关系保留。" actions={<Link href={"/admin/comments?contentId="+comment.contentId}>查看此内容的讨论</Link>}/>
  <div className="comment-panels"><Card><h2>当前讨论</h2><p><Link href={"/admin/content/"+comment.contentId}>{comment.contentTitle||"未命名内容"}</Link></p><CommentBody comment={comment}/><CommentActions key={comment.id+":"+comment.version} {...comment}/></Card>
  {root&&<Card><h2>所属一级讨论</h2><CommentBody comment={root}/><Link href={"/admin/comments/"+root.id}>管理这条一级讨论</Link></Card>}
  {replyTo&&replyTo.id!==thread.id&&<Card><h2>直接回复的讨论</h2><CommentBody comment={replyTo}/><Link href={"/admin/comments/"+replyTo.id}>管理这条回复</Link></Card>}
  <Card><h2>整个讨论串</h2><p className="au-muted">{thread.threadHidden?"整串当前隐藏。恢复整串后，单独隐藏或删除的讨论仍保持原状态。":"整串当前允许显示。单条隐藏只影响该条讨论。"}</p><CommentActions key={thread.id+":"+thread.version+":thread"} {...thread} mode="thread"/></Card>
  <Card><h2>同串二级回复</h2><p className="au-muted">二级回复平铺显示，通过“回复对象”保留相互回复关系，不增加第三层。</p>{replies.items.length===0?<EmptyState title="暂无回复"/>:<ol className="comment-replies">{replies.items.map(reply=><li key={reply.id}><div className="comment-meta"><Link href={"/admin/comments/"+reply.id}>{reply.authorName} · #{reply.id}</Link><Badge>{labels[reply.status]}</Badge>{reply.id===comment.id&&<Badge>当前讨论</Badge>}</div><p className="au-muted">回复 {reply.replyToName} · #{reply.replyToId}</p><p className="comment-body">{reply.status==="deleted"?"正文已删除":reply.excerpt}</p></li>)}</ol>}<nav className="audit-pagination" aria-label="同串回复分页"><span>{query.before&&<Link href={"/admin/comments/"+id}>返回最新回复</Link>}</span>{replies.nextCursor&&<Link href={"/admin/comments/"+id+"?before="+replies.nextCursor}>更早回复</Link>}</nav></Card></div>
 </>;
}
