import {Input} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import Form from "next/form";
import {headers} from "next/headers";
import {listComments} from "@sohoin/core/server";
import {commentQuerySchema} from "@sohoin/extension-api/comments";
import {adminRead} from "@/lib/admin-page";
import {Card} from "@sohoin/admin-ui/card";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell,TableCaption} from "@sohoin/admin-ui/table";
const labels={visible:"正常",hidden:"隐藏",deleted:"已删除"};
export default async function CommentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams;if(raw.contentId==="")delete raw.contentId;const parsed=commentQuerySchema.safeParse(raw);if(!parsed.success)return <EmptyState title="筛选参数无效" action={<Link href="/admin/comments">返回讨论列表</Link>}/>;
 const query=parsed.data,requestHeaders=await headers();const page=await adminRead(()=>listComments(requestHeaders,query));
 const link=(before?:string)=>{const params=new URLSearchParams({status:query.status});if(query.contentId)params.set("contentId",query.contentId);if(before)params.set("before",before);return "/admin/comments?"+params;};
 return <><PageHeader title="讨论管理" description="查看两级讨论与回复关系，分别管理单条状态和整串显示。"/><Card>
  <Form action="/admin/comments" className="comment-filters"><label>单条状态<NativeSelect name="status" defaultValue={query.status} key={query.status}>{Object.entries({all:"全部",...labels}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</NativeSelect></label><label>内容编号<Input name="contentId" inputMode="numeric" placeholder="全部内容" defaultValue={query.contentId??""} key={query.contentId??""}/></label><Button variant="outline" type="submit">筛选</Button><Link href="/admin/comments">重置</Link></Form>
  {page.items.length===0?<EmptyState title="暂无匹配讨论" description="调整筛选条件后再试。"/>:<Table><TableCaption>每页最多 30 条，按编号倒序。列表只读取最多 120 字预览；整串隐藏独立于单条状态。</TableCaption><TableHeader><TableRow><TableHead>讨论</TableHead><TableHead>所属内容</TableHead><TableHead>作者 / 回复对象</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{page.items.map(item=><TableRow key={item.id}><TableCell className="comment-list-body"><Link href={"/admin/comments/"+item.id}>{item.status==="deleted"?"正文已删除":item.excerpt}</Link><p className="au-muted">#{item.id} · {item.rootId?"二级回复":"一级讨论"}</p></TableCell><TableCell><Link href={"/admin/content/"+item.contentId}>{item.contentTitle||"未命名内容"}</Link></TableCell><TableCell>{item.authorName}{item.replyToId&&<p className="au-muted">回复 {item.replyToName} · #{item.replyToId}</p>}</TableCell><TableCell><div className="audit-fields"><Badge>{labels[item.status]}</Badge>{item.threadHidden&&<Badge>整串隐藏</Badge>}</div></TableCell><TableCell><Link href={"/admin/comments/"+item.id}>查看与管理</Link></TableCell></TableRow>)}</TableBody></Table>}
  <nav className="audit-pagination" aria-label="讨论分页"><span>{query.before&&<Link href={link()}>返回最新</Link>}</span>{page.nextCursor&&<Link href={link(page.nextCursor)}>更早讨论</Link>}</nav>
 </Card></>;
}
