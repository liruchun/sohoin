import {RelativeTime} from "@sohoin/ui/relative-time";
import {NativeSelect} from "@sohoin/admin-ui/native-select";
import {adminRead} from "@/lib/admin-page";
import {NavigationLink as Link} from "@/app/_components/navigation/page-motion";
import Form from "next/form";
import {headers} from "next/headers";
import {listUsers,ServiceError} from "@sohoin/core/server";
import {usersQuerySchema} from "@sohoin/extension-api/users";
import {PageHeader,EmptyState,Badge} from "@sohoin/admin-ui/layout";
import {Card} from "@sohoin/admin-ui/card";
import {Input} from "@sohoin/admin-ui/fields";
import {Button} from "@sohoin/admin-ui/button";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell,TableCaption} from "@sohoin/admin-ui/table";


export default async function UsersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const raw=await searchParams;
  const parsed=usersQuerySchema.safeParse(raw);
  if(!parsed.success)return <EmptyState title="搜索参数无效" description="请清除搜索条件后重试。" action={<Link href="/admin/users">返回用户列表</Link>}/>;
  const query=parsed.data;
  let page;try{page=await adminRead(async()=>listUsers(await headers(),query));}catch(error){if(error instanceof ServiceError&&error.status===429)return <EmptyState title="查询过于频繁" description="请稍后重试。"/>;throw error;}
  const link=(before?:string)=>{const params=new URLSearchParams();if(query.q)params.set("q",query.q);if(query.role!=="all")params.set("role",query.role);if(query.status!=="all")params.set("status",query.status);if(before)params.set("before",before);return "/admin/users"+(params.size?"?"+params:"");};
  return <><PageHeader title="用户管理" description="查找账号，管理访问状态与管理员权限。"/>
    <Card className="users-card">
      <Form action="/admin/users" className="users-filters" key={[query.q,query.role,query.status].join(":")}>
        <label className="users-search">搜索用户<Input type="search" name="q" placeholder="姓名或邮箱前缀" defaultValue={query.q} maxLength={100}/></label>
        <label>账号角色<NativeSelect className="au-input" name="role" defaultValue={query.role}><option value="all">全部角色</option><option value="user">普通用户</option><option value="admin">管理员</option></NativeSelect></label>
        <label>账号状态<NativeSelect className="au-input" name="status" defaultValue={query.status}><option value="all">全部状态</option><option value="active">启用</option><option value="banned">禁用</option></NativeSelect></label>
        <Button type="submit">查询</Button><Link href="/admin/users" className="users-reset">重置</Link>
      </Form>
      {page.items.length===0?<EmptyState title="没有匹配的用户" description="试试缩短搜索词，或重置筛选条件。"/>:
        <Table><TableCaption>本页 {page.items.length} 位用户，每页最多 30 位，按用户编号倒序排列。</TableCaption><TableHeader><TableRow><TableHead>用户</TableHead><TableHead>角色</TableHead><TableHead>状态</TableHead><TableHead>注册日期</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
          <TableBody>{page.items.map(user=><TableRow key={user.id}><TableCell className="users-identity"><Link href={"/admin/users/"+encodeURIComponent(user.id)}>{user.name}</Link><p className="au-muted">{user.email}</p></TableCell><TableCell><Badge>{user.role==="admin"?"管理员":"普通用户"}</Badge></TableCell><TableCell>{user.banned?"已禁用":"启用"}</TableCell><TableCell className="audit-time"><RelativeTime dateTime={user.createdAt}/></TableCell><TableCell><Link href={"/admin/users/"+encodeURIComponent(user.id)} aria-label={"管理用户 "+user.name}>管理</Link></TableCell></TableRow>)}</TableBody>
        </Table>}
      <nav className="audit-pagination" aria-label="用户列表分页"><span>{query.before&&<Link href={link()}>返回首页</Link>}</span>{page.nextCursor&&<Link href={link(page.nextCursor)}>下一页</Link>}</nav>
    </Card>
  </>;
}
